use std::{collections::HashMap, time::Duration};

use fitfreed_application::UpdateInstallationAuthorization;
use reqwest::{redirect::Policy, Certificate};
use semver::Version;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::{
    Error as TauriUpdaterError, ReleaseManifestPlatform, RemoteRelease, RemoteReleaseInner, Update,
    UpdaterExt,
};
use thiserror::Error;
use url::Url;

use super::{current_update_target, HttpsUpdateChannel};

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
    let package_url = Url::parse(&authorization.artifact.package_url)
        .map_err(|_| UpdatePackageError::InvalidAuthorization)?;
    let current_target =
        current_update_target().map_err(|_| UpdatePackageError::InvalidAuthorization)?;
    if authorization.artifact.target != current_target
        || package_url.as_str() != authorization.artifact.package_url
        || package_url.scheme() != "https"
        || !package_url.has_host()
        || !package_url.username().is_empty()
        || package_url.password().is_some()
        || package_url.fragment().is_some()
        || Version::parse(&authorization.version).is_err()
        || authorization.artifact.expected_size_bytes == 0
        || authorization.artifact.expected_size_bytes > MAX_UPDATE_PACKAGE_BYTES
        || !valid_sha256(&authorization.artifact.expected_sha256)
        || !(16..=16_384).contains(&authorization.artifact.package_signature.len())
        || authorization.trusted_sequence == 0
        || !valid_sha256(&authorization.trusted_payload_sha256)
        || authorization.target_library_schema_version == 0
    {
        return Err(UpdatePackageError::InvalidAuthorization);
    }
    Ok(())
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
    use fitfreed_application::{UpdateArtifact, UpdateInstallationAuthorization};

    use super::*;

    fn authorization(bytes: &[u8]) -> UpdateInstallationAuthorization {
        UpdateInstallationAuthorization {
            version: "0.2.0".to_owned(),
            trusted_sequence: 17,
            trusted_payload_sha256: "1".repeat(64),
            signing_key_id: "synthetic-test-key".to_owned(),
            target_library_schema_version: 9,
            artifact: UpdateArtifact {
                target: current_update_target().expect("current target"),
                package_url: "https://updates.invalid/fitfreed-0.2.0.app.tar.gz".to_owned(),
                expected_size_bytes: bytes.len() as u64,
                expected_sha256: Sha256::digest(bytes)
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect(),
                package_signature: "synthetic-package-signature".to_owned(),
            },
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
}
