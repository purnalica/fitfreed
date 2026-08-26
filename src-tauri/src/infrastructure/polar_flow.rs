use std::sync::LazyLock;

use fitfreed_domain::ArtifactClassification;
use regex::Regex;

const DATE_PATTERN: &str = r"[0-9]{4}-[0-9]{2}-[0-9]{2}";
const DATE_LENGTH: usize = 10;
const TRAINING_START_LENGTH: usize = 19;
const TIME_PATTERN: &str = r"[0-9]{2}-[0-9]{2}-[0-9]{2}";
const NUMERIC_PATTERN: &str = r"[0-9]+";
const UUID_PATTERN: &str =
    r"[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum SupportedArtifact {
    AccountData,
    DailyActivity,
    NightlyRecovery,
    SleepResult,
    SleepScore,
    SportProfiles,
    TrainingSession,
    TrainingTarget,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ArtifactAssessment {
    pub family: Option<&'static str>,
    pub classification: ArtifactClassification,
    pub reason_code: &'static str,
    pub supported_artifact: Option<SupportedArtifact>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PolarFlowPackageIdentity {
    Current,
    UnsupportedVersion,
    Unrecognized,
}

const PROVIDER_ARTIFACT_PREFIXES: &[&str] = &[
    "247ohr_",
    "account-data-",
    "account-profile-",
    "activity-",
    "calendar-items-",
    "favourite-targets-",
    "fitness-test-results-",
    "nightly_recovery_",
    "nightly_recovery_blob_",
    "orthostatic-test-result-",
    "ppi_samples_",
    "products-devices-",
    "profile-picture-",
    "programs-eventtrainingprograms-",
    "programs-fitnesslevelsnapshots-",
    "programs-generaltrainingprograms-",
    "programs-personalevents-",
    "sleep_result_",
    "sleep_score_",
    "sport-profiles-",
    "training-session_",
    "training-target-",
];

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
        ArtifactRule::new(
            format!(r"^nightly_recovery_blob_{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-nightly-recovery-blob",
            DeliberatelyIgnored,
            "excluded-unidentifiable-recovery-samples",
            None,
        ),
        supported_rule(
            format!(r"^nightly_recovery_{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-nightly-recovery",
            SupportedArtifact::NightlyRecovery,
            "mapped-recovery-summaries",
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
        supported_rule(
            format!(r"^sleep_result_{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-sleep-result",
            SupportedArtifact::SleepResult,
            "mapped-sleep-periods",
        ),
        supported_rule(
            format!(r"^sleep_score_{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-sleep-score",
            SupportedArtifact::SleepScore,
            "mapped-sleep-scores",
        ),
        supported_rule(
            format!(r"^sport-profiles-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-sport-profiles",
            SupportedArtifact::SportProfiles,
            "mapped-sport-vocabulary-evidence",
        ),
        supported_rule(
            format!(
                r"^training-session_{DATE_PATTERN}T{TIME_PATTERN}_(?:{NUMERIC_PATTERN}|{UUID_PATTERN})-{UUID_PATTERN}\.json$"
            ),
            "polar-flow-training-session",
            SupportedArtifact::TrainingSession,
            "mapped-training-evidence",
        ),
        supported_rule(
            format!(r"^training-target-{DATE_PATTERN}-{NUMERIC_PATTERN}-{UUID_PATTERN}\.json$"),
            "polar-flow-training-target",
            SupportedArtifact::TrainingTarget,
            "mapped-completed-target-sport-evidence",
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

pub(super) fn classify_package_identity<I, S>(names: I) -> PolarFlowPackageIdentity
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut exact_provider_artifacts = 0_usize;
    let mut has_provider_evidence = false;

    for name in names {
        let name = name.as_ref();
        let basename = name.rsplit('/').next().unwrap_or(name);
        let assessment = assess_artifact(basename);
        let provider_shaped = assessment.family.is_some()
            || PROVIDER_ARTIFACT_PREFIXES
                .iter()
                .any(|prefix| basename.starts_with(prefix));
        has_provider_evidence |= provider_shaped;
        if name == basename && assessment.family.is_some() {
            exact_provider_artifacts += 1;
        }
    }

    if exact_provider_artifacts > 0 {
        PolarFlowPackageIdentity::Current
    } else if has_provider_evidence {
        PolarFlowPackageIdentity::UnsupportedVersion
    } else {
        PolarFlowPackageIdentity::Unrecognized
    }
}

pub(super) fn daily_activity_filename_date(name: &str) -> Option<&str> {
    name.strip_prefix("activity-")?.get(..DATE_LENGTH)
}

pub(super) fn training_session_filename_start(name: &str) -> Option<&str> {
    name.strip_prefix("training-session_")?
        .get(..TRAINING_START_LENGTH)
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
    fn classifies_training_sessions_as_supported_summaries() {
        for name in [
            format!("training-session_2026-01-02T10-30-00_42-{UUID_A}.json"),
            format!("training-session_2026-01-02T10-30-00_{UUID_A}-{UUID_B}.json"),
        ] {
            let assessment = assess_artifact(&name);
            assert_eq!(assessment.family, Some("polar-flow-training-session"));
            assert_eq!(assessment.classification, ArtifactClassification::Supported);
            assert_eq!(assessment.reason_code, "mapped-training-evidence");
            assert_eq!(
                assessment.supported_artifact,
                Some(SupportedArtifact::TrainingSession)
            );
            assert_eq!(
                training_session_filename_start(&name),
                Some("2026-01-02T10-30-00")
            );
        }
    }

    #[test]
    fn classifies_supported_split_sleep_artifacts() {
        let cases = [
            (
                format!("sleep_result_42-{UUID_A}.json"),
                "polar-flow-sleep-result",
                SupportedArtifact::SleepResult,
            ),
            (
                format!("sleep_score_42-{UUID_A}.json"),
                "polar-flow-sleep-score",
                SupportedArtifact::SleepScore,
            ),
        ];

        for (name, expected_family, supported_artifact) in cases {
            let assessment = assess_artifact(&name);
            assert_eq!(assessment.family, Some(expected_family), "{name}");
            assert_eq!(
                assessment.classification,
                ArtifactClassification::Supported,
                "{name}",
            );
            assert_eq!(assessment.supported_artifact, Some(supported_artifact));
        }
    }

    #[test]
    fn classifies_supported_nightly_recovery_summaries() {
        let name = format!("nightly_recovery_42-{UUID_A}.json");
        let assessment = assess_artifact(&name);

        assert_eq!(assessment.family, Some("polar-flow-nightly-recovery"));
        assert_eq!(assessment.classification, ArtifactClassification::Supported);
        assert_eq!(assessment.reason_code, "mapped-recovery-summaries");
        assert_eq!(
            assessment.supported_artifact,
            Some(SupportedArtifact::NightlyRecovery)
        );
    }

    #[test]
    fn classifies_sport_vocabulary_and_training_target_evidence_as_supported() {
        let cases = [
            (
                format!("sport-profiles-42-{UUID_A}.json"),
                "polar-flow-sport-profiles",
                SupportedArtifact::SportProfiles,
                "mapped-sport-vocabulary-evidence",
            ),
            (
                format!("training-target-2026-01-02-42-{UUID_A}.json"),
                "polar-flow-training-target",
                SupportedArtifact::TrainingTarget,
                "mapped-completed-target-sport-evidence",
            ),
        ];

        for (name, family, supported_artifact, reason_code) in cases {
            let assessment = assess_artifact(&name);
            assert_eq!(assessment.family, Some(family), "{name}");
            assert_eq!(assessment.classification, ArtifactClassification::Supported);
            assert_eq!(assessment.supported_artifact, Some(supported_artifact));
            assert_eq!(assessment.reason_code, reason_code);
        }
    }

    #[test]
    fn deliberately_excludes_unidentifiable_nightly_recovery_samples() {
        let name = format!("nightly_recovery_blob_42-{UUID_A}.json");
        let assessment = assess_artifact(&name);

        assert_eq!(assessment.family, Some("polar-flow-nightly-recovery-blob"));
        assert_eq!(
            assessment.classification,
            ArtifactClassification::DeliberatelyIgnored
        );
        assert_eq!(
            assessment.reason_code,
            "excluded-unidentifiable-recovery-samples"
        );
        assert_eq!(assessment.supported_artifact, None);
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

    #[test]
    fn identifies_current_nested_and_unrelated_package_inventories_separately() {
        let account = format!("account-data-42-{UUID_A}.json");
        let activity = format!("activity-2026-01-02-{UUID_A}.json");

        assert_eq!(
            classify_package_identity([account.as_str(), activity.as_str()]),
            PolarFlowPackageIdentity::Current
        );
        assert_eq!(
            classify_package_identity([activity.as_str()]),
            PolarFlowPackageIdentity::Current
        );
        assert_eq!(
            classify_package_identity([
                format!("wrapped/{account}").as_str(),
                format!("wrapped/{activity}").as_str()
            ],),
            PolarFlowPackageIdentity::UnsupportedVersion
        );
        assert_eq!(
            classify_package_identity(["documents/", "documents/readme.txt", "backup.zip"]),
            PolarFlowPackageIdentity::Unrecognized
        );
    }

    #[test]
    fn treats_provider_shaped_new_filename_grammar_as_an_unsupported_version() {
        assert_eq!(
            classify_package_identity(["account-data-vNext.json", "training-session_vNext.json",],),
            PolarFlowPackageIdentity::UnsupportedVersion
        );
    }
}
