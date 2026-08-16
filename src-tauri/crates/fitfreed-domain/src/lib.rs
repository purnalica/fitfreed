#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DailyActivity {
    pub origin_id: String,
    pub local_date: String,
    pub step_count: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSession {
    pub origin_id: String,
    pub session_id: String,
    pub started_at_local: String,
    pub stopped_at_local: String,
    pub utc_offset_minutes: Option<i32>,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
    pub energy_kilocalories: Option<i64>,
    pub average_heart_rate_bpm: Option<i64>,
    pub maximum_heart_rate_bpm: Option<i64>,
    pub sport_ref: Option<String>,
    pub exercise_count: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportReport {
    pub exact_repeat: bool,
    pub recognized_artifacts: usize,
    pub new_observations: usize,
    pub equivalent_observations: usize,
    pub enriched_observations: usize,
    pub amended_observations: usize,
    pub preserved_observations: usize,
    pub conflicts: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportOperationState {
    Assessing,
    Planned,
    Staging,
    Reconciling,
    Committing,
    Recovering,
    Completed,
    Rejected,
    Cancelled,
    Failed,
}

impl ImportOperationState {
    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"assessing" => Some(Self::Assessing),
            b"planned" => Some(Self::Planned),
            b"staging" => Some(Self::Staging),
            b"reconciling" => Some(Self::Reconciling),
            b"committing" => Some(Self::Committing),
            b"recovering" => Some(Self::Recovering),
            b"completed" => Some(Self::Completed),
            b"rejected" => Some(Self::Rejected),
            b"cancelled" => Some(Self::Cancelled),
            b"failed" => Some(Self::Failed),
            _ => None,
        }
    }

    pub const fn code(self) -> &'static str {
        match self {
            Self::Assessing => "assessing",
            Self::Planned => "planned",
            Self::Staging => "staging",
            Self::Reconciling => "reconciling",
            Self::Committing => "committing",
            Self::Recovering => "recovering",
            Self::Completed => "completed",
            Self::Rejected => "rejected",
            Self::Cancelled => "cancelled",
            Self::Failed => "failed",
        }
    }

    pub const fn can_transition_to(self, next: Self) -> bool {
        match self {
            Self::Assessing => matches!(
                next,
                Self::Planned | Self::Rejected | Self::Cancelled | Self::Failed | Self::Recovering
            ),
            Self::Planned => matches!(
                next,
                Self::Staging
                    | Self::Committing
                    | Self::Cancelled
                    | Self::Failed
                    | Self::Recovering
            ),
            Self::Staging => matches!(
                next,
                Self::Reconciling
                    | Self::Rejected
                    | Self::Cancelled
                    | Self::Failed
                    | Self::Recovering
            ),
            Self::Reconciling => matches!(
                next,
                Self::Committing
                    | Self::Rejected
                    | Self::Cancelled
                    | Self::Failed
                    | Self::Recovering
            ),
            Self::Committing => {
                matches!(next, Self::Completed | Self::Failed | Self::Recovering)
            }
            Self::Recovering => matches!(next, Self::Failed),
            Self::Completed | Self::Rejected | Self::Cancelled | Self::Failed => false,
        }
    }

    pub const fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Completed | Self::Rejected | Self::Cancelled | Self::Failed
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactClassification {
    Supported,
    Unsupported,
    DeliberatelyIgnored,
    Unrecognized,
    Invalid,
}

impl ArtifactClassification {
    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"supported" => Some(Self::Supported),
            b"unsupported" => Some(Self::Unsupported),
            b"deliberately-ignored" => Some(Self::DeliberatelyIgnored),
            b"unrecognized" => Some(Self::Unrecognized),
            b"invalid" => Some(Self::Invalid),
            _ => None,
        }
    }

    pub const fn code(self) -> &'static str {
        match self {
            Self::Supported => "supported",
            Self::Unsupported => "unsupported",
            Self::DeliberatelyIgnored => "deliberately-ignored",
            Self::Unrecognized => "unrecognized",
            Self::Invalid => "invalid",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArtifactCoverageSummary {
    pub total: usize,
    pub supported: usize,
    pub unsupported: usize,
    pub deliberately_ignored: usize,
    pub unrecognized: usize,
    pub invalid: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArtifactFamilyCoverage {
    pub family_code: Option<String>,
    pub classification: ArtifactClassification,
    pub reason_code: String,
    pub artifact_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportOutcome {
    pub operation_ref: String,
    pub state: ImportOperationState,
    pub source_provider: String,
    pub source_adapter_version: String,
    pub mapping_version: String,
    pub exact_repeat: bool,
    pub coverage_complete: bool,
    pub coverage: ArtifactCoverageSummary,
    pub artifact_families: Vec<ArtifactFamilyCoverage>,
    pub report: ImportReport,
    pub canonical_history_changed: bool,
    pub terminal_code: Option<String>,
    pub recovery_note: Option<String>,
}

impl ImportReport {
    pub fn exact_repeat() -> Self {
        Self {
            exact_repeat: true,
            recognized_artifacts: 0,
            new_observations: 0,
            equivalent_observations: 0,
            enriched_observations: 0,
            amended_observations: 0,
            preserved_observations: 0,
            conflicts: 0,
        }
    }

    pub fn assessed() -> Self {
        Self {
            exact_repeat: false,
            recognized_artifacts: 0,
            new_observations: 0,
            equivalent_observations: 0,
            enriched_observations: 0,
            amended_observations: 0,
            preserved_observations: 0,
            conflicts: 0,
        }
    }

    pub fn record(&mut self, decision: ReconciliationDecision) {
        match decision {
            ReconciliationDecision::Create => self.new_observations += 1,
            ReconciliationDecision::Equivalent => self.equivalent_observations += 1,
            ReconciliationDecision::Enrich => self.enriched_observations += 1,
            ReconciliationDecision::Amend => self.amended_observations += 1,
            ReconciliationDecision::Preserve => self.preserved_observations += 1,
            ReconciliationDecision::Conflict => self.conflicts += 1,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExistingObservation {
    Absent,
    Present(Option<i64>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReconciliationDecision {
    Create,
    Equivalent,
    Enrich,
    Amend,
    Preserve,
    Conflict,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RevisionOrder {
    Older,
    Equal,
    Newer,
    Unorderable,
}

pub fn decide_training_session_reconciliation(
    existing: Option<&TrainingSession>,
    incoming: &TrainingSession,
    revision_order: RevisionOrder,
) -> ReconciliationDecision {
    let Some(existing) = existing else {
        return ReconciliationDecision::Create;
    };
    if existing == incoming {
        return ReconciliationDecision::Equivalent;
    }
    match revision_order {
        RevisionOrder::Newer => ReconciliationDecision::Amend,
        RevisionOrder::Older => ReconciliationDecision::Preserve,
        RevisionOrder::Equal | RevisionOrder::Unorderable => ReconciliationDecision::Conflict,
    }
}

pub fn decide_reconciliation(
    existing: ExistingObservation,
    incoming_step_count: Option<i64>,
) -> ReconciliationDecision {
    match existing {
        ExistingObservation::Absent => ReconciliationDecision::Create,
        ExistingObservation::Present(existing_step_count)
            if existing_step_count == incoming_step_count =>
        {
            ReconciliationDecision::Equivalent
        }
        ExistingObservation::Present(None) => ReconciliationDecision::Enrich,
        ExistingObservation::Present(Some(_)) if incoming_step_count.is_none() => {
            ReconciliationDecision::Preserve
        }
        ExistingObservation::Present(Some(_)) => ReconciliationDecision::Conflict,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn training_session(duration_milliseconds: i64) -> TrainingSession {
        TrainingSession {
            origin_id: "synthetic-origin".to_owned(),
            session_id: "synthetic-session".to_owned(),
            started_at_local: "2026-01-02T10:30:00".to_owned(),
            stopped_at_local: "2026-01-02T11:30:00".to_owned(),
            utc_offset_minutes: Some(60),
            duration_milliseconds,
            distance_meters: Some(10_000.5),
            energy_kilocalories: Some(650),
            average_heart_rate_bpm: Some(145),
            maximum_heart_rate_bpm: Some(178),
            sport_ref: Some("synthetic-sport".to_owned()),
            exercise_count: Some(1),
        }
    }

    #[test]
    fn reconciles_training_sessions_using_canonical_equality_and_revision_order() {
        let existing = training_session(3_600_000);
        let equivalent = existing.clone();
        let amended = training_session(3_700_000);

        assert_eq!(
            decide_training_session_reconciliation(None, &equivalent, RevisionOrder::Unorderable),
            ReconciliationDecision::Create
        );
        assert_eq!(
            decide_training_session_reconciliation(
                Some(&existing),
                &equivalent,
                RevisionOrder::Older
            ),
            ReconciliationDecision::Equivalent
        );
        assert_eq!(
            decide_training_session_reconciliation(Some(&existing), &amended, RevisionOrder::Newer),
            ReconciliationDecision::Amend
        );
        assert_eq!(
            decide_training_session_reconciliation(Some(&existing), &amended, RevisionOrder::Older),
            ReconciliationDecision::Preserve
        );
        for order in [RevisionOrder::Equal, RevisionOrder::Unorderable] {
            assert_eq!(
                decide_training_session_reconciliation(Some(&existing), &amended, order),
                ReconciliationDecision::Conflict
            );
        }
    }

    #[test]
    fn classifies_every_daily_activity_reconciliation_outcome() {
        assert_eq!(
            decide_reconciliation(ExistingObservation::Absent, Some(1_000)),
            ReconciliationDecision::Create
        );
        assert_eq!(
            decide_reconciliation(ExistingObservation::Present(Some(1_000)), Some(1_000)),
            ReconciliationDecision::Equivalent
        );
        assert_eq!(
            decide_reconciliation(ExistingObservation::Present(None), Some(1_000)),
            ReconciliationDecision::Enrich
        );
        assert_eq!(
            decide_reconciliation(ExistingObservation::Present(Some(1_000)), None),
            ReconciliationDecision::Preserve
        );
        assert_eq!(
            decide_reconciliation(ExistingObservation::Present(Some(1_000)), Some(2_000)),
            ReconciliationDecision::Conflict
        );
    }

    #[test]
    fn round_trips_every_artifact_classification_code() {
        let classifications = [
            ArtifactClassification::Supported,
            ArtifactClassification::Unsupported,
            ArtifactClassification::DeliberatelyIgnored,
            ArtifactClassification::Unrecognized,
            ArtifactClassification::Invalid,
        ];

        for classification in classifications {
            assert_eq!(
                ArtifactClassification::from_code(classification.code()),
                Some(classification)
            );
        }
        assert_eq!(ArtifactClassification::from_code("future"), None);
    }

    #[test]
    fn permits_only_defined_import_lifecycle_transitions() {
        use ImportOperationState::{
            Assessing, Cancelled, Committing, Completed, Failed, Planned, Recovering, Rejected,
            Staging,
        };

        assert!(Assessing.can_transition_to(Planned));
        assert!(Planned.can_transition_to(Staging));
        assert!(Planned.can_transition_to(Committing));
        assert!(Committing.can_transition_to(Completed));
        assert!(Committing.can_transition_to(Recovering));
        assert!(Recovering.can_transition_to(Failed));
        assert!(Assessing.can_transition_to(Rejected));
        assert!(Staging.can_transition_to(Cancelled));

        for terminal in [Completed, Rejected, Cancelled, Failed] {
            assert!(terminal.is_terminal());
            assert!(!terminal.can_transition_to(Assessing));
            assert!(!terminal.can_transition_to(Completed));
        }
        assert!(!Assessing.is_terminal());
        assert!(!Assessing.can_transition_to(Completed));
        assert!(!Staging.can_transition_to(Completed));
        assert_eq!(
            ImportOperationState::from_code("completed"),
            Some(Completed)
        );
        assert_eq!(ImportOperationState::from_code("unknown"), None);
    }
}
