use std::collections::BTreeSet;

use chrono::NaiveDate;
use url::Url;

use crate::{ApplicationError, LocalePreference};

pub const SOURCE_ACQUISITION_GUIDE_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExpectedSourceArchive {
    Zip,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OfficialSourceLinkPurpose {
    Account,
    Instructions,
}

impl OfficialSourceLinkPurpose {
    const fn code(self) -> &'static str {
        match self {
            Self::Account => "account",
            Self::Instructions => "instructions",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OfficialSourceLink {
    pub purpose: OfficialSourceLinkPurpose,
    pub locale: Option<LocalePreference>,
    pub url: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SourceAcquisitionGuide {
    pub schema_version: u32,
    pub source_id: String,
    pub guide_version: String,
    pub verified_on: String,
    pub expected_archive: ExpectedSourceArchive,
    pub instruction_keys: Vec<String>,
    pub constraint_keys: Vec<String>,
    pub troubleshooting_keys: Vec<String>,
    pub official_links: Vec<OfficialSourceLink>,
}

pub trait SourceAcquisitionGuidePort {
    fn source_acquisition_guides(&self) -> Result<Vec<SourceAcquisitionGuide>, String>;
}

pub fn query_source_acquisition_guides(
    port: &impl SourceAcquisitionGuidePort,
) -> Result<Vec<SourceAcquisitionGuide>, ApplicationError> {
    let mut guides = port
        .source_acquisition_guides()
        .map_err(ApplicationError::SourceAcquisitionGuideQuery)?;
    let mut source_ids = BTreeSet::new();
    for guide in &guides {
        validate_guide(guide)?;
        if !source_ids.insert(guide.source_id.as_str()) {
            return invalid_guide("source identifiers must be unique");
        }
    }
    guides.sort_by(|left, right| left.source_id.cmp(&right.source_id));
    Ok(guides)
}

fn validate_guide(guide: &SourceAcquisitionGuide) -> Result<(), ApplicationError> {
    if guide.schema_version != SOURCE_ACQUISITION_GUIDE_SCHEMA_VERSION {
        return invalid_guide("schema version is unsupported");
    }
    if guide.source_id.len() > 64 || !is_lower_identifier(&guide.source_id, &['-']) {
        return invalid_guide("source identifier is invalid");
    }
    if guide.guide_version.len() > 96 || !is_versioned_identifier(&guide.guide_version) {
        return invalid_guide("guide version is invalid");
    }
    if NaiveDate::parse_from_str(&guide.verified_on, "%Y-%m-%d").is_err() {
        return invalid_guide("verification date is invalid");
    }
    validate_content_keys(&guide.instruction_keys, 1, 32, "instructions")?;
    validate_content_keys(&guide.constraint_keys, 0, 16, "constraints")?;
    validate_content_keys(&guide.troubleshooting_keys, 1, 16, "troubleshooting")?;
    validate_links(&guide.official_links)
}

fn validate_content_keys(
    keys: &[String],
    minimum: usize,
    maximum: usize,
    collection: &'static str,
) -> Result<(), ApplicationError> {
    if keys.len() < minimum || keys.len() > maximum {
        return invalid_guide(format!("{collection} collection size is invalid"));
    }
    let mut identities = BTreeSet::new();
    for key in keys {
        if key.len() > 96 || !is_lower_identifier(key, &['-', '.']) {
            return invalid_guide(format!("{collection} content key is invalid"));
        }
        if !identities.insert(key.as_str()) {
            return invalid_guide(format!("{collection} content keys must be unique"));
        }
    }
    Ok(())
}

fn validate_links(links: &[OfficialSourceLink]) -> Result<(), ApplicationError> {
    if links.is_empty() || links.len() > 16 {
        return invalid_guide("official link collection size is invalid");
    }
    let mut identities = BTreeSet::new();
    let mut has_instructions = false;
    for link in links {
        if link.url.len() > 2048 {
            return invalid_guide("official link URL is too long");
        }
        let parsed = Url::parse(&link.url)
            .map_err(|_| invalid_guide_error("official link URL is invalid"))?;
        if parsed.scheme() != "https"
            || parsed.host_str().is_none()
            || !parsed.username().is_empty()
            || parsed.password().is_some()
        {
            return invalid_guide("official link URL must be an uncredentialed HTTPS URL");
        }
        let identity = (link.purpose.code(), link.locale.map(LocalePreference::code));
        if !identities.insert(identity) {
            return invalid_guide("official link identities must be unique");
        }
        has_instructions |= link.purpose == OfficialSourceLinkPurpose::Instructions;
    }
    if !has_instructions {
        return invalid_guide("an official instructions link is required");
    }
    Ok(())
}

fn is_versioned_identifier(value: &str) -> bool {
    let Some((identifier, version)) = value.rsplit_once('@') else {
        return false;
    };
    is_lower_identifier(identifier, &['-'])
        && version.starts_with(|character: char| character.is_ascii_digit() && character != '0')
        && version.chars().all(|character| character.is_ascii_digit())
}

fn is_lower_identifier(value: &str, separators: &[char]) -> bool {
    value.starts_with(|character: char| character.is_ascii_lowercase())
        && value
            .split(|character| separators.contains(&character))
            .all(|segment| {
                !segment.is_empty()
                    && segment.chars().all(|character| {
                        character.is_ascii_lowercase() || character.is_ascii_digit()
                    })
            })
}

fn invalid_guide<T>(reason: impl Into<String>) -> Result<T, ApplicationError> {
    Err(invalid_guide_error(reason))
}

fn invalid_guide_error(reason: impl Into<String>) -> ApplicationError {
    ApplicationError::SourceAcquisitionGuideQuery(reason.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct ControlledGuidePort {
        result: Result<Vec<SourceAcquisitionGuide>, String>,
    }

    impl SourceAcquisitionGuidePort for ControlledGuidePort {
        fn source_acquisition_guides(&self) -> Result<Vec<SourceAcquisitionGuide>, String> {
            self.result.clone()
        }
    }

    fn guide(source_id: &str) -> SourceAcquisitionGuide {
        SourceAcquisitionGuide {
            schema_version: SOURCE_ACQUISITION_GUIDE_SCHEMA_VERSION,
            source_id: source_id.to_owned(),
            guide_version: format!("{source_id}-acquisition@1"),
            verified_on: "2026-01-15".to_owned(),
            expected_archive: ExpectedSourceArchive::Zip,
            instruction_keys: vec!["open-account".to_owned(), "request-export".to_owned()],
            constraint_keys: vec!["delivery-time-varies".to_owned()],
            troubleshooting_keys: vec!["email-not-received".to_owned()],
            official_links: vec![
                OfficialSourceLink {
                    purpose: OfficialSourceLinkPurpose::Account,
                    locale: None,
                    url: "https://account.example.test/".to_owned(),
                },
                OfficialSourceLink {
                    purpose: OfficialSourceLinkPurpose::Instructions,
                    locale: Some(LocalePreference::EnUs),
                    url: "https://support.example.test/en/export".to_owned(),
                },
            ],
        }
    }

    #[test]
    fn validates_and_sorts_adapter_owned_guides() {
        let guides = query_source_acquisition_guides(&ControlledGuidePort {
            result: Ok(vec![guide("synthetic-z"), guide("synthetic-a")]),
        })
        .expect("source acquisition guides");

        assert_eq!(guides.len(), 2);
        assert_eq!(guides[0].source_id, "synthetic-a");
        assert_eq!(guides[1].source_id, "synthetic-z");
    }

    #[test]
    fn rejects_invalid_or_ambiguous_guidance_as_a_complete_query() {
        let mut unsupported_schema = guide("synthetic-a");
        unsupported_schema.schema_version = 2;
        let mut duplicate_key = guide("synthetic-a");
        duplicate_key
            .instruction_keys
            .push("open-account".to_owned());
        let mut invalid_date = guide("synthetic-a");
        invalid_date.verified_on = "2026-02-30".to_owned();
        let mut insecure_link = guide("synthetic-a");
        insecure_link.official_links[0].url = "http://account.example.test/".to_owned();
        let mut duplicate_link_identity = guide("synthetic-a");
        duplicate_link_identity
            .official_links
            .push(OfficialSourceLink {
                purpose: OfficialSourceLinkPurpose::Instructions,
                locale: Some(LocalePreference::EnUs),
                url: "https://support.example.test/duplicate".to_owned(),
            });
        let mut credentialed_link = guide("synthetic-a");
        credentialed_link.official_links[0].url =
            format!("https://account:secret{}example.test/", char::from(64),);
        let mut account_only = guide("synthetic-a");
        account_only
            .official_links
            .retain(|link| link.purpose == OfficialSourceLinkPurpose::Account);
        let mut oversize_link = guide("synthetic-a");
        oversize_link.official_links[0].url = format!("https://example.test/{}", "a".repeat(2048));

        for guides in [
            vec![unsupported_schema],
            vec![duplicate_key],
            vec![invalid_date],
            vec![insecure_link],
            vec![duplicate_link_identity],
            vec![credentialed_link],
            vec![account_only],
            vec![oversize_link],
            vec![guide("synthetic-a"), guide("synthetic-a")],
        ] {
            assert!(matches!(
                query_source_acquisition_guides(&ControlledGuidePort { result: Ok(guides) }),
                Err(ApplicationError::SourceAcquisitionGuideQuery(_))
            ));
        }
    }

    #[test]
    fn reports_adapter_failures_without_returning_partial_guidance() {
        assert!(matches!(
            query_source_acquisition_guides(&ControlledGuidePort {
                result: Err("source unavailable".to_owned()),
            }),
            Err(ApplicationError::SourceAcquisitionGuideQuery(_))
        ));
    }
}
