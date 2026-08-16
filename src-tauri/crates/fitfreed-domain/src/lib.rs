#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DailyActivity {
    pub origin_id: String,
    pub local_date: String,
    pub step_count: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportReport {
    pub exact_repeat: bool,
    pub recognized_artifacts: usize,
    pub new_observations: usize,
    pub equivalent_observations: usize,
    pub enriched_observations: usize,
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

impl ImportReport {
    pub fn exact_repeat() -> Self {
        Self {
            exact_repeat: true,
            recognized_artifacts: 0,
            new_observations: 0,
            equivalent_observations: 0,
            enriched_observations: 0,
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
            preserved_observations: 0,
            conflicts: 0,
        }
    }

    pub fn record(&mut self, decision: ReconciliationDecision) {
        match decision {
            ReconciliationDecision::Create => self.new_observations += 1,
            ReconciliationDecision::Equivalent => self.equivalent_observations += 1,
            ReconciliationDecision::Enrich => self.enriched_observations += 1,
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
    Preserve,
    Conflict,
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
    }
}
