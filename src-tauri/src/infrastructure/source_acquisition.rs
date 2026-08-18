use fitfreed_application::{
    ExpectedSourceArchive, LocalePreference, OfficialSourceLink, OfficialSourceLinkPurpose,
    SourceAcquisitionGuide, SourceAcquisitionGuidePort, SOURCE_ACQUISITION_GUIDE_SCHEMA_VERSION,
};

pub struct PolarFlowSourceAcquisitionGuides;

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
}
