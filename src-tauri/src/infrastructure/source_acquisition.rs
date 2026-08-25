use fitfreed_application::{
    ExpectedSourceArchive, LocalePreference, OfficialSourceLink, OfficialSourceLinkOpenError,
    OfficialSourceLinkOpenerPort, OfficialSourceLinkPurpose, SourceAcquisitionGuide,
    SourceAcquisitionGuidePort, SOURCE_ACQUISITION_GUIDE_SCHEMA_VERSION,
};
use tauri_plugin_opener::Error as OpenerError;

pub struct PolarFlowSourceAcquisitionGuides;

pub struct NativeOfficialSourceLinkOpener;

impl OfficialSourceLinkOpenerPort for NativeOfficialSourceLinkOpener {
    fn open_official_source_link(&self, url: &str) -> Result<(), OfficialSourceLinkOpenError> {
        tauri_plugin_opener::open_url(url, None::<&str>).map_err(classify_opener_error)
    }
}

fn classify_opener_error(error: OpenerError) -> OfficialSourceLinkOpenError {
    match error {
        OpenerError::UnsupportedPlatform => OfficialSourceLinkOpenError::UnsupportedPlatform,
        OpenerError::Io(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
            OfficialSourceLinkOpenError::PermissionDenied
        }
        OpenerError::Io(error) if error.kind() == std::io::ErrorKind::NotFound => {
            OfficialSourceLinkOpenError::LauncherUnavailable
        }
        OpenerError::Io(_) => OfficialSourceLinkOpenError::OperatingSystem,
        _ => OfficialSourceLinkOpenError::Delegation,
    }
}

impl SourceAcquisitionGuidePort for PolarFlowSourceAcquisitionGuides {
    fn source_acquisition_guides(&self) -> Result<Vec<SourceAcquisitionGuide>, String> {
        Ok(vec![SourceAcquisitionGuide {
            schema_version: SOURCE_ACQUISITION_GUIDE_SCHEMA_VERSION,
            source_id: "polar-flow".to_owned(),
            guide_version: "polar-flow-export-acquisition@1".to_owned(),
            verified_on: "2026-08-18".to_owned(),
            expected_archive: ExpectedSourceArchive::Zip,
            instruction_keys: [
                "sign-in",
                "open-download-data",
                "request-export",
                "wait-for-email",
                "download-zip",
            ]
            .map(str::to_owned)
            .to_vec(),
            constraint_keys: [
                "preparation-time-varies",
                "two-week-download-window",
                "derived-data-excluded",
            ]
            .map(str::to_owned)
            .to_vec(),
            troubleshooting_keys: ["email-delivery", "expired-download", "archive-format"]
                .map(str::to_owned)
                .to_vec(),
            official_links: vec![
                OfficialSourceLink {
                    purpose: OfficialSourceLinkPurpose::Account,
                    locale: None,
                    url: "https://account.polar.com/".to_owned(),
                },
                OfficialSourceLink {
                    purpose: OfficialSourceLinkPurpose::Instructions,
                    locale: Some(LocalePreference::EnUs),
                    url:
                        "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow"
                            .to_owned(),
                },
                OfficialSourceLink {
                    purpose: OfficialSourceLinkPurpose::Instructions,
                    locale: Some(LocalePreference::EsEs),
                    url:
                        "https://support.polar.com/es/how-to-download-all-your-data-from-polar-flow"
                            .to_owned(),
                },
            ],
        }])
    }
}

#[cfg(test)]
mod tests {
    use std::io::{Error, ErrorKind};

    use fitfreed_application::{
        query_source_acquisition_guides, ExpectedSourceArchive, LocalePreference,
        OfficialSourceLinkPurpose,
    };

    use super::*;

    #[test]
    fn supplies_the_verified_offline_polar_flow_acquisition_guide() {
        let guides = query_source_acquisition_guides(&PolarFlowSourceAcquisitionGuides)
            .expect("valid source acquisition guide");

        assert_eq!(guides.len(), 1);
        let guide = &guides[0];
        assert_eq!(guide.source_id, "polar-flow");
        assert_eq!(guide.guide_version, "polar-flow-export-acquisition@1");
        assert_eq!(guide.verified_on, "2026-08-18");
        assert_eq!(guide.expected_archive, ExpectedSourceArchive::Zip);
        assert_eq!(
            guide.instruction_keys,
            [
                "sign-in",
                "open-download-data",
                "request-export",
                "wait-for-email",
                "download-zip",
            ]
        );
        assert_eq!(
            guide.constraint_keys,
            [
                "preparation-time-varies",
                "two-week-download-window",
                "derived-data-excluded",
            ]
        );
        assert_eq!(
            guide.troubleshooting_keys,
            ["email-delivery", "expired-download", "archive-format"]
        );
        assert!(guide.official_links.iter().any(|link| {
            link.purpose == OfficialSourceLinkPurpose::Account
                && link.locale.is_none()
                && link.url == "https://account.polar.com/"
        }));
        for (locale, url) in [
            (
                LocalePreference::EnUs,
                "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow",
            ),
            (
                LocalePreference::EsEs,
                "https://support.polar.com/es/how-to-download-all-your-data-from-polar-flow",
            ),
        ] {
            assert!(guide.official_links.iter().any(|link| {
                link.purpose == OfficialSourceLinkPurpose::Instructions
                    && link.locale == Some(locale)
                    && link.url == url
            }));
        }
    }

    #[test]
    fn preserves_actionable_native_opener_failure_categories() {
        assert_eq!(
            classify_opener_error(OpenerError::UnsupportedPlatform),
            OfficialSourceLinkOpenError::UnsupportedPlatform
        );
        assert_eq!(
            classify_opener_error(OpenerError::Io(Error::from(ErrorKind::PermissionDenied))),
            OfficialSourceLinkOpenError::PermissionDenied
        );
        assert_eq!(
            classify_opener_error(OpenerError::Io(Error::from(ErrorKind::NotFound))),
            OfficialSourceLinkOpenError::LauncherUnavailable
        );
        assert_eq!(
            classify_opener_error(OpenerError::Io(Error::other("native failure"))),
            OfficialSourceLinkOpenError::OperatingSystem
        );
        assert_eq!(
            classify_opener_error(OpenerError::Json(
                serde_json::from_str::<serde_json::Value>("{").expect_err("invalid JSON"),
            )),
            OfficialSourceLinkOpenError::Delegation
        );
    }
}
