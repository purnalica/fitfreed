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
}
