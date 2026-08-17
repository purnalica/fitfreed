use std::collections::BTreeMap;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use fitfreed_application::{
    AuthenticatedUpdateSnapshot, LocalizedUpdateText, UpdateArtifact, UpdateChannelRead,
    UpdateRelease, UpdateTrustFailure, UpdateWithdrawal, UpdateWithdrawalReason,
};
use minisign_verify::{PublicKey, Signature};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use thiserror::Error;
use url::Url;

pub(crate) const MAX_UPDATE_RESPONSE_BYTES: usize = 1_572_864;
const MAX_UPDATE_PAYLOAD_BYTES: usize = 1_048_576;
const MAX_SAFE_JSON_INTEGER: u64 = 9_007_199_254_740_991;
const MAX_UPDATE_PACKAGE_BYTES: u64 = 1_073_741_824;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignedUpdateChannelVerifier {
    trusted_public_keys: BTreeMap<String, String>,
    current_target: String,
    contract: UpdateChannelContract,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UpdateChannelContract {
    PrivateAlphaV1,
    StableV2,
}

impl UpdateChannelContract {
    fn schema_version(self) -> u32 {
        match self {
            Self::PrivateAlphaV1 => 1,
            Self::StableV2 => 2,
        }
    }

    fn channel(self) -> &'static str {
        match self {
            Self::PrivateAlphaV1 => "private-alpha",
            Self::StableV2 => "stable",
        }
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UpdateVerifierConfigurationError {
    #[error("the update trust set is invalid")]
    InvalidTrustedKeys,
    #[error("the update target is unsupported")]
    UnsupportedTarget,
}

impl SignedUpdateChannelVerifier {
    pub fn try_new(
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
    ) -> Result<Self, UpdateVerifierConfigurationError> {
        Self::try_new_for_contract(
            trusted_public_keys,
            current_target,
            UpdateChannelContract::PrivateAlphaV1,
        )
    }

    pub fn try_new_for_stable(
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
    ) -> Result<Self, UpdateVerifierConfigurationError> {
        Self::try_new_for_contract(
            trusted_public_keys,
            current_target,
            UpdateChannelContract::StableV2,
        )
    }

    fn try_new_for_contract(
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
        contract: UpdateChannelContract,
    ) -> Result<Self, UpdateVerifierConfigurationError> {
        if trusted_public_keys.is_empty()
            || trusted_public_keys.len() > 8
            || trusted_public_keys.iter().any(|(key_id, public_key)| {
                !valid_key_id(key_id)
                    || public_key.len() > 16_384
                    || decode_base64_text(public_key)
                        .ok()
                        .and_then(|decoded| PublicKey::decode(&decoded).ok())
                        .is_none()
            })
        {
            return Err(UpdateVerifierConfigurationError::InvalidTrustedKeys);
        }
        if !valid_target(&current_target) {
            return Err(UpdateVerifierConfigurationError::UnsupportedTarget);
        }
        Ok(Self {
            trusted_public_keys,
            current_target,
            contract,
        })
    }

    pub fn verify_response(&self, response: &[u8]) -> UpdateChannelRead {
        match self.verify_response_inner(response) {
            Ok(snapshot) => UpdateChannelRead::Authenticated(Box::new(snapshot)),
            Err(failure) => UpdateChannelRead::Untrusted(failure),
        }
    }

    pub(crate) fn trusted_public_key(&self, key_id: &str) -> Option<&str> {
        self.trusted_public_keys.get(key_id).map(String::as_str)
    }

    fn verify_response_inner(
        &self,
        response: &[u8],
    ) -> Result<AuthenticatedUpdateSnapshot, UpdateTrustFailure> {
        if response.len() > MAX_UPDATE_RESPONSE_BYTES {
            return Err(UpdateTrustFailure::ResponseTooLarge);
        }
        let envelope: UpdateEnvelope =
            serde_json::from_slice(response).map_err(|_| UpdateTrustFailure::InvalidEnvelope)?;
        if envelope.fitfreed.format != "org.fitfreed.update-envelope"
            || envelope.fitfreed.schema_version != self.contract.schema_version()
            || envelope.fitfreed.algorithm != "minisign-ed25519"
            || envelope.fitfreed.signature_base64.len() > 16_384
        {
            return Err(UpdateTrustFailure::InvalidEnvelope);
        }

        let trusted_public_key = self
            .trusted_public_keys
            .get(&envelope.fitfreed.key_id)
            .ok_or(UpdateTrustFailure::UnknownKey)?;
        let payload = BASE64
            .decode(&envelope.fitfreed.payload_base64)
            .map_err(|_| UpdateTrustFailure::InvalidEnvelope)?;
        if payload.len() > MAX_UPDATE_PAYLOAD_BYTES {
            return Err(UpdateTrustFailure::ResponseTooLarge);
        }
        verify_minisign(
            &payload,
            &envelope.fitfreed.signature_base64,
            trusted_public_key,
        )?;

        let payload_sha256 = hex_digest(&payload);
        let payload: UpdatePayload =
            serde_json::from_slice(&payload).map_err(|_| UpdateTrustFailure::InvalidPayload)?;
        validate_payload_identity(&payload, self.contract)?;
        validate_localized_text(&payload.release.release_notes)?;
        if payload.withdrawn_versions.len() > 256 {
            return Err(UpdateTrustFailure::InvalidPayload);
        }
        for withdrawal in &payload.withdrawn_versions {
            validate_localized_text(&withdrawal.guidance)?;
        }
        validate_platforms(&payload.release.platforms)?;
        validate_mirrors(&envelope, &payload)?;
        let artifact = payload
            .release
            .platforms
            .get(&self.current_target)
            .ok_or(UpdateTrustFailure::MissingTarget)?;

        Ok(AuthenticatedUpdateSnapshot {
            sequence: payload.sequence,
            payload_sha256,
            signing_key_id: envelope.fitfreed.key_id,
            issued_at: payload.issued_at,
            expires_at: payload.expires_at,
            release: UpdateRelease {
                version: payload.release.version,
                published_at: payload.release.published_at,
                minimum_supported_version: payload.release.minimum_supported_version,
                minimum_readable_library_schema_version: payload
                    .release
                    .library_schema
                    .minimum_readable_version,
                maximum_readable_library_schema_version: payload
                    .release
                    .library_schema
                    .maximum_readable_version,
                target_library_schema_version: payload.release.library_schema.target_version,
                release_notes: LocalizedUpdateText {
                    values: payload.release.release_notes,
                },
                artifact: UpdateArtifact {
                    target: self.current_target.clone(),
                    package_url: artifact.url.clone(),
                    expected_size_bytes: artifact.size,
                    expected_sha256: artifact.sha256.clone(),
                    package_signature: artifact.tauri_signature.clone(),
                },
            },
            withdrawn_versions: payload
                .withdrawn_versions
                .into_iter()
                .map(|withdrawal| UpdateWithdrawal {
                    version: withdrawal.version,
                    reason: withdrawal.reason.into(),
                    guidance: LocalizedUpdateText {
                        values: withdrawal.guidance,
                    },
                    replacement_version: withdrawal.replacement_version,
                })
                .collect(),
        })
    }
}

fn verify_minisign(
    payload: &[u8],
    signature_base64: &str,
    public_key_base64: &str,
) -> Result<(), UpdateTrustFailure> {
    let public_key_text =
        decode_base64_text(public_key_base64).map_err(|_| UpdateTrustFailure::InvalidSignature)?;
    let public_key =
        PublicKey::decode(&public_key_text).map_err(|_| UpdateTrustFailure::InvalidSignature)?;
    let signature_text =
        decode_base64_text(signature_base64).map_err(|_| UpdateTrustFailure::InvalidSignature)?;
    let signature =
        Signature::decode(&signature_text).map_err(|_| UpdateTrustFailure::InvalidSignature)?;
    public_key
        .verify(payload, &signature, true)
        .map_err(|_| UpdateTrustFailure::InvalidSignature)
}

fn validate_payload_identity(
    payload: &UpdatePayload,
    contract: UpdateChannelContract,
) -> Result<(), UpdateTrustFailure> {
    if payload.format != "org.fitfreed.update-channel"
        || payload.schema_version != contract.schema_version()
    {
        return Err(UpdateTrustFailure::InvalidPayload);
    }
    if payload.channel != contract.channel() {
        return Err(UpdateTrustFailure::UnsupportedChannel);
    }
    if payload.sequence == 0 || payload.sequence > MAX_SAFE_JSON_INTEGER {
        return Err(UpdateTrustFailure::InvalidPayload);
    }
    Ok(())
}

fn validate_platforms(
    platforms: &BTreeMap<String, SignedPlatformArtifact>,
) -> Result<(), UpdateTrustFailure> {
    if platforms.is_empty() || platforms.len() > 16 {
        return Err(UpdateTrustFailure::InvalidPayload);
    }
    for (target, artifact) in platforms {
        if !valid_target(target)
            || artifact.size == 0
            || artifact.size > MAX_UPDATE_PACKAGE_BYTES
            || !valid_sha256(&artifact.sha256)
            || artifact.url.len() > 2_048
            || !valid_https_url(&artifact.url)
            || !(16..=16_384).contains(&artifact.tauri_signature.len())
            || decode_minisign_signature(&artifact.tauri_signature).is_err()
        {
            return Err(UpdateTrustFailure::InvalidPayload);
        }
    }
    Ok(())
}

fn validate_localized_text(values: &BTreeMap<String, String>) -> Result<(), UpdateTrustFailure> {
    if values.len() < 2
        || values.len() > 32
        || !values
            .get("en-US")
            .is_some_and(|value| valid_localized_value(value))
        || !values
            .get("es-ES")
            .is_some_and(|value| valid_localized_value(value))
        || values
            .iter()
            .any(|(locale, value)| !valid_locale_code(locale) || !valid_localized_value(value))
    {
        return Err(UpdateTrustFailure::InvalidPayload);
    }
    Ok(())
}

fn valid_localized_value(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 20_000
}

fn valid_locale_code(value: &str) -> bool {
    let mut parts = value.split('-');
    let Some(language) = parts.next() else {
        return false;
    };
    if !(2..=3).contains(&language.len()) || !language.bytes().all(|byte| byte.is_ascii_lowercase())
    {
        return false;
    }
    let Some(next) = parts.next() else {
        return false;
    };
    let region = if next.len() == 4
        && next.bytes().enumerate().all(|(index, byte)| {
            if index == 0 {
                byte.is_ascii_uppercase()
            } else {
                byte.is_ascii_lowercase()
            }
        }) {
        let Some(region) = parts.next() else {
            return false;
        };
        region
    } else {
        next
    };
    parts.next().is_none()
        && ((region.len() == 2 && region.bytes().all(|byte| byte.is_ascii_uppercase()))
            || (region.len() == 3 && region.bytes().all(|byte| byte.is_ascii_digit())))
}

fn validate_mirrors(
    envelope: &UpdateEnvelope,
    payload: &UpdatePayload,
) -> Result<(), UpdateTrustFailure> {
    if envelope.version != payload.release.version
        || envelope.platforms.len() != payload.release.platforms.len()
    {
        return Err(UpdateTrustFailure::MirrorMismatch);
    }
    for (target, signed) in &payload.release.platforms {
        let Some(mirror) = envelope.platforms.get(target) else {
            return Err(UpdateTrustFailure::MirrorMismatch);
        };
        if mirror.url != signed.url || mirror.signature != signed.tauri_signature {
            return Err(UpdateTrustFailure::MirrorMismatch);
        }
    }
    Ok(())
}

fn decode_minisign_signature(value: &str) -> Result<Signature, ()> {
    let text = decode_base64_text(value)?;
    Signature::decode(&text).map_err(|_| ())
}

fn decode_base64_text(value: &str) -> Result<String, ()> {
    let bytes = BASE64.decode(value).map_err(|_| ())?;
    String::from_utf8(bytes).map_err(|_| ())
}

fn valid_https_url(value: &str) -> bool {
    Url::parse(value).is_ok_and(|url| {
        url.scheme() == "https"
            && url.has_host()
            && url.username().is_empty()
            && url.password().is_none()
            && url.fragment().is_none()
    })
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn valid_target(value: &str) -> bool {
    let parts: Vec<_> = value.split('-').collect();
    matches!(parts.as_slice(), [os, architecture]
        if matches!(*os, "darwin" | "linux" | "windows")
            && matches!(*architecture, "aarch64" | "x86_64" | "i686" | "armv7"))
        || matches!(parts.as_slice(), [os, architecture, installer]
            if matches!(*os, "darwin" | "linux" | "windows")
                && matches!(*architecture, "aarch64" | "x86_64" | "i686" | "armv7")
                && matches!(*installer, "app" | "appimage" | "deb" | "rpm" | "msi" | "nsis"))
}

fn valid_key_id(value: &str) -> bool {
    (1..=128).contains(&value.len())
        && value.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || (index > 0 && matches!(byte, b'.' | b'_' | b'-'))
        })
}

fn hex_digest(value: &[u8]) -> String {
    Sha256::digest(value)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct UpdateEnvelope {
    version: String,
    platforms: BTreeMap<String, TauriPlatformMirror>,
    fitfreed: FitFreedEnvelope,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct TauriPlatformMirror {
    url: String,
    signature: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FitFreedEnvelope {
    format: String,
    schema_version: u32,
    algorithm: String,
    key_id: String,
    payload_base64: String,
    signature_base64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UpdatePayload {
    format: String,
    schema_version: u32,
    channel: String,
    sequence: u64,
    issued_at: String,
    expires_at: String,
    release: SignedRelease,
    withdrawn_versions: Vec<SignedWithdrawal>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SignedRelease {
    version: String,
    published_at: String,
    minimum_supported_version: String,
    library_schema: SignedLibrarySchema,
    release_notes: BTreeMap<String, String>,
    platforms: BTreeMap<String, SignedPlatformArtifact>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SignedLibrarySchema {
    minimum_readable_version: u32,
    maximum_readable_version: u32,
    target_version: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SignedPlatformArtifact {
    url: String,
    size: u64,
    sha256: String,
    tauri_signature: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SignedWithdrawal {
    version: String,
    reason: SignedWithdrawalReason,
    guidance: BTreeMap<String, String>,
    replacement_version: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum SignedWithdrawalReason {
    Security,
    DataIntegrity,
    Stability,
    Compatibility,
}

impl From<SignedWithdrawalReason> for UpdateWithdrawalReason {
    fn from(value: SignedWithdrawalReason) -> Self {
        match value {
            SignedWithdrawalReason::Security => Self::Security,
            SignedWithdrawalReason::DataIntegrity => Self::DataIntegrity,
            SignedWithdrawalReason::Stability => Self::Stability,
            SignedWithdrawalReason::Compatibility => Self::Compatibility,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use minisign::{sign, KeyPair};
    use serde_json::{json, Value};

    use super::*;

    #[test]
    fn accepts_the_documented_signing_key_identifier_shape() {
        assert!(valid_key_id("alpha.2026_test-key"));
        assert!(!valid_key_id("-alpha"));
        assert!(!valid_key_id("ALPHA"));
        assert!(!valid_key_id(&"a".repeat(129)));
    }

    struct SyntheticFeed {
        key_pair: KeyPair,
        public_key_base64: String,
        payload: Value,
    }

    impl SyntheticFeed {
        fn new() -> Self {
            Self::for_contract(1, "private-alpha")
        }

        fn stable() -> Self {
            Self::for_contract(2, "stable")
        }

        fn for_contract(schema_version: u32, channel: &str) -> Self {
            let key_pair = KeyPair::generate_unencrypted_keypair().expect("synthetic key pair");
            let public_key = key_pair
                .pk
                .to_box()
                .expect("synthetic public key box")
                .to_string();
            let artifact_signature = sign(
                Some(&key_pair.pk),
                &key_pair.sk,
                Cursor::new(b"synthetic updater artifact"),
                Some("synthetic artifact"),
                Some("untrusted comment: synthetic FitFreed test signature"),
            )
            .expect("synthetic artifact signature")
            .into_string();
            let payload = json!({
                "format": "org.fitfreed.update-channel",
                "schemaVersion": schema_version,
                "channel": channel,
                "sequence": 17,
                "issuedAt": "2026-08-17T00:00:00Z",
                "expiresAt": "2026-08-24T00:00:00Z",
                "release": {
                    "version": "0.2.0",
                    "publishedAt": "2026-08-17T00:00:00Z",
                    "minimumSupportedVersion": "0.1.0",
                    "librarySchema": {
                        "minimumReadableVersion": 1,
                        "maximumReadableVersion": 8,
                        "targetVersion": 9
                    },
                    "releaseNotes": {
                        "en-US": "Synthetic verified release.",
                        "es-ES": "Versión sintética verificada."
                    },
                    "platforms": {
                        "darwin-aarch64": {
                            "url": "https://updates.invalid/fitfreed-0.2.0-aarch64.app.tar.gz",
                            "size": 26,
                            "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                            "tauriSignature": BASE64.encode(artifact_signature)
                        }
                    }
                },
                "withdrawnVersions": [{
                    "version": "0.1.1",
                    "reason": "data-integrity",
                    "guidance": {
                        "en-US": "Install the verified replacement.",
                        "es-ES": "Instala la sustitución verificada."
                    },
                    "replacementVersion": "0.2.0"
                }]
            });
            Self {
                key_pair,
                public_key_base64: BASE64.encode(public_key),
                payload,
            }
        }

        fn response(&self) -> Vec<u8> {
            signed_response(&self.key_pair, &self.payload)
        }

        fn verifier(&self) -> SignedUpdateChannelVerifier {
            SignedUpdateChannelVerifier::try_new(
                BTreeMap::from([(
                    "synthetic-test-key".to_owned(),
                    self.public_key_base64.clone(),
                )]),
                "darwin-aarch64".to_owned(),
            )
            .expect("synthetic verifier")
        }

        fn stable_verifier(&self) -> SignedUpdateChannelVerifier {
            SignedUpdateChannelVerifier::try_new_for_stable(
                BTreeMap::from([(
                    "synthetic-test-key".to_owned(),
                    self.public_key_base64.clone(),
                )]),
                "darwin-aarch64".to_owned(),
            )
            .expect("synthetic stable verifier")
        }
    }

    fn signed_response(key_pair: &KeyPair, payload: &Value) -> Vec<u8> {
        let payload_bytes = serde_json::to_vec(payload).expect("synthetic payload");
        let metadata_signature = sign(
            Some(&key_pair.pk),
            &key_pair.sk,
            Cursor::new(&payload_bytes),
            Some("synthetic metadata"),
            Some("untrusted comment: synthetic FitFreed test signature"),
        )
        .expect("synthetic metadata signature")
        .into_string();
        let platform = &payload["release"]["platforms"]["darwin-aarch64"];
        serde_json::to_vec(&json!({
            "version": payload["release"]["version"],
            "platforms": {
                "darwin-aarch64": {
                    "url": platform["url"],
                    "signature": platform["tauriSignature"]
                }
            },
            "fitfreed": {
                "format": "org.fitfreed.update-envelope",
                "schemaVersion": payload["schemaVersion"],
                "algorithm": "minisign-ed25519",
                "keyId": "synthetic-test-key",
                "payloadBase64": BASE64.encode(payload_bytes),
                "signatureBase64": BASE64.encode(metadata_signature)
            }
        }))
        .expect("synthetic envelope")
    }

    #[test]
    fn verifies_exact_payload_bytes_and_maps_only_authenticated_policy() {
        let feed = SyntheticFeed::new();

        let result = feed.verifier().verify_response(&feed.response());

        let UpdateChannelRead::Authenticated(snapshot) = result else {
            panic!("expected authenticated update snapshot")
        };
        assert_eq!(snapshot.sequence, 17);
        assert_eq!(snapshot.signing_key_id, "synthetic-test-key");
        assert_eq!(snapshot.release.version, "0.2.0");
        assert_eq!(
            snapshot.release.release_notes.values["es-ES"],
            "Versión sintética verificada."
        );
        assert_eq!(snapshot.release.target_library_schema_version, 9);
        assert_eq!(snapshot.release.artifact.target, "darwin-aarch64");
        assert_eq!(
            snapshot.release.artifact.package_url,
            "https://updates.invalid/fitfreed-0.2.0-aarch64.app.tar.gz"
        );
        assert_eq!(snapshot.release.artifact.expected_size_bytes, 26);
        assert_eq!(
            snapshot.release.artifact.expected_sha256,
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        );
        assert!(!snapshot.release.artifact.package_signature.is_empty());
        assert_eq!(snapshot.withdrawn_versions.len(), 1);
        assert_eq!(
            snapshot.withdrawn_versions[0].reason,
            UpdateWithdrawalReason::DataIntegrity
        );
        assert!(valid_sha256(&snapshot.payload_sha256));
    }

    #[test]
    fn selects_the_stable_v2_contract_without_accepting_cross_channel_metadata() {
        let private_alpha = SyntheticFeed::new();
        let stable = SyntheticFeed::stable();

        assert!(matches!(
            stable.stable_verifier().verify_response(&stable.response()),
            UpdateChannelRead::Authenticated(_)
        ));
        assert_eq!(
            stable
                .stable_verifier()
                .verify_response(&private_alpha.response()),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidEnvelope)
        );
        assert_eq!(
            private_alpha.verifier().verify_response(&stable.response()),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidEnvelope)
        );
    }

    #[test]
    fn rejects_tampered_payload_invalid_signature_and_unknown_key() {
        let feed = SyntheticFeed::new();
        let mut tampered: Value =
            serde_json::from_slice(&feed.response()).expect("synthetic envelope");
        let mut payload = BASE64
            .decode(
                tampered["fitfreed"]["payloadBase64"]
                    .as_str()
                    .expect("payload"),
            )
            .expect("payload bytes");
        let last = payload.last_mut().expect("non-empty payload");
        *last ^= 1;
        tampered["fitfreed"]["payloadBase64"] = Value::String(BASE64.encode(payload));
        assert_eq!(
            feed.verifier().verify_response(
                &serde_json::to_vec(&tampered).expect("tampered synthetic envelope")
            ),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidSignature)
        );

        let mut invalid_signature: Value =
            serde_json::from_slice(&feed.response()).expect("synthetic envelope");
        invalid_signature["fitfreed"]["signatureBase64"] = Value::String(BASE64.encode("invalid"));
        assert_eq!(
            feed.verifier().verify_response(
                &serde_json::to_vec(&invalid_signature).expect("invalid signature envelope")
            ),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidSignature)
        );

        let mut unknown_key: Value =
            serde_json::from_slice(&feed.response()).expect("synthetic envelope");
        unknown_key["fitfreed"]["keyId"] = Value::String("unknown-test-key".to_owned());
        assert_eq!(
            feed.verifier()
                .verify_response(&serde_json::to_vec(&unknown_key).expect("unknown key envelope")),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::UnknownKey)
        );
    }

    #[test]
    fn rejects_unsigned_mirror_changes_and_a_missing_current_target() {
        let feed = SyntheticFeed::new();
        for path in ["version", "url", "signature"] {
            let mut response: Value =
                serde_json::from_slice(&feed.response()).expect("synthetic envelope");
            match path {
                "version" => response["version"] = Value::String("9.9.9".to_owned()),
                "url" => {
                    response["platforms"]["darwin-aarch64"]["url"] =
                        Value::String("https://updates.invalid/substitute.tar.gz".to_owned())
                }
                "signature" => {
                    response["platforms"]["darwin-aarch64"]["signature"] =
                        Value::String(BASE64.encode("substitute"))
                }
                _ => unreachable!(),
            }
            assert_eq!(
                feed.verifier().verify_response(
                    &serde_json::to_vec(&response).expect("mirror mismatch envelope")
                ),
                UpdateChannelRead::Untrusted(UpdateTrustFailure::MirrorMismatch)
            );
        }

        let missing_target = SignedUpdateChannelVerifier::try_new(
            BTreeMap::from([(
                "synthetic-test-key".to_owned(),
                feed.public_key_base64.clone(),
            )]),
            "darwin-x86_64".to_owned(),
        )
        .expect("synthetic missing-target verifier");
        assert_eq!(
            missing_target.verify_response(&feed.response()),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::MissingTarget)
        );
    }

    #[test]
    fn rejects_oversize_malformed_cross_channel_and_invalid_artifact_metadata() {
        let feed = SyntheticFeed::new();
        assert_eq!(
            feed.verifier()
                .verify_response(&vec![b'x'; MAX_UPDATE_RESPONSE_BYTES + 1]),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::ResponseTooLarge)
        );
        assert_eq!(
            feed.verifier().verify_response(br#"{"version":1}"#),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidEnvelope)
        );

        let mut cross_channel = feed.payload.clone();
        cross_channel["channel"] = Value::String("stable".to_owned());
        assert_eq!(
            feed.verifier()
                .verify_response(&signed_response(&feed.key_pair, &cross_channel)),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::UnsupportedChannel)
        );

        for invalid_policy in [
            {
                let mut payload = feed.payload.clone();
                payload["sequence"] = json!(MAX_SAFE_JSON_INTEGER + 1);
                payload
            },
            {
                let mut payload = feed.payload.clone();
                payload["release"]["releaseNotes"]
                    .as_object_mut()
                    .expect("release notes")
                    .remove("es-ES");
                payload
            },
            {
                let mut payload = feed.payload.clone();
                payload["release"]["releaseNotes"]["invalid_locale"] =
                    Value::String("Invalid locale key.".to_owned());
                payload
            },
        ] {
            assert_eq!(
                feed.verifier()
                    .verify_response(&signed_response(&feed.key_pair, &invalid_policy)),
                UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidPayload)
            );
        }

        for invalid_artifact in [
            (
                "url",
                Value::String("http://updates.invalid/update.tar.gz".to_owned()),
            ),
            ("size", json!(0)),
            ("size", json!(MAX_UPDATE_PACKAGE_BYTES + 1)),
            ("sha256", Value::String("invalid".to_owned())),
            ("tauriSignature", Value::String(BASE64.encode("invalid"))),
        ] {
            let mut payload = feed.payload.clone();
            payload["release"]["platforms"]["darwin-aarch64"][invalid_artifact.0] =
                invalid_artifact.1;
            assert_eq!(
                feed.verifier()
                    .verify_response(&signed_response(&feed.key_pair, &payload)),
                UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidPayload)
            );
        }
    }

    #[test]
    fn accepts_an_active_rotation_key_and_rejects_unknown_payload_fields() {
        let feed = SyntheticFeed::new();
        let next_key = KeyPair::generate_unencrypted_keypair().expect("next synthetic key pair");
        let next_public_key = BASE64.encode(
            next_key
                .pk
                .to_box()
                .expect("next synthetic public key box")
                .to_string(),
        );
        let mut response: Value =
            serde_json::from_slice(&signed_response(&next_key, &feed.payload))
                .expect("next-key envelope");
        response["fitfreed"]["keyId"] = Value::String("synthetic-next-key".to_owned());
        let verifier = SignedUpdateChannelVerifier::try_new(
            BTreeMap::from([
                ("synthetic-test-key".to_owned(), feed.public_key_base64),
                ("synthetic-next-key".to_owned(), next_public_key),
            ]),
            "darwin-aarch64".to_owned(),
        )
        .expect("synthetic rotation verifier");
        assert!(matches!(
            verifier.verify_response(&serde_json::to_vec(&response).expect("rotation envelope")),
            UpdateChannelRead::Authenticated(_)
        ));

        let mut extended_payload = feed.payload;
        extended_payload["unexpectedPolicy"] = json!(true);
        assert_eq!(
            verifier.verify_response(&signed_response(&feed.key_pair, &extended_payload)),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidPayload)
        );
    }

    #[test]
    fn rejects_invalid_trust_configuration_before_any_channel_read() {
        assert_eq!(
            SignedUpdateChannelVerifier::try_new(BTreeMap::new(), "darwin-aarch64".to_owned()),
            Err(UpdateVerifierConfigurationError::InvalidTrustedKeys)
        );
        assert_eq!(
            SignedUpdateChannelVerifier::try_new(
                BTreeMap::from([("invalid key id".to_owned(), "invalid".to_owned())]),
                "darwin-aarch64".to_owned(),
            ),
            Err(UpdateVerifierConfigurationError::InvalidTrustedKeys)
        );

        let feed = SyntheticFeed::new();
        assert_eq!(
            SignedUpdateChannelVerifier::try_new(
                BTreeMap::from([("synthetic-test-key".to_owned(), feed.public_key_base64,)]),
                "unsupported-target".to_owned(),
            ),
            Err(UpdateVerifierConfigurationError::UnsupportedTarget)
        );
    }
}
