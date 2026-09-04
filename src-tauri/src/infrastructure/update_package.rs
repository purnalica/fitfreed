use std::{
    collections::HashMap,
    fmt,
    fs::OpenOptions,
    io::{Read, Write},
    path::Path,
    time::Duration,
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use fitfreed_application::{UpdateArtifact, UpdateInstallationAuthorization};
use minisign_verify::{PublicKey, Signature};
use reqwest::{blocking::Client as BlockingClient, redirect::Policy, Certificate};
use semver::Version;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::{
    Error as TauriUpdaterError, ReleaseManifestPlatform, RemoteRelease, RemoteReleaseInner, Update,
    UpdaterExt,
};
use thiserror::Error;
use url::Url;

use super::{current_update_target, local_file::PrivateStagingFile, HttpsUpdateChannel};

const PACKAGE_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const PACKAGE_REQUEST_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_UPDATE_PACKAGE_BYTES: u64 = 1_073_741_824;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UpdatePackageError {
    #[error("the update package trust is unavailable")]
    TrustUnavailable,
    #[error("the update package authorization is invalid")]
    InvalidAuthorization,
    #[error("the native updater rejected the package")]
    NativeUpdater,
    #[error("the update package download is unavailable")]
    DownloadUnavailable,
    #[error("the update package failed an integrity check")]
    PackageUntrusted,
    #[error("the update package digest does not match its authorization")]
    DigestMismatch,
}

pub struct VerifiedUpdatePackage {
    bytes: Vec<u8>,
    authorization: UpdateInstallationAuthorization,
    native_update: Update,
}

pub struct VerifiedPredecessorPackage {
    staging: PrivateStagingFile,
    byte_len: u64,
    sha256: String,
    package_signature: String,
    public_key: String,
}

impl fmt::Debug for VerifiedPredecessorPackage {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("VerifiedPredecessorPackage")
            .field("byte_len", &self.byte_len)
            .field("sha256", &self.sha256)
            .finish_non_exhaustive()
    }
}

impl VerifiedPredecessorPackage {
    pub fn path(&self) -> &Path {
        self.staging.path()
    }

    pub fn byte_len(&self) -> u64 {
        self.byte_len
    }

    pub fn sha256(&self) -> &str {
        &self.sha256
    }

    pub fn persist_noclobber(self, destination: &Path) -> Result<(), UpdatePackageError> {
        verify_predecessor_file(
            self.staging.path(),
            self.byte_len,
            &self.sha256,
            &self.package_signature,
            &self.public_key,
        )?;
        self.staging
            .persist_noclobber(destination)
            .map_err(|error| {
                if error.kind() == std::io::ErrorKind::AlreadyExists {
                    UpdatePackageError::PackageUntrusted
                } else {
                    UpdatePackageError::DownloadUnavailable
                }
            })
    }
}

impl VerifiedUpdatePackage {
    pub fn version(&self) -> &str {
        &self.authorization.version
    }

    pub fn target_library_schema_version(&self) -> u32 {
        self.authorization.target_library_schema_version
    }

    pub fn byte_len(&self) -> usize {
        self.bytes.len()
    }

    pub fn authorization(&self) -> &UpdateInstallationAuthorization {
        &self.authorization
    }

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    pub(crate) fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    pub fn install(&self) -> Result<(), UpdatePackageError> {
        validate_downloaded_bytes(&self.bytes, &self.authorization)?;
        self.native_update
            .install(&self.bytes)
            .map_err(|_| UpdatePackageError::NativeUpdater)
    }
}

pub async fn download_verified_update<R: Runtime>(
    app: &AppHandle<R>,
    channel: &HttpsUpdateChannel,
    authorization: UpdateInstallationAuthorization,
) -> Result<VerifiedUpdatePackage, UpdatePackageError> {
    validate_authorization(&authorization)?;
    let package_public_key = channel
        .package_public_key(&authorization.signing_key_id)
        .ok_or(UpdatePackageError::TrustUnavailable)?
        .to_owned();
    let package_root_certificate = channel
        .package_root_certificate()
        .map(parse_single_root_certificate)
        .transpose()
        .map_err(|_| UpdatePackageError::TrustUnavailable)?;
    let package_url = Url::parse(&authorization.artifact.package_url)
        .map_err(|_| UpdatePackageError::InvalidAuthorization)?;
    let version = Version::parse(&authorization.version)
        .map_err(|_| UpdatePackageError::InvalidAuthorization)?;
    let target = authorization.artifact.target.clone();
    let release = RemoteRelease {
        version,
        notes: None,
        pub_date: None,
        data: RemoteReleaseInner::Static {
            platforms: HashMap::from([(
                target.clone(),
                ReleaseManifestPlatform {
                    url: package_url,
                    signature: authorization.artifact.package_signature.clone(),
                },
            )]),
        },
    };
    let updater = app
        .updater_builder()
        .target(target)
        .pubkey(package_public_key)
        .configure_client(move |client| {
            let client = client
                .connect_timeout(PACKAGE_CONNECT_TIMEOUT)
                .timeout(PACKAGE_REQUEST_TIMEOUT)
                .redirect(Policy::none())
                .tls_sslkeylogfile(false);
            if let Some(certificate) = package_root_certificate.as_ref() {
                client.add_root_certificate(certificate.clone())
            } else {
                client
            }
        })
        .build_for_authenticated_release()
        .map_err(|_| UpdatePackageError::NativeUpdater)?;
    let native_update = updater
        .prepare_update(release, serde_json::Value::Null)
        .map_err(|_| UpdatePackageError::NativeUpdater)?;
    validate_native_identity(&native_update, &authorization)?;
    let bytes = native_update
        .download_with_expected_size(authorization.artifact.expected_size_bytes, |_, _| {}, || {})
        .await
        .map_err(classify_download_error)?;
    validate_downloaded_bytes(&bytes, &authorization)?;

    Ok(VerifiedUpdatePackage {
        bytes,
        authorization,
        native_update,
    })
}

pub fn download_verified_predecessor(
    channel: &HttpsUpdateChannel,
    authorization: &UpdateInstallationAuthorization,
    staging_directory: &Path,
) -> Result<VerifiedPredecessorPackage, UpdatePackageError> {
    validate_authorization(authorization)?;
    let artifact = authorization
        .predecessor_artifact
        .as_ref()
        .ok_or(UpdatePackageError::InvalidAuthorization)?;
    let public_key = channel
        .package_public_key(&authorization.signing_key_id)
        .ok_or(UpdatePackageError::TrustUnavailable)?;
    let package_root_certificate = channel
        .package_root_certificate()
        .map(parse_single_root_certificate)
        .transpose()
        .map_err(|_| UpdatePackageError::TrustUnavailable)?;
    let client = build_predecessor_client(package_root_certificate.as_ref())?;
    let url = validate_update_artifact(artifact)?;
    let response = client
        .get(url)
        .send()
        .map_err(|_| UpdatePackageError::DownloadUnavailable)?;
    if !response.status().is_success() {
        return Err(UpdatePackageError::DownloadUnavailable);
    }
    let content_length = response.content_length();
    transfer_verified_predecessor(
        response,
        content_length,
        staging_directory,
        artifact,
        public_key,
    )
}

fn build_predecessor_client(
    root_certificate: Option<&Certificate>,
) -> Result<BlockingClient, UpdatePackageError> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let mut builder = BlockingClient::builder()
        .connect_timeout(PACKAGE_CONNECT_TIMEOUT)
        .timeout(PACKAGE_REQUEST_TIMEOUT)
        .redirect(Policy::none())
        .tls_sslkeylogfile(false);
    if let Some(certificate) = root_certificate {
        builder = builder.add_root_certificate(certificate.clone());
    }
    builder
        .build()
        .map_err(|_| UpdatePackageError::DownloadUnavailable)
}

fn transfer_verified_predecessor(
    mut reader: impl Read,
    content_length: Option<u64>,
    staging_directory: &Path,
    artifact: &UpdateArtifact,
    public_key: &str,
) -> Result<VerifiedPredecessorPackage, UpdatePackageError> {
    validate_update_artifact(artifact)?;
    if content_length.is_some_and(|length| length != artifact.expected_size_bytes) {
        return Err(UpdatePackageError::PackageUntrusted);
    }
    let public_key_value = decode_public_key(public_key)?;
    let signature = decode_signature(&artifact.package_signature)?;
    let mut signature_verifier = public_key_value
        .verify_stream(&signature)
        .map_err(|_| UpdatePackageError::PackageUntrusted)?;
    let mut staging =
        PrivateStagingFile::new(staging_directory, "fitfreed-predecessor-package", ".tmp")
            .map_err(|_| UpdatePackageError::DownloadUnavailable)?;
    let mut digest = Sha256::new();
    let mut total = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|_| UpdatePackageError::DownloadUnavailable)?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(u64::try_from(read).map_err(|_| UpdatePackageError::PackageUntrusted)?)
            .filter(|value| *value <= artifact.expected_size_bytes)
            .ok_or(UpdatePackageError::PackageUntrusted)?;
        digest.update(&buffer[..read]);
        signature_verifier.update(&buffer[..read]);
        staging
            .file_mut()
            .and_then(|file| file.write_all(&buffer[..read]))
            .map_err(|_| UpdatePackageError::DownloadUnavailable)?;
    }
    if total != artifact.expected_size_bytes {
        return Err(UpdatePackageError::PackageUntrusted);
    }
    let sha256 = digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    if sha256 != artifact.expected_sha256 {
        return Err(UpdatePackageError::DigestMismatch);
    }
    signature_verifier
        .finalize()
        .map_err(|_| UpdatePackageError::PackageUntrusted)?;
    staging
        .sync_and_close()
        .map_err(|_| UpdatePackageError::DownloadUnavailable)?;
    verify_predecessor_file(
        staging.path(),
        total,
        &sha256,
        &artifact.package_signature,
        public_key,
    )?;
    Ok(VerifiedPredecessorPackage {
        staging,
        byte_len: total,
        sha256,
        package_signature: artifact.package_signature.clone(),
        public_key: public_key.to_owned(),
    })
}

fn verify_predecessor_file(
    path: &Path,
    expected_size: u64,
    expected_sha256: &str,
    encoded_signature: &str,
    encoded_public_key: &str,
) -> Result<(), UpdatePackageError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    let mut file = options
        .open(path)
        .map_err(|_| UpdatePackageError::PackageUntrusted)?;
    let metadata = file
        .metadata()
        .map_err(|_| UpdatePackageError::PackageUntrusted)?;
    if !metadata.file_type().is_file() || metadata.len() != expected_size {
        return Err(UpdatePackageError::PackageUntrusted);
    }
    let public_key = decode_public_key(encoded_public_key)?;
    let signature = decode_signature(encoded_signature)?;
    let mut signature_verifier = public_key
        .verify_stream(&signature)
        .map_err(|_| UpdatePackageError::PackageUntrusted)?;
    let mut digest = Sha256::new();
    let mut total = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|_| UpdatePackageError::PackageUntrusted)?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(u64::try_from(read).map_err(|_| UpdatePackageError::PackageUntrusted)?)
            .filter(|value| *value <= expected_size)
            .ok_or(UpdatePackageError::PackageUntrusted)?;
        digest.update(&buffer[..read]);
        signature_verifier.update(&buffer[..read]);
    }
    if total != expected_size
        || digest
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
            != expected_sha256
    {
        return Err(UpdatePackageError::DigestMismatch);
    }
    signature_verifier
        .finalize()
        .map_err(|_| UpdatePackageError::PackageUntrusted)
}

fn decode_public_key(value: &str) -> Result<PublicKey, UpdatePackageError> {
    PublicKey::decode(&decode_base64_text(value)?).map_err(|_| UpdatePackageError::TrustUnavailable)
}

fn decode_signature(value: &str) -> Result<Signature, UpdatePackageError> {
    Signature::decode(&decode_base64_text(value)?)
        .map_err(|_| UpdatePackageError::InvalidAuthorization)
}

fn decode_base64_text(value: &str) -> Result<String, UpdatePackageError> {
    let bytes = BASE64
        .decode(value)
        .map_err(|_| UpdatePackageError::InvalidAuthorization)?;
    String::from_utf8(bytes).map_err(|_| UpdatePackageError::InvalidAuthorization)
}

fn parse_single_root_certificate(pem: &[u8]) -> Result<Certificate, ()> {
    let mut certificates = Certificate::from_pem_bundle(pem).map_err(|_| ())?;
    if certificates.len() != 1 {
        return Err(());
    }
    certificates.pop().ok_or(())
}

fn validate_authorization(
    authorization: &UpdateInstallationAuthorization,
) -> Result<(), UpdatePackageError> {
    let current_target =
        current_update_target().map_err(|_| UpdatePackageError::InvalidAuthorization)?;
    if authorization.artifact.target != current_target
        || validate_update_artifact(&authorization.artifact).is_err()
        || authorization
            .predecessor_artifact
            .as_ref()
            .is_some_and(|artifact| {
                artifact.target != current_target || validate_update_artifact(artifact).is_err()
            })
        || Version::parse(&authorization.version).is_err()
        || authorization.trusted_sequence == 0
        || !valid_sha256(&authorization.trusted_payload_sha256)
        || authorization.target_library_schema_version == 0
    {
        return Err(UpdatePackageError::InvalidAuthorization);
    }
    Ok(())
}

fn validate_update_artifact(artifact: &UpdateArtifact) -> Result<Url, UpdatePackageError> {
    let package_url =
        Url::parse(&artifact.package_url).map_err(|_| UpdatePackageError::InvalidAuthorization)?;
    if package_url.as_str() != artifact.package_url
        || package_url.scheme() != "https"
        || !package_url.has_host()
        || !package_url.username().is_empty()
        || package_url.password().is_some()
        || package_url.query().is_some()
        || package_url.fragment().is_some()
        || artifact.expected_size_bytes == 0
        || artifact.expected_size_bytes > MAX_UPDATE_PACKAGE_BYTES
        || !valid_sha256(&artifact.expected_sha256)
        || !(16..=16_384).contains(&artifact.package_signature.len())
        || decode_signature(&artifact.package_signature).is_err()
    {
        return Err(UpdatePackageError::InvalidAuthorization);
    }
    Ok(package_url)
}

fn validate_native_identity(
    native_update: &Update,
    authorization: &UpdateInstallationAuthorization,
) -> Result<(), UpdatePackageError> {
    validate_prepared_identity(
        PreparedUpdateIdentity {
            version: &native_update.version,
            target: &native_update.target,
            package_url: native_update.download_url.as_str(),
            package_signature: &native_update.signature,
        },
        authorization,
    )
}

#[derive(Clone, Copy)]
struct PreparedUpdateIdentity<'a> {
    version: &'a str,
    target: &'a str,
    package_url: &'a str,
    package_signature: &'a str,
}

fn validate_prepared_identity(
    prepared: PreparedUpdateIdentity<'_>,
    authorization: &UpdateInstallationAuthorization,
) -> Result<(), UpdatePackageError> {
    if prepared.version != authorization.version
        || prepared.target != authorization.artifact.target
        || prepared.package_url != authorization.artifact.package_url
        || prepared.package_signature != authorization.artifact.package_signature
    {
        return Err(UpdatePackageError::InvalidAuthorization);
    }
    Ok(())
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn validate_downloaded_bytes(
    bytes: &[u8],
    authorization: &UpdateInstallationAuthorization,
) -> Result<(), UpdatePackageError> {
    if u64::try_from(bytes.len()).ok() != Some(authorization.artifact.expected_size_bytes) {
        return Err(UpdatePackageError::PackageUntrusted);
    }
    let digest = Sha256::digest(bytes);
    let actual_sha256 = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    if actual_sha256 != authorization.artifact.expected_sha256 {
        return Err(UpdatePackageError::DigestMismatch);
    }
    Ok(())
}

fn classify_download_error(error: TauriUpdaterError) -> UpdatePackageError {
    match error {
        TauriUpdaterError::Reqwest(_) | TauriUpdaterError::Network(_) => {
            UpdatePackageError::DownloadUnavailable
        }
        TauriUpdaterError::DownloadSizeMismatch
        | TauriUpdaterError::Minisign(_)
        | TauriUpdaterError::Base64(_)
        | TauriUpdaterError::SignatureUtf8(_) => UpdatePackageError::PackageUntrusted,
        _ => UpdatePackageError::NativeUpdater,
    }
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    use fitfreed_application::{UpdateArtifact, UpdateInstallationAuthorization};
    use minisign::{sign, KeyPair};
    use tempfile::tempdir;

    use super::*;

    fn authorization(bytes: &[u8]) -> UpdateInstallationAuthorization {
        let (mut artifact, _) = signed_predecessor(bytes);
        artifact.package_url = "https://updates.invalid/fitfreed-0.2.0.app.tar.gz".to_owned();
        UpdateInstallationAuthorization {
            version: "0.2.0".to_owned(),
            trusted_sequence: 17,
            trusted_payload_sha256: "1".repeat(64),
            signing_key_id: "synthetic-test-key".to_owned(),
            target_library_schema_version: 9,
            artifact,
            predecessor_artifact: None,
        }
    }

    #[test]
    fn binds_exact_downloaded_bytes_to_the_fresh_authorization() {
        let bytes = b"synthetic updater package";
        let authorization = authorization(bytes);
        let identity = PreparedUpdateIdentity {
            version: &authorization.version,
            target: &authorization.artifact.target,
            package_url: &authorization.artifact.package_url,
            package_signature: &authorization.artifact.package_signature,
        };

        assert!(validate_authorization(&authorization).is_ok());
        assert!(validate_prepared_identity(identity, &authorization).is_ok());
        assert!(validate_downloaded_bytes(bytes, &authorization).is_ok());
    }

    #[test]
    fn rejects_changed_package_authority_and_downloaded_bytes() {
        let bytes = b"synthetic updater package";

        let mut wrong_size = authorization(bytes);
        wrong_size.artifact.expected_size_bytes += 1;
        assert_eq!(
            validate_downloaded_bytes(bytes, &wrong_size),
            Err(UpdatePackageError::PackageUntrusted)
        );

        let mut wrong_digest = authorization(bytes);
        wrong_digest.artifact.expected_sha256 = "0".repeat(64);
        assert_eq!(
            validate_downloaded_bytes(bytes, &wrong_digest),
            Err(UpdatePackageError::DigestMismatch)
        );

        let mut wrong_target = authorization(bytes);
        wrong_target.artifact.target = "windows-x86_64".to_owned();
        assert_eq!(
            validate_authorization(&wrong_target),
            Err(UpdatePackageError::InvalidAuthorization)
        );

        let mut noncanonical_url = authorization(bytes);
        noncanonical_url.artifact.package_url =
            "https://updates.invalid/fitfreed/../fitfreed-0.2.0.app.tar.gz".to_owned();
        assert_eq!(
            validate_authorization(&noncanonical_url),
            Err(UpdatePackageError::InvalidAuthorization)
        );

        let mut mutable_url = authorization(bytes);
        mutable_url.artifact.package_url =
            "https://updates.invalid/fitfreed-0.2.0.app.tar.gz?current=true".to_owned();
        assert_eq!(
            validate_authorization(&mutable_url),
            Err(UpdatePackageError::InvalidAuthorization)
        );

        let mut oversized = authorization(bytes);
        oversized.artifact.expected_size_bytes = MAX_UPDATE_PACKAGE_BYTES + 1;
        assert_eq!(
            validate_authorization(&oversized),
            Err(UpdatePackageError::InvalidAuthorization)
        );

        let mut invalid_digest = authorization(bytes);
        invalid_digest.artifact.expected_sha256 = "A".repeat(64);
        assert_eq!(
            validate_authorization(&invalid_digest),
            Err(UpdatePackageError::InvalidAuthorization)
        );

        let authorization = authorization(bytes);
        for changed_identity in [
            PreparedUpdateIdentity {
                version: "0.3.0",
                target: &authorization.artifact.target,
                package_url: &authorization.artifact.package_url,
                package_signature: &authorization.artifact.package_signature,
            },
            PreparedUpdateIdentity {
                version: &authorization.version,
                target: "windows-x86_64",
                package_url: &authorization.artifact.package_url,
                package_signature: &authorization.artifact.package_signature,
            },
            PreparedUpdateIdentity {
                version: &authorization.version,
                target: &authorization.artifact.target,
                package_url: "https://updates.invalid/changed.tar.gz",
                package_signature: &authorization.artifact.package_signature,
            },
            PreparedUpdateIdentity {
                version: &authorization.version,
                target: &authorization.artifact.target,
                package_url: &authorization.artifact.package_url,
                package_signature: "changed-package-signature",
            },
        ] {
            assert_eq!(
                validate_prepared_identity(changed_identity, &authorization),
                Err(UpdatePackageError::InvalidAuthorization)
            );
        }
    }

    #[test]
    fn distinguishes_unavailable_transport_from_untrusted_package_size() {
        assert_eq!(
            classify_download_error(TauriUpdaterError::Network("synthetic status".to_owned())),
            UpdatePackageError::DownloadUnavailable
        );
        assert_eq!(
            classify_download_error(TauriUpdaterError::DownloadSizeMismatch),
            UpdatePackageError::PackageUntrusted
        );
    }

    fn signed_predecessor(bytes: &[u8]) -> (UpdateArtifact, String) {
        let key_pair = KeyPair::generate_unencrypted_keypair().expect("synthetic key pair");
        let public_key = key_pair
            .pk
            .to_box()
            .expect("synthetic public key box")
            .to_string();
        let signature = sign(
            Some(&key_pair.pk),
            &key_pair.sk,
            Cursor::new(bytes),
            Some("synthetic predecessor"),
            Some("untrusted comment: synthetic FitFreed predecessor"),
        )
        .expect("synthetic predecessor signature")
        .into_string();
        (
            UpdateArtifact {
                target: current_update_target().expect("current target"),
                package_url: "https://updates.invalid/FitFreed_0.1.0_amd64.deb".to_owned(),
                expected_size_bytes: bytes.len() as u64,
                expected_sha256: Sha256::digest(bytes)
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect(),
                package_signature: BASE64.encode(signature),
            },
            BASE64.encode(public_key),
        )
    }

    #[test]
    fn streams_and_reopens_one_exact_authenticated_predecessor() {
        let bytes = b"synthetic predecessor Debian package";
        let (artifact, public_key) = signed_predecessor(bytes);
        let directory = tempdir().expect("temporary directory");

        let package = transfer_verified_predecessor(
            Cursor::new(bytes),
            Some(bytes.len() as u64),
            directory.path(),
            &artifact,
            &public_key,
        )
        .expect("verified predecessor");

        assert_eq!(package.byte_len(), bytes.len() as u64);
        assert_eq!(package.sha256(), artifact.expected_sha256);
        assert_eq!(
            std::fs::read(package.path()).expect("staged predecessor"),
            bytes
        );
        let destination = directory.path().join("package.deb");
        package
            .persist_noclobber(&destination)
            .expect("persisted predecessor");
        assert_eq!(
            std::fs::read(destination).expect("persisted predecessor bytes"),
            bytes
        );
    }

    #[test]
    fn rejects_changed_oversized_and_malformed_predecessor_evidence_without_residue() {
        let bytes = b"synthetic predecessor Debian package";
        let (artifact, public_key) = signed_predecessor(bytes);
        for (reader, length, expected) in [
            (
                Cursor::new(b"changed predecessor package".as_slice()),
                None,
                UpdatePackageError::PackageUntrusted,
            ),
            (
                Cursor::new(bytes.as_slice()),
                Some(bytes.len() as u64 + 1),
                UpdatePackageError::PackageUntrusted,
            ),
        ] {
            let directory = tempdir().expect("temporary directory");
            assert_eq!(
                transfer_verified_predecessor(
                    reader,
                    length,
                    directory.path(),
                    &artifact,
                    &public_key,
                )
                .expect_err("rejected predecessor"),
                expected
            );
            assert_eq!(
                std::fs::read_dir(directory.path())
                    .expect("empty staging directory")
                    .count(),
                0
            );
        }

        let directory = tempdir().expect("temporary directory");
        let mut malformed = artifact.clone();
        malformed.package_signature = BASE64.encode("invalid signature");
        assert_eq!(
            transfer_verified_predecessor(
                Cursor::new(bytes),
                Some(bytes.len() as u64),
                directory.path(),
                &malformed,
                &public_key,
            )
            .expect_err("invalid signature"),
            UpdatePackageError::InvalidAuthorization
        );
        assert_eq!(
            std::fs::read_dir(directory.path())
                .expect("empty staging directory")
                .count(),
            0
        );
    }

    #[test]
    fn predecessor_publication_never_replaces_existing_evidence() {
        let bytes = b"synthetic predecessor Debian package";
        let (artifact, public_key) = signed_predecessor(bytes);
        let directory = tempdir().expect("temporary directory");
        let package = transfer_verified_predecessor(
            Cursor::new(bytes),
            None,
            directory.path(),
            &artifact,
            &public_key,
        )
        .expect("verified predecessor");
        let destination = directory.path().join("package.deb");
        std::fs::write(&destination, "existing evidence").expect("existing evidence");

        assert_eq!(
            package
                .persist_noclobber(&destination)
                .expect_err("no-clobber publication"),
            UpdatePackageError::PackageUntrusted
        );
        assert_eq!(
            std::fs::read_to_string(destination).expect("preserved evidence"),
            "existing evidence"
        );
        assert_eq!(
            std::fs::read_dir(directory.path())
                .expect("preserved destination only")
                .count(),
            1
        );
    }

    #[test]
    fn rejects_wrong_signing_authority_and_mutation_before_publication() {
        let bytes = b"synthetic predecessor Debian package";
        let (artifact, public_key) = signed_predecessor(bytes);
        let (_, wrong_public_key) = signed_predecessor(b"different signed package");
        let directory = tempdir().expect("temporary directory");
        assert_eq!(
            transfer_verified_predecessor(
                Cursor::new(bytes),
                Some(bytes.len() as u64),
                directory.path(),
                &artifact,
                &wrong_public_key,
            )
            .expect_err("wrong signing authority"),
            UpdatePackageError::PackageUntrusted
        );
        assert_eq!(
            std::fs::read_dir(directory.path())
                .expect("empty staging directory")
                .count(),
            0
        );

        let package = transfer_verified_predecessor(
            Cursor::new(bytes),
            Some(bytes.len() as u64),
            directory.path(),
            &artifact,
            &public_key,
        )
        .expect("verified predecessor");
        std::fs::write(package.path(), vec![b'x'; bytes.len()]).expect("mutated predecessor");
        let destination = directory.path().join("package.deb");
        assert_eq!(
            package
                .persist_noclobber(&destination)
                .expect_err("mutated predecessor"),
            UpdatePackageError::DigestMismatch
        );
        assert!(!destination.exists());
        assert_eq!(
            std::fs::read_dir(directory.path())
                .expect("empty staging directory")
                .count(),
            0
        );
    }
}
