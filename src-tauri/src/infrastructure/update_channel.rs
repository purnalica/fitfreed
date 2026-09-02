use std::{collections::BTreeMap, io::Read, time::Duration};

use fitfreed_application::{UpdateChannelPort, UpdateChannelRead, UpdateTrustFailure};
use reqwest::{blocking::Client, redirect::Policy, Certificate};
use thiserror::Error;
use url::Url;

use super::update::{
    SignedUpdateChannelVerifier, UpdateVerifierConfigurationError, MAX_UPDATE_RESPONSE_BYTES,
};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_ENDPOINT_BYTES: usize = 2_048;

pub struct HttpsUpdateChannel {
    configured: Option<ConfiguredUpdateChannel>,
}

struct ConfiguredUpdateChannel {
    endpoint: Url,
    verifier: SignedUpdateChannelVerifier,
    transport: Box<dyn UpdateHttpTransport>,
    additional_root_certificate: Option<Vec<u8>>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UpdateChannelConfigurationError {
    #[error("the update endpoint is invalid")]
    InvalidEndpoint,
    #[error("the update trust configuration is invalid")]
    InvalidTrust,
    #[error("the current update target is unsupported")]
    UnsupportedTarget,
    #[error("the HTTPS update client could not be created")]
    ClientUnavailable,
}

impl HttpsUpdateChannel {
    pub fn unconfigured() -> Self {
        Self { configured: None }
    }

    pub fn configured(
        endpoint: &str,
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
    ) -> Result<Self, UpdateChannelConfigurationError> {
        let endpoint = parse_static_https_endpoint(endpoint)?;
        let verifier = configured_verifier(trusted_public_keys, current_target)?;
        let transport = ReqwestUpdateTransport::new(None)?;
        Ok(Self::from_configured(
            endpoint,
            verifier,
            Box::new(transport),
            None,
        ))
    }

    pub fn configured_stable(
        endpoint: &str,
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
    ) -> Result<Self, UpdateChannelConfigurationError> {
        let endpoint = parse_static_https_endpoint(endpoint)?;
        let verifier =
            SignedUpdateChannelVerifier::try_new_for_stable(trusted_public_keys, current_target)
                .map_err(map_verifier_configuration_error)?;
        let transport = ReqwestUpdateTransport::new(None)?;
        Ok(Self::from_configured(
            endpoint,
            verifier,
            Box::new(transport),
            None,
        ))
    }

    pub fn configured_recoverable_stable(
        endpoint: &str,
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
    ) -> Result<Self, UpdateChannelConfigurationError> {
        let endpoint = parse_static_https_endpoint(endpoint)?;
        let verifier = SignedUpdateChannelVerifier::try_new_for_recoverable_stable(
            trusted_public_keys,
            current_target,
        )
        .map_err(map_verifier_configuration_error)?;
        let transport = ReqwestUpdateTransport::new(None)?;
        Ok(Self::from_configured(
            endpoint,
            verifier,
            Box::new(transport),
            None,
        ))
    }

    #[cfg(feature = "e2e")]
    pub fn configured_for_instrumented_e2e(
        endpoint: &str,
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
        additional_root_certificate: Vec<u8>,
    ) -> Result<Self, UpdateChannelConfigurationError> {
        let endpoint = parse_static_https_endpoint(endpoint)?;
        let verifier = configured_verifier(trusted_public_keys, current_target)?;
        let transport = ReqwestUpdateTransport::new(Some(&additional_root_certificate))?;
        Ok(Self::from_configured(
            endpoint,
            verifier,
            Box::new(transport),
            Some(additional_root_certificate),
        ))
    }

    #[cfg(feature = "e2e")]
    pub fn configured_stable_for_instrumented_e2e(
        endpoint: &str,
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
        additional_root_certificate: Vec<u8>,
    ) -> Result<Self, UpdateChannelConfigurationError> {
        let endpoint = parse_static_https_endpoint(endpoint)?;
        let verifier =
            SignedUpdateChannelVerifier::try_new_for_stable(trusted_public_keys, current_target)
                .map_err(map_verifier_configuration_error)?;
        let transport = ReqwestUpdateTransport::new(Some(&additional_root_certificate))?;
        Ok(Self::from_configured(
            endpoint,
            verifier,
            Box::new(transport),
            Some(additional_root_certificate),
        ))
    }

    #[cfg(feature = "e2e")]
    pub fn configured_recoverable_stable_for_instrumented_e2e(
        endpoint: &str,
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
        additional_root_certificate: Vec<u8>,
    ) -> Result<Self, UpdateChannelConfigurationError> {
        let endpoint = parse_static_https_endpoint(endpoint)?;
        let verifier = SignedUpdateChannelVerifier::try_new_for_recoverable_stable(
            trusted_public_keys,
            current_target,
        )
        .map_err(map_verifier_configuration_error)?;
        let transport = ReqwestUpdateTransport::new(Some(&additional_root_certificate))?;
        Ok(Self::from_configured(
            endpoint,
            verifier,
            Box::new(transport),
            Some(additional_root_certificate),
        ))
    }

    #[cfg(test)]
    fn configured_with_transport(
        endpoint: &str,
        trusted_public_keys: BTreeMap<String, String>,
        current_target: String,
        transport: Box<dyn UpdateHttpTransport>,
    ) -> Result<Self, UpdateChannelConfigurationError> {
        let endpoint = parse_static_https_endpoint(endpoint)?;
        let verifier = configured_verifier(trusted_public_keys, current_target)?;
        Ok(Self::from_configured(endpoint, verifier, transport, None))
    }

    fn from_configured(
        endpoint: Url,
        verifier: SignedUpdateChannelVerifier,
        transport: Box<dyn UpdateHttpTransport>,
        additional_root_certificate: Option<Vec<u8>>,
    ) -> Self {
        Self {
            configured: Some(ConfiguredUpdateChannel {
                endpoint,
                verifier,
                transport,
                additional_root_certificate,
            }),
        }
    }

    pub(crate) fn package_public_key(&self, key_id: &str) -> Option<&str> {
        self.configured
            .as_ref()?
            .verifier
            .trusted_public_key(key_id)
    }

    pub(crate) fn package_root_certificate(&self) -> Option<&[u8]> {
        self.configured
            .as_ref()?
            .additional_root_certificate
            .as_deref()
    }
}

impl UpdateChannelPort for HttpsUpdateChannel {
    fn fetch_update_snapshot(&self) -> Result<UpdateChannelRead, String> {
        let Some(configured) = self.configured.as_ref() else {
            return Ok(UpdateChannelRead::Unconfigured);
        };
        Ok(
            match configured.transport.get_bounded(&configured.endpoint) {
                UpdateTransportRead::Unavailable => UpdateChannelRead::Offline,
                UpdateTransportRead::ResponseTooLarge => {
                    UpdateChannelRead::Untrusted(UpdateTrustFailure::ResponseTooLarge)
                }
                UpdateTransportRead::Body(body) => configured.verifier.verify_response(&body),
            },
        )
    }
}

pub fn current_update_target() -> Result<String, UpdateChannelConfigurationError> {
    update_target(std::env::consts::OS, std::env::consts::ARCH)
}

fn update_target(
    operating_system: &str,
    architecture: &str,
) -> Result<String, UpdateChannelConfigurationError> {
    match (operating_system, architecture) {
        ("macos", "aarch64") => Ok("darwin-aarch64".to_owned()),
        ("macos", "x86_64") => Ok("darwin-x86_64".to_owned()),
        ("linux", "x86_64") => Ok("linux-x86_64-deb".to_owned()),
        ("windows", "x86_64") => Ok("windows-x86_64-nsis".to_owned()),
        _ => Err(UpdateChannelConfigurationError::UnsupportedTarget),
    }
}

fn parse_static_https_endpoint(value: &str) -> Result<Url, UpdateChannelConfigurationError> {
    if value.len() > MAX_ENDPOINT_BYTES {
        return Err(UpdateChannelConfigurationError::InvalidEndpoint);
    }
    let endpoint =
        Url::parse(value).map_err(|_| UpdateChannelConfigurationError::InvalidEndpoint)?;
    if endpoint.scheme() != "https"
        || !endpoint.has_host()
        || !endpoint.username().is_empty()
        || endpoint.password().is_some()
        || endpoint.query().is_some()
        || endpoint.fragment().is_some()
    {
        return Err(UpdateChannelConfigurationError::InvalidEndpoint);
    }
    Ok(endpoint)
}

fn configured_verifier(
    trusted_public_keys: BTreeMap<String, String>,
    current_target: String,
) -> Result<SignedUpdateChannelVerifier, UpdateChannelConfigurationError> {
    SignedUpdateChannelVerifier::try_new(trusted_public_keys, current_target)
        .map_err(map_verifier_configuration_error)
}

fn map_verifier_configuration_error(
    error: UpdateVerifierConfigurationError,
) -> UpdateChannelConfigurationError {
    match error {
        UpdateVerifierConfigurationError::InvalidTrustedKeys => {
            UpdateChannelConfigurationError::InvalidTrust
        }
        UpdateVerifierConfigurationError::UnsupportedTarget => {
            UpdateChannelConfigurationError::UnsupportedTarget
        }
    }
}

trait UpdateHttpTransport: Send + Sync {
    fn get_bounded(&self, endpoint: &Url) -> UpdateTransportRead;
}

struct ReqwestUpdateTransport(Client);

impl ReqwestUpdateTransport {
    fn new(
        additional_root_certificate: Option<&[u8]>,
    ) -> Result<Self, UpdateChannelConfigurationError> {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let mut builder = Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .redirect(Policy::none())
            .tls_sslkeylogfile(false);
        if let Some(pem) = additional_root_certificate {
            let certificate = parse_single_root_certificate(pem)?;
            builder = builder.add_root_certificate(certificate);
        }
        builder
            .build()
            .map(Self)
            .map_err(|_| UpdateChannelConfigurationError::ClientUnavailable)
    }
}

fn parse_single_root_certificate(
    pem: &[u8],
) -> Result<Certificate, UpdateChannelConfigurationError> {
    let mut certificates = Certificate::from_pem_bundle(pem)
        .map_err(|_| UpdateChannelConfigurationError::InvalidTrust)?;
    if certificates.len() != 1 {
        return Err(UpdateChannelConfigurationError::InvalidTrust);
    }
    certificates
        .pop()
        .ok_or(UpdateChannelConfigurationError::InvalidTrust)
}

impl UpdateHttpTransport for ReqwestUpdateTransport {
    fn get_bounded(&self, endpoint: &Url) -> UpdateTransportRead {
        let response = match self.0.get(endpoint.clone()).send() {
            Ok(response) if response.status().is_success() => response,
            Ok(_) | Err(_) => return UpdateTransportRead::Unavailable,
        };
        let content_length = response.content_length();
        read_bounded_body(response, content_length)
    }
}

#[derive(Debug, PartialEq, Eq)]
enum UpdateTransportRead {
    Unavailable,
    ResponseTooLarge,
    Body(Vec<u8>),
}

fn read_bounded_body(reader: impl Read, content_length: Option<u64>) -> UpdateTransportRead {
    if content_length.is_some_and(|length| length > MAX_UPDATE_RESPONSE_BYTES as u64) {
        return UpdateTransportRead::ResponseTooLarge;
    }
    let capacity = content_length
        .and_then(|length| usize::try_from(length).ok())
        .unwrap_or_default()
        .min(MAX_UPDATE_RESPONSE_BYTES);
    let mut body = Vec::with_capacity(capacity);
    if reader
        .take((MAX_UPDATE_RESPONSE_BYTES + 1) as u64)
        .read_to_end(&mut body)
        .is_err()
    {
        return UpdateTransportRead::Unavailable;
    }
    if body.len() > MAX_UPDATE_RESPONSE_BYTES {
        UpdateTransportRead::ResponseTooLarge
    } else {
        UpdateTransportRead::Body(body)
    }
}

#[cfg(test)]
mod tests {
    use std::{
        collections::BTreeMap,
        io::{self, Cursor, Read},
        sync::Mutex,
    };

    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    use fitfreed_application::{UpdateChannelPort, UpdateChannelRead, UpdateTrustFailure};
    use minisign::KeyPair;

    use super::*;

    fn synthetic_trust() -> BTreeMap<String, String> {
        let key_pair = KeyPair::generate_unencrypted_keypair().expect("synthetic key pair");
        let public_key = key_pair
            .pk
            .to_box()
            .expect("synthetic public key box")
            .to_string();
        BTreeMap::from([("synthetic-test-key".to_owned(), BASE64.encode(public_key))])
    }

    struct ControlledTransport {
        next: Mutex<Option<UpdateTransportRead>>,
    }

    impl ControlledTransport {
        fn returning(result: UpdateTransportRead) -> Self {
            Self {
                next: Mutex::new(Some(result)),
            }
        }
    }

    impl UpdateHttpTransport for ControlledTransport {
        fn get_bounded(&self, _endpoint: &url::Url) -> UpdateTransportRead {
            self.next
                .lock()
                .expect("controlled transport")
                .take()
                .expect("one controlled response")
        }
    }

    #[test]
    fn leaves_an_ordinary_channel_unconfigured_without_network_access() {
        let channel = HttpsUpdateChannel::unconfigured();

        assert_eq!(
            channel.fetch_update_snapshot().expect("channel outcome"),
            UpdateChannelRead::Unconfigured
        );
        assert_eq!(channel.package_public_key("synthetic-test-key"), None);
    }

    #[test]
    fn maps_only_the_supported_packaged_platform_targets() {
        assert_eq!(
            update_target("macos", "aarch64").expect("Apple Silicon target"),
            "darwin-aarch64"
        );
        assert_eq!(
            update_target("linux", "x86_64").expect("Debian target"),
            "linux-x86_64-deb"
        );
        assert_eq!(
            update_target("windows", "x86_64").expect("NSIS target"),
            "windows-x86_64-nsis"
        );
        assert_eq!(
            update_target("linux", "aarch64"),
            Err(UpdateChannelConfigurationError::UnsupportedTarget)
        );
    }

    #[test]
    fn resolves_only_a_configured_active_package_signing_key() {
        let trust = synthetic_trust();
        let expected_key = trust["synthetic-test-key"].clone();
        let channel = HttpsUpdateChannel::configured_with_transport(
            "https://updates.invalid/private-alpha.json",
            trust,
            "darwin-aarch64".to_owned(),
            Box::new(ControlledTransport::returning(
                UpdateTransportRead::Unavailable,
            )),
        )
        .expect("configured channel");

        assert_eq!(
            channel.package_public_key("synthetic-test-key"),
            Some(expected_key.as_str())
        );
        assert_eq!(channel.package_public_key("unknown-test-key"), None);
        assert_eq!(channel.package_root_certificate(), None);
    }

    #[test]
    fn creates_a_stable_channel_from_public_build_trust() {
        let trust = synthetic_trust();
        let expected_key = trust["synthetic-test-key"].clone();
        let channel = HttpsUpdateChannel::configured_stable(
            "https://updates.invalid/stable.json",
            trust,
            "darwin-aarch64".to_owned(),
        )
        .expect("configured stable channel");

        assert_eq!(
            channel.package_public_key("synthetic-test-key"),
            Some(expected_key.as_str())
        );
        assert_eq!(channel.package_root_certificate(), None);

        let recoverable_channel = HttpsUpdateChannel::configured_recoverable_stable(
            "https://updates.invalid/stable.json",
            synthetic_trust(),
            "linux-x86_64-deb".to_owned(),
        )
        .expect("configured recoverable stable channel");
        assert!(recoverable_channel
            .package_public_key("synthetic-test-key")
            .is_some());
        assert_eq!(recoverable_channel.package_root_certificate(), None);
    }

    #[cfg(feature = "e2e")]
    #[test]
    fn rejects_an_invalid_instrumented_https_root_certificate() {
        assert!(matches!(
            HttpsUpdateChannel::configured_for_instrumented_e2e(
                "https://127.0.0.1:38473/private-alpha.json",
                synthetic_trust(),
                "darwin-aarch64".to_owned(),
                b"not a certificate".to_vec(),
            ),
            Err(UpdateChannelConfigurationError::InvalidTrust)
        ));
    }

    #[test]
    fn rejects_non_static_or_non_https_endpoint_configuration() {
        for endpoint in [
            "http://updates.invalid/private-alpha.json".to_owned(),
            ["https://user", "@updates.invalid/private-alpha.json"].concat(),
            "https://updates.invalid/private-alpha.json?version=0.1.0".to_owned(),
            "https://updates.invalid/private-alpha.json#fragment".to_owned(),
            "not-a-url".to_owned(),
        ] {
            assert!(matches!(
                HttpsUpdateChannel::configured(
                    &endpoint,
                    synthetic_trust(),
                    "darwin-aarch64".to_owned(),
                ),
                Err(UpdateChannelConfigurationError::InvalidEndpoint)
            ));
        }

        assert!(matches!(
            HttpsUpdateChannel::configured(
                "https://updates.invalid/private-alpha.json",
                BTreeMap::new(),
                "darwin-aarch64".to_owned(),
            ),
            Err(UpdateChannelConfigurationError::InvalidTrust)
        ));
        assert!(matches!(
            HttpsUpdateChannel::configured(
                "https://updates.invalid/private-alpha.json",
                synthetic_trust(),
                "unsupported-target".to_owned(),
            ),
            Err(UpdateChannelConfigurationError::UnsupportedTarget)
        ));
    }

    #[test]
    fn maps_transport_failures_and_bounded_responses_without_leaking_details() {
        let offline = HttpsUpdateChannel::configured_with_transport(
            "https://updates.invalid/private-alpha.json",
            synthetic_trust(),
            "darwin-aarch64".to_owned(),
            Box::new(ControlledTransport::returning(
                UpdateTransportRead::Unavailable,
            )),
        )
        .expect("offline channel");
        assert_eq!(
            offline.fetch_update_snapshot().expect("offline outcome"),
            UpdateChannelRead::Offline
        );

        let oversized = HttpsUpdateChannel::configured_with_transport(
            "https://updates.invalid/private-alpha.json",
            synthetic_trust(),
            "darwin-aarch64".to_owned(),
            Box::new(ControlledTransport::returning(
                UpdateTransportRead::ResponseTooLarge,
            )),
        )
        .expect("oversized channel");
        assert_eq!(
            oversized
                .fetch_update_snapshot()
                .expect("oversized outcome"),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::ResponseTooLarge)
        );

        let malformed = HttpsUpdateChannel::configured_with_transport(
            "https://updates.invalid/private-alpha.json",
            synthetic_trust(),
            "darwin-aarch64".to_owned(),
            Box::new(ControlledTransport::returning(UpdateTransportRead::Body(
                br#"{}"#.to_vec(),
            ))),
        )
        .expect("malformed channel");
        assert_eq!(
            malformed
                .fetch_update_snapshot()
                .expect("malformed outcome"),
            UpdateChannelRead::Untrusted(UpdateTrustFailure::InvalidEnvelope)
        );
    }

    struct FailingReader;

    impl Read for FailingReader {
        fn read(&mut self, _buffer: &mut [u8]) -> io::Result<usize> {
            Err(io::Error::other("synthetic read failure"))
        }
    }

    #[test]
    fn bounds_streamed_bodies_even_without_a_content_length() {
        assert_eq!(
            read_bounded_body(FailingReader, Some((MAX_UPDATE_RESPONSE_BYTES + 1) as u64)),
            UpdateTransportRead::ResponseTooLarge
        );
        assert_eq!(
            read_bounded_body(FailingReader, None),
            UpdateTransportRead::Unavailable
        );

        let exact = vec![b'x'; MAX_UPDATE_RESPONSE_BYTES];
        assert_eq!(
            read_bounded_body(Cursor::new(&exact), None),
            UpdateTransportRead::Body(exact)
        );
        assert_eq!(
            read_bounded_body(Cursor::new(vec![b'x'; MAX_UPDATE_RESPONSE_BYTES + 1]), None,),
            UpdateTransportRead::ResponseTooLarge
        );
    }
}
