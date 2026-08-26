#[cfg(target_os = "macos")]
use std::process::Command;
#[cfg(any(target_os = "macos", test))]
use std::{
    io::{Error, ErrorKind},
    process::Output,
};

use fitfreed_application::{
    ExpectedSourceArchive, LocalePreference, OfficialSourceLink, OfficialSourceLinkOpenError,
    OfficialSourceLinkOpenerPort, OfficialSourceLinkPurpose, SourceAcquisitionGuide,
    SourceAcquisitionGuidePort, SOURCE_ACQUISITION_GUIDE_SCHEMA_VERSION,
};
#[cfg(not(target_os = "macos"))]
use tauri_plugin_opener::Error as OpenerError;

pub struct PolarFlowSourceAcquisitionGuides;

pub struct NativeOfficialSourceLinkOpener;

impl OfficialSourceLinkOpenerPort for NativeOfficialSourceLinkOpener {
    fn open_official_source_link(&self, url: &str) -> Result<(), OfficialSourceLinkOpenError> {
        #[cfg(target_os = "macos")]
        {
            launch_macos_official_destination(&SystemPlatformDestinationLauncher, url)
        }
        #[cfg(not(target_os = "macos"))]
        {
            tauri_plugin_opener::open_url(url, None::<&str>).map_err(classify_opener_error)
        }
    }
}

#[cfg(any(target_os = "macos", test))]
trait PlatformDestinationLauncher {
    fn launch(&self, program: &str, arguments: &[&str]) -> Result<Output, Error>;
}

#[cfg(target_os = "macos")]
struct SystemPlatformDestinationLauncher;

#[cfg(target_os = "macos")]
impl PlatformDestinationLauncher for SystemPlatformDestinationLauncher {
    fn launch(&self, program: &str, arguments: &[&str]) -> Result<Output, Error> {
        Command::new(program).args(arguments).output()
    }
}

#[cfg(any(target_os = "macos", test))]
fn launch_macos_official_destination(
    launcher: &impl PlatformDestinationLauncher,
    url: &str,
) -> Result<(), OfficialSourceLinkOpenError> {
    let output = launcher
        .launch("/usr/bin/open", &["--", url])
        .map_err(classify_launcher_error)?;
    if output.status.success() {
        Ok(())
    } else {
        Err(OfficialSourceLinkOpenError::Delegation)
    }
}

#[cfg(any(target_os = "macos", test))]
fn classify_launcher_error(error: Error) -> OfficialSourceLinkOpenError {
    match error.kind() {
        ErrorKind::PermissionDenied => OfficialSourceLinkOpenError::PermissionDenied,
        ErrorKind::NotFound => OfficialSourceLinkOpenError::LauncherUnavailable,
        _ => OfficialSourceLinkOpenError::OperatingSystem,
    }
}

#[cfg(not(target_os = "macos"))]
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
    use std::{
        cell::RefCell,
        io::{Error, ErrorKind},
        os::unix::process::ExitStatusExt,
        process::{ExitStatus, Output},
    };

    use fitfreed_application::{
        query_source_acquisition_guides, ExpectedSourceArchive, LocalePreference,
        OfficialSourceLinkPurpose,
    };

    use super::*;

    struct ControlledPlatformLauncher {
        invocation: RefCell<Option<(String, Vec<String>)>>,
        result: RefCell<Option<Result<Output, Error>>>,
    }

    impl ControlledPlatformLauncher {
        fn succeeding() -> Self {
            Self::with_result(Ok(output(0)))
        }

        fn with_result(result: Result<Output, Error>) -> Self {
            Self {
                invocation: RefCell::new(None),
                result: RefCell::new(Some(result)),
            }
        }
    }

    impl PlatformDestinationLauncher for ControlledPlatformLauncher {
        fn launch(&self, program: &str, arguments: &[&str]) -> Result<Output, Error> {
            self.invocation.replace(Some((
                program.to_owned(),
                arguments.iter().map(|value| (*value).to_owned()).collect(),
            )));
            self.result
                .borrow_mut()
                .take()
                .expect("one controlled launch result")
        }
    }

    fn output(code: i32) -> Output {
        Output {
            status: ExitStatus::from_raw(code << 8),
            stdout: Vec::new(),
            stderr: Vec::new(),
        }
    }

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
    fn waits_for_the_macos_launcher_to_accept_the_exact_official_destination() {
        let launcher = ControlledPlatformLauncher::succeeding();

        launch_macos_official_destination(&launcher, "https://support.example.test/export")
            .expect("accepted destination");

        assert_eq!(
            launcher.invocation.into_inner(),
            Some((
                "/usr/bin/open".to_owned(),
                vec![
                    "--".to_owned(),
                    "https://support.example.test/export".to_owned(),
                ],
            ))
        );
    }

    #[test]
    fn rejects_a_launcher_process_that_does_not_accept_the_destination() {
        let launcher = ControlledPlatformLauncher::with_result(Ok(output(1)));

        assert_eq!(
            launch_macos_official_destination(&launcher, "https://support.example.test/export"),
            Err(OfficialSourceLinkOpenError::Delegation)
        );
    }

    #[test]
    fn preserves_actionable_native_launcher_failure_categories() {
        assert_eq!(
            classify_launcher_error(Error::from(ErrorKind::PermissionDenied)),
            OfficialSourceLinkOpenError::PermissionDenied
        );
        assert_eq!(
            classify_launcher_error(Error::from(ErrorKind::NotFound)),
            OfficialSourceLinkOpenError::LauncherUnavailable
        );
        assert_eq!(
            classify_launcher_error(Error::other("native failure")),
            OfficialSourceLinkOpenError::OperatingSystem
        );
    }
}
