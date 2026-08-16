use std::sync::LazyLock;

use fitfreed_domain::ArtifactClassification;
use regex::Regex;

const DATE_PATTERN: &str = r"[0-9]{4}-[0-9]{2}-[0-9]{2}";
const DATE_LENGTH: usize = 10;
const TIME_PATTERN: &str = r"[0-9]{2}-[0-9]{2}-[0-9]{2}";
const NUMERIC_PATTERN: &str = r"[0-9]+";
const UUID_PATTERN: &str =
    r"[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum SupportedArtifact {
    AccountData,
    DailyActivity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ArtifactAssessment {
    pub family: Option<&'static str>,
    pub classification: ArtifactClassification,
    pub reason_code: &'static str,
    pub supported_artifact: Option<SupportedArtifact>,
}

struct ArtifactRule {
    pattern: Regex,
    assessment: ArtifactAssessment,
}

impl ArtifactRule {
    fn new(
        pattern: String,
        family: &'static str,
        classification: ArtifactClassification,
        reason_code: &'static str,
        supported_artifact: Option<SupportedArtifact>,
    ) -> Self {
        Self {
            pattern: Regex::new(&pattern).expect("valid Polar Flow artifact grammar"),
            assessment: ArtifactAssessment {
                family: Some(family),
                classification,
                reason_code,
                supported_artifact,
            },
        }
    }
}

fn rule(
    pattern: String,
    family: &'static str,
    classification: ArtifactClassification,
) -> ArtifactRule {
    let reason_code = match classification {
        ArtifactClassification::Supported => "mapped",
        ArtifactClassification::Unsupported => "known-family-not-yet-supported",
        ArtifactClassification::DeliberatelyIgnored => "excluded-from-mvp",
        ArtifactClassification::Unrecognized | ArtifactClassification::Invalid => {
            unreachable!("registry rules describe known valid families")
        }
    };
    ArtifactRule::new(pattern, family, classification, reason_code, None)
}

fn supported_rule(
    pattern: String,
    family: &'static str,
    supported_artifact: SupportedArtifact,
    reason_code: &'static str,
) -> ArtifactRule {
    ArtifactRule::new(
        pattern,
        family,
        ArtifactClassification::Supported,
        reason_code,
        Some(supported_artifact),
    )
}

static ARTIFACT_RULES: LazyLock<Vec<ArtifactRule>> = LazyLock::new(|| {
    use ArtifactClassification::{DeliberatelyIgnored, Unsupported};

    vec![
        supported_rule(
            format!(r"^activity-{DATE_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-daily-activity",
            SupportedArtifact::DailyActivity,
            "mapped",
        ),
        supported_rule(
            format!(r"^account-data-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-account-data",
            SupportedArtifact::AccountData,
            "source-subject-claim",
        ),
        ArtifactRule::new(
            format!(r"^account-profile-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-account-profile",
            DeliberatelyIgnored,
            "mvp-excludes-sensitive-profile",
            None,
        ),
        ArtifactRule::new(
            format!(r"^profile-picture-{NUMERIC_PATTERN}-[A-Za-z0-9]+-{UUID_PATTERN}\.data$"),
            "polar-flow-profile-picture",
            DeliberatelyIgnored,
            "mvp-excludes-profile-picture",
            None,
        ),
        ArtifactRule::new(
            format!(r"^247ohr_{NUMERIC_PATTERN}_(?:0[1-9]|1[0-2])-{UUID_PATTERN}\.json$"),
            "polar-flow-continuous-heart-rate",
            DeliberatelyIgnored,
            "mvp-excludes-full-resolution-physiology",
            None,
        ),
        ArtifactRule::new(
            format!(
                r"^ppi_samples_{NUMERIC_PATTERN}_(?:0[1-9]|1[0-2])_[1-9][0-9]*-{UUID_PATTERN}\.json$"
            ),
            "polar-flow-beat-to-beat-samples",
            DeliberatelyIgnored,
            "mvp-excludes-full-resolution-physiology",
            None,
        ),
        rule(
            format!(r"^calendar-items-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-calendar-items",
            Unsupported,
        ),
        rule(
            format!(r"^favourite-targets-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-favourite-targets",
            Unsupported,
        ),
        rule(
            format!(
                r"^fitness-test-results-{NUMERIC_PATTERN}-{DATE_PATTERN}-{TIME_PATTERN}-000-{UUID_PATTERN}\.json$"
            ),
            "polar-flow-fitness-test-result",
            Unsupported,
        ),
        rule(
            format!(r"^nightly_recovery_blob_{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-nightly-recovery-blob",
            Unsupported,
        ),
        rule(
            format!(r"^nightly_recovery_{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-nightly-recovery",
            Unsupported,
        ),
        rule(
            format!(
                r"^orthostatic-test-result-{NUMERIC_PATTERN}-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"
            ),
            "polar-flow-orthostatic-test-result",
            Unsupported,
        ),
        rule(
            format!(r"^products-devices-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-products-devices",
            Unsupported,
        ),
        rule(
            format!(r"^programs-eventtrainingprograms-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-event-training-programs",
            Unsupported,
        ),
        rule(
            format!(r"^programs-fitnesslevelsnapshots-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-fitness-level-snapshots",
            Unsupported,
        ),
        rule(
            format!(r"^programs-generaltrainingprograms-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-general-training-programs",
            Unsupported,
        ),
        rule(
            format!(r"^programs-personalevents-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-personal-events",
            Unsupported,
        ),
        rule(
            format!(r"^sleep_result_{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-sleep-result",
            Unsupported,
        ),
        rule(
            format!(r"^sleep_score_{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-sleep-score",
            Unsupported,
        ),
        rule(
            format!(r"^sport-profiles-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-sport-profiles",
            Unsupported,
        ),
        rule(
            format!(
                r"^training-session_{DATE_PATTERN}T{TIME_PATTERN}_(?:{NUMERIC_PATTERN}|{UUID_PATTERN})-{UUID_PATTERN}\.json$"
            ),
            "polar-flow-training-session",
            Unsupported,
        ),
        rule(
            format!(r"^training-target-{DATE_PATTERN}-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-training-target",
            Unsupported,
        ),
    ]
});

pub(super) fn assess_artifact(name: &str) -> ArtifactAssessment {
    ARTIFACT_RULES
        .iter()
        .find(|rule| rule.pattern.is_match(name))
        .map_or(
            ArtifactAssessment {
                family: None,
                classification: ArtifactClassification::Unrecognized,
                reason_code: "unrecognized-artifact-family",
                supported_artifact: None,
            },
            |rule| rule.assessment,
        )
}

pub(super) fn daily_activity_filename_date(name: &str) -> Option<&str> {
    name.strip_prefix("activity-")?.get(..DATE_LENGTH)
}

#[cfg(test)]
mod tests {
    use super::*;

    const UUID_A: &str = "11111111-2222-4333-8444-555555555555";
    const UUID_B: &str = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    #[test]
    fn classifies_supported_daily_activity_from_the_complete_filename_grammar() {
        let name = format!("activity-2026-01-02-{UUID_A}.json");
        let assessment = assess_artifact(&name);

        assert_eq!(assessment.family, Some("polar-flow-daily-activity"));
        assert_eq!(assessment.classification, ArtifactClassification::Supported);
        assert_eq!(assessment.reason_code, "mapped");
        assert_eq!(
            assessment.supported_artifact,
            Some(SupportedArtifact::DailyActivity)
        );
        assert_eq!(daily_activity_filename_date(&name), Some("2026-01-02"));
    }

    #[test]
    fn classifies_account_data_as_supported_source_subject_evidence() {
        let assessment = assess_artifact(&format!("account-data-42-{UUID_A}.json"));

        assert_eq!(assessment.family, Some("polar-flow-account-data"));
        assert_eq!(assessment.classification, ArtifactClassification::Supported);
        assert_eq!(assessment.reason_code, "source-subject-claim");
        assert_eq!(
            assessment.supported_artifact,
            Some(SupportedArtifact::AccountData)
        );
    }

    #[test]
    fn distinguishes_known_unsupported_mvp_families() {
        let cases = [
            (
                format!("training-session_2026-01-02T10-30-00_42-{UUID_A}.json"),
                "polar-flow-training-session",
            ),
            (
                format!("training-session_2026-01-02T10-30-00_{UUID_A}-{UUID_B}.json"),
                "polar-flow-training-session",
            ),
            (
                format!("sleep_result_42-{UUID_A}.json"),
                "polar-flow-sleep-result",
            ),
            (
                format!("sleep_score_42-{UUID_A}.json"),
                "polar-flow-sleep-score",
            ),
            (
                format!("nightly_recovery_42-{UUID_A}.json"),
                "polar-flow-nightly-recovery",
            ),
            (
                format!("nightly_recovery_blob_42-{UUID_A}.json"),
                "polar-flow-nightly-recovery-blob",
            ),
        ];

        for (name, expected_family) in cases {
            let assessment = assess_artifact(&name);
            assert_eq!(assessment.family, Some(expected_family), "{name}");
            assert_eq!(
                assessment.classification,
                ArtifactClassification::Unsupported,
                "{name}",
            );
            assert_eq!(
                assessment.reason_code, "known-family-not-yet-supported",
                "{name}"
            );
        }
    }

    #[test]
    fn distinguishes_deliberately_ignored_sensitive_or_high_resolution_content() {
        let cases = [
            format!("account-profile-42-{UUID_A}.json"),
            format!("profile-picture-42-LARGE-{UUID_A}.data"),
            format!("247ohr_42_01-{UUID_A}.json"),
            format!("ppi_samples_42_01_1-{UUID_A}.json"),
        ];

        for name in cases {
            let assessment = assess_artifact(&name);
            assert!(assessment.family.is_some(), "{name}");
            assert_eq!(
                assessment.classification,
                ArtifactClassification::DeliberatelyIgnored,
                "{name}",
            );
        }
    }

    #[test]
    fn recognizes_the_remaining_observed_registry_without_claiming_support() {
        let cases = [
            format!("calendar-items-42-{UUID_A}.json"),
            format!("favourite-targets-42-{UUID_A}.json"),
            format!("fitness-test-results-42-2026-01-02-10-30-00-000-{UUID_A}.json"),
            format!("orthostatic-test-result-42-7-{UUID_A}.json"),
            format!("products-devices-42-{UUID_A}.json"),
            format!("programs-eventtrainingprograms-42-{UUID_A}.json"),
            format!("programs-fitnesslevelsnapshots-42-{UUID_A}.json"),
            format!("programs-generaltrainingprograms-42-{UUID_A}.json"),
            format!("programs-personalevents-42-{UUID_A}.json"),
            format!("sport-profiles-42-{UUID_A}.json"),
            format!("training-target-2026-01-02-42-{UUID_A}.json"),
        ];

        for name in cases {
            let assessment = assess_artifact(&name);
            assert!(assessment.family.is_some(), "{name}");
            assert_eq!(
                assessment.classification,
                ArtifactClassification::Unsupported,
                "{name}",
            );
        }
    }

    #[test]
    fn rejects_prefix_matches_and_malformed_near_misses_as_unrecognized() {
        let cases = [
            "activity-2026-01-02-short.json",
            "nested/activity-2026-01-02-11111111-2222-4333-8444-555555555555.json",
            "sleep_result_not-a-number-11111111-2222-4333-8444-555555555555.json",
            "training-session_2026-01-02T10-30_42-11111111-2222-4333-8444-555555555555.json",
            "unknown-42-11111111-2222-4333-8444-555555555555.json",
        ];

        for name in cases {
            let assessment = assess_artifact(name);
            assert_eq!(assessment.family, None, "{name}");
            assert_eq!(
                assessment.classification,
                ArtifactClassification::Unrecognized,
                "{name}",
            );
        }
    }
}
