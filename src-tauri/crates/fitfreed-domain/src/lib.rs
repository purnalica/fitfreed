mod sport_classification;
pub use sport_classification::{
    author_sport_classification, SportClassification, SportClassificationAuthorship,
    SportClassificationError, SportClassificationKey, SportClassificationState, SportFamily,
};

#[cfg(test)]
mod sport_classification_tests;

mod training_session;
pub use training_session::{
    decide_training_session_record_reconciliation, TrainingExercise, TrainingLap, TrainingLapKind,
    TrainingPause, TrainingSessionRecord, TrainingSessionStructure,
};

#[cfg(test)]
mod training_session_tests;

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SleepStage {
    Wake,
    Rem,
    Light,
    Deep,
    Unrecognized,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SleepStageTransition {
    pub offset_milliseconds: i64,
    pub stage: SleepStage,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SleepPhaseSummary {
    pub wake_milliseconds: i64,
    pub rem_milliseconds: i64,
    pub light_milliseconds: i64,
    pub deep_milliseconds: i64,
    pub unrecognized_milliseconds: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepScore {
    pub overall: f64,
    pub own_target_duration: f64,
    pub recommended_duration: f64,
    pub continuity: f64,
    pub efficiency: f64,
    pub rem: f64,
    pub deep: f64,
    pub long_interruptions: f64,
    pub duration: f64,
    pub solidity: f64,
    pub regeneration: f64,
    pub relative_rating: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepPeriod {
    pub origin_id: String,
    pub sleep_date: String,
    pub started_at: String,
    pub ended_at: String,
    pub span_milliseconds: i64,
    pub asleep_milliseconds: i64,
    pub interruption_milliseconds: i64,
    pub long_interruption_milliseconds: i64,
    pub short_interruption_milliseconds: i64,
    pub interruption_count: i64,
    pub long_interruption_count: i64,
    pub short_interruption_count: i64,
    pub efficiency_percent: f64,
    pub continuity_index: f64,
    pub continuity_class: i64,
    pub sleep_goal_milliseconds: Option<i64>,
    pub self_reported_rating: Option<i64>,
    pub cycle_count: Option<usize>,
    pub recording_ended_by_power_loss: Option<bool>,
    pub phase_summary: Option<SleepPhaseSummary>,
    pub stage_transitions: Option<Vec<SleepStageTransition>>,
    pub score: Option<SleepScore>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SourceSpecificRecoveryAssessment {
    pub scheme: String,
    pub autonomic_charge: f64,
    pub autonomic_status: i64,
    pub overall_status: i64,
    pub overall_sublevel: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceSpecificRecoveryBaseline {
    pub scheme: String,
    pub mean_beat_to_beat_interval_milliseconds: i64,
    pub standard_deviation_beat_to_beat_interval_milliseconds: i64,
    pub mean_heart_rate_variability_rmssd_milliseconds: Option<i64>,
    pub standard_deviation_heart_rate_variability_rmssd_milliseconds: Option<i64>,
    pub mean_breathing_interval_milliseconds: i64,
    pub standard_deviation_breathing_interval_milliseconds: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceSpecificRecoveryGuidance {
    pub scheme: String,
    pub exercise: String,
    pub sleep: String,
    pub vitality: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NightlyRecovery {
    pub origin_id: String,
    pub recovery_date: String,
    pub beat_to_beat_interval_milliseconds: i64,
    pub heart_rate_variability_rmssd_milliseconds: Option<i64>,
    pub breathing_interval_milliseconds: i64,
    pub source_assessment: Option<SourceSpecificRecoveryAssessment>,
    pub source_baseline: Option<SourceSpecificRecoveryBaseline>,
    pub source_guidance: Option<SourceSpecificRecoveryGuidance>,
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

pub fn decide_sleep_period_reconciliation(
    existing: Option<&SleepPeriod>,
    incoming: &SleepPeriod,
) -> ReconciliationDecision {
    let Some(existing) = existing else {
        return ReconciliationDecision::Create;
    };
    if existing == incoming {
        return ReconciliationDecision::Equivalent;
    }
    if !same_required_sleep_facts(existing, incoming) {
        return ReconciliationDecision::Conflict;
    }

    let optional_changes = [
        optional_change(
            &existing.sleep_goal_milliseconds,
            &incoming.sleep_goal_milliseconds,
        ),
        optional_change(
            &existing.self_reported_rating,
            &incoming.self_reported_rating,
        ),
        optional_change(&existing.cycle_count, &incoming.cycle_count),
        optional_change(
            &existing.recording_ended_by_power_loss,
            &incoming.recording_ended_by_power_loss,
        ),
        optional_change(&existing.phase_summary, &incoming.phase_summary),
        optional_change(&existing.stage_transitions, &incoming.stage_transitions),
        sleep_score_change(&existing.score, &incoming.score),
        sleep_score_relative_rating_change(&existing.score, &incoming.score),
    ];
    let adds_information = optional_changes.contains(&OptionalChange::Added);
    let removes_information = optional_changes.contains(&OptionalChange::Removed);
    let changes_information = optional_changes.contains(&OptionalChange::Changed);

    match (adds_information, removes_information, changes_information) {
        (true, false, false) => ReconciliationDecision::Enrich,
        (false, true, false) => ReconciliationDecision::Preserve,
        _ => ReconciliationDecision::Conflict,
    }
}

pub fn decide_nightly_recovery_reconciliation(
    existing: Option<&NightlyRecovery>,
    incoming: &NightlyRecovery,
) -> ReconciliationDecision {
    let Some(existing) = existing else {
        return ReconciliationDecision::Create;
    };
    if existing == incoming {
        return ReconciliationDecision::Equivalent;
    }
    if !same_required_nightly_recovery_facts(existing, incoming) {
        return ReconciliationDecision::Conflict;
    }

    let optional_changes = [
        optional_change(
            &existing.heart_rate_variability_rmssd_milliseconds,
            &incoming.heart_rate_variability_rmssd_milliseconds,
        ),
        optional_change(&existing.source_assessment, &incoming.source_assessment),
        recovery_baseline_change(&existing.source_baseline, &incoming.source_baseline),
        optional_change(&existing.source_guidance, &incoming.source_guidance),
    ];
    let adds_information = optional_changes.contains(&OptionalChange::Added);
    let removes_information = optional_changes.contains(&OptionalChange::Removed);
    let changes_information = optional_changes.contains(&OptionalChange::Changed);

    match (adds_information, removes_information, changes_information) {
        (true, false, false) => ReconciliationDecision::Enrich,
        (false, true, false) => ReconciliationDecision::Preserve,
        _ => ReconciliationDecision::Conflict,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OptionalChange {
    Unchanged,
    Added,
    Removed,
    Changed,
}

fn optional_change<T: PartialEq>(existing: &Option<T>, incoming: &Option<T>) -> OptionalChange {
    match (existing, incoming) {
        (None, None) => OptionalChange::Unchanged,
        (None, Some(_)) => OptionalChange::Added,
        (Some(_), None) => OptionalChange::Removed,
        (Some(existing), Some(incoming)) if existing == incoming => OptionalChange::Unchanged,
        (Some(_), Some(_)) => OptionalChange::Changed,
    }
}

fn recovery_baseline_change(
    existing: &Option<SourceSpecificRecoveryBaseline>,
    incoming: &Option<SourceSpecificRecoveryBaseline>,
) -> OptionalChange {
    match (existing, incoming) {
        (None, None) => OptionalChange::Unchanged,
        (None, Some(_)) => OptionalChange::Added,
        (Some(_), None) => OptionalChange::Removed,
        (Some(existing), Some(incoming)) => {
            if existing.scheme != incoming.scheme
                || existing.mean_beat_to_beat_interval_milliseconds
                    != incoming.mean_beat_to_beat_interval_milliseconds
                || existing.standard_deviation_beat_to_beat_interval_milliseconds
                    != incoming.standard_deviation_beat_to_beat_interval_milliseconds
                || existing.mean_breathing_interval_milliseconds
                    != incoming.mean_breathing_interval_milliseconds
                || existing.standard_deviation_breathing_interval_milliseconds
                    != incoming.standard_deviation_breathing_interval_milliseconds
            {
                return OptionalChange::Changed;
            }
            let rmssd_changes = [
                optional_change(
                    &existing.mean_heart_rate_variability_rmssd_milliseconds,
                    &incoming.mean_heart_rate_variability_rmssd_milliseconds,
                ),
                optional_change(
                    &existing.standard_deviation_heart_rate_variability_rmssd_milliseconds,
                    &incoming.standard_deviation_heart_rate_variability_rmssd_milliseconds,
                ),
            ];
            let adds_information = rmssd_changes.contains(&OptionalChange::Added);
            let removes_information = rmssd_changes.contains(&OptionalChange::Removed);
            let changes_information = rmssd_changes.contains(&OptionalChange::Changed);
            match (adds_information, removes_information, changes_information) {
                (false, false, false) => OptionalChange::Unchanged,
                (true, false, false) => OptionalChange::Added,
                (false, true, false) => OptionalChange::Removed,
                _ => OptionalChange::Changed,
            }
        }
    }
}

fn sleep_score_change(
    existing: &Option<SleepScore>,
    incoming: &Option<SleepScore>,
) -> OptionalChange {
    match (existing, incoming) {
        (None, None) => OptionalChange::Unchanged,
        (None, Some(_)) => OptionalChange::Added,
        (Some(_), None) => OptionalChange::Removed,
        (Some(existing), Some(incoming)) if same_required_sleep_score(existing, incoming) => {
            OptionalChange::Unchanged
        }
        (Some(_), Some(_)) => OptionalChange::Changed,
    }
}

fn sleep_score_relative_rating_change(
    existing: &Option<SleepScore>,
    incoming: &Option<SleepScore>,
) -> OptionalChange {
    match (existing, incoming) {
        (Some(existing), Some(incoming)) => {
            optional_change(&existing.relative_rating, &incoming.relative_rating)
        }
        _ => OptionalChange::Unchanged,
    }
}

fn same_required_sleep_score(existing: &SleepScore, incoming: &SleepScore) -> bool {
    existing.overall == incoming.overall
        && existing.own_target_duration == incoming.own_target_duration
        && existing.recommended_duration == incoming.recommended_duration
        && existing.continuity == incoming.continuity
        && existing.efficiency == incoming.efficiency
        && existing.rem == incoming.rem
        && existing.deep == incoming.deep
        && existing.long_interruptions == incoming.long_interruptions
        && existing.duration == incoming.duration
        && existing.solidity == incoming.solidity
        && existing.regeneration == incoming.regeneration
}

fn same_required_sleep_facts(existing: &SleepPeriod, incoming: &SleepPeriod) -> bool {
    existing.origin_id == incoming.origin_id
        && existing.sleep_date == incoming.sleep_date
        && existing.started_at == incoming.started_at
        && existing.ended_at == incoming.ended_at
        && existing.span_milliseconds == incoming.span_milliseconds
        && existing.asleep_milliseconds == incoming.asleep_milliseconds
        && existing.interruption_milliseconds == incoming.interruption_milliseconds
        && existing.long_interruption_milliseconds == incoming.long_interruption_milliseconds
        && existing.short_interruption_milliseconds == incoming.short_interruption_milliseconds
        && existing.interruption_count == incoming.interruption_count
        && existing.long_interruption_count == incoming.long_interruption_count
        && existing.short_interruption_count == incoming.short_interruption_count
        && existing.efficiency_percent == incoming.efficiency_percent
        && existing.continuity_index == incoming.continuity_index
        && existing.continuity_class == incoming.continuity_class
}

fn same_required_nightly_recovery_facts(
    existing: &NightlyRecovery,
    incoming: &NightlyRecovery,
) -> bool {
    existing.origin_id == incoming.origin_id
        && existing.recovery_date == incoming.recovery_date
        && existing.beat_to_beat_interval_milliseconds
            == incoming.beat_to_beat_interval_milliseconds
        && existing.breathing_interval_milliseconds == incoming.breathing_interval_milliseconds
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

    fn sleep_period() -> SleepPeriod {
        SleepPeriod {
            origin_id: "synthetic-origin".to_owned(),
            sleep_date: "2026-01-03".to_owned(),
            started_at: "2026-01-02T22:30:00+01:00".to_owned(),
            ended_at: "2026-01-03T06:30:00+01:00".to_owned(),
            span_milliseconds: 28_800_000,
            asleep_milliseconds: 27_000_000,
            interruption_milliseconds: 1_800_000,
            long_interruption_milliseconds: 1_200_000,
            short_interruption_milliseconds: 600_000,
            interruption_count: 4,
            long_interruption_count: 1,
            short_interruption_count: 3,
            efficiency_percent: 93.75,
            continuity_index: 4.2,
            continuity_class: 4,
            sleep_goal_milliseconds: None,
            self_reported_rating: None,
            cycle_count: None,
            recording_ended_by_power_loss: None,
            phase_summary: None,
            stage_transitions: None,
            score: None,
        }
    }

    fn nightly_recovery() -> NightlyRecovery {
        NightlyRecovery {
            origin_id: "synthetic-origin".to_owned(),
            recovery_date: "2026-01-03".to_owned(),
            beat_to_beat_interval_milliseconds: 920,
            heart_rate_variability_rmssd_milliseconds: None,
            breathing_interval_milliseconds: 4_200,
            source_assessment: None,
            source_baseline: None,
            source_guidance: None,
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
    fn reconciles_unordered_sleep_periods_without_silent_replacement() {
        let existing = sleep_period();
        let mut enriched = existing.clone();
        enriched.sleep_goal_milliseconds = Some(28_800_000);
        enriched.score = Some(SleepScore {
            overall: 82.0,
            own_target_duration: 80.0,
            recommended_duration: 78.0,
            continuity: 84.0,
            efficiency: 86.0,
            rem: 76.0,
            deep: 81.0,
            long_interruptions: 79.0,
            duration: 79.0,
            solidity: 83.0,
            regeneration: 78.5,
            relative_rating: None,
        });
        let mut changed = existing.clone();
        changed.span_milliseconds += 30_000;
        let mut mixed = enriched.clone();
        mixed.sleep_goal_milliseconds = None;
        mixed.self_reported_rating = Some(4);
        let mut score_rating_added = enriched.clone();
        score_rating_added
            .score
            .as_mut()
            .expect("score")
            .relative_rating = Some(4);
        let mut score_rating_removed = score_rating_added.clone();
        score_rating_removed
            .score
            .as_mut()
            .expect("score")
            .relative_rating = None;

        assert_eq!(
            decide_sleep_period_reconciliation(None, &existing),
            ReconciliationDecision::Create
        );
        assert_eq!(
            decide_sleep_period_reconciliation(Some(&existing), &existing),
            ReconciliationDecision::Equivalent
        );
        assert_eq!(
            decide_sleep_period_reconciliation(Some(&existing), &enriched),
            ReconciliationDecision::Enrich
        );
        assert_eq!(
            decide_sleep_period_reconciliation(Some(&enriched), &existing),
            ReconciliationDecision::Preserve
        );
        assert_eq!(
            decide_sleep_period_reconciliation(Some(&existing), &changed),
            ReconciliationDecision::Conflict
        );
        assert_eq!(
            decide_sleep_period_reconciliation(Some(&enriched), &mixed),
            ReconciliationDecision::Conflict
        );
        assert_eq!(
            decide_sleep_period_reconciliation(Some(&enriched), &score_rating_added),
            ReconciliationDecision::Enrich
        );
        assert_eq!(
            decide_sleep_period_reconciliation(Some(&score_rating_added), &score_rating_removed),
            ReconciliationDecision::Preserve
        );
    }

    #[test]
    fn reconciles_typed_nightly_recovery_components_without_cross_scheme_assumptions() {
        let existing = nightly_recovery();
        let mut enriched = existing.clone();
        enriched.heart_rate_variability_rmssd_milliseconds = Some(42);
        enriched.source_assessment = Some(SourceSpecificRecoveryAssessment {
            scheme: "synthetic-recovery@1".to_owned(),
            autonomic_charge: 1.5,
            autonomic_status: 4,
            overall_status: 5,
            overall_sublevel: 2,
        });
        enriched.source_baseline = Some(SourceSpecificRecoveryBaseline {
            scheme: "synthetic-recovery@1".to_owned(),
            mean_beat_to_beat_interval_milliseconds: 900,
            standard_deviation_beat_to_beat_interval_milliseconds: 30,
            mean_heart_rate_variability_rmssd_milliseconds: None,
            standard_deviation_heart_rate_variability_rmssd_milliseconds: None,
            mean_breathing_interval_milliseconds: 4_100,
            standard_deviation_breathing_interval_milliseconds: 120,
        });
        let mut baseline_rmssd_added = enriched.clone();
        let baseline = baseline_rmssd_added
            .source_baseline
            .as_mut()
            .expect("baseline");
        baseline.mean_heart_rate_variability_rmssd_milliseconds = Some(40);
        baseline.standard_deviation_heart_rate_variability_rmssd_milliseconds = Some(8);
        let mut changed_measurement = enriched.clone();
        changed_measurement.beat_to_beat_interval_milliseconds += 1;
        let mut changed_scheme = enriched.clone();
        changed_scheme
            .source_assessment
            .as_mut()
            .expect("assessment")
            .scheme = "synthetic-recovery@2".to_owned();
        let mut mixed = enriched.clone();
        mixed.heart_rate_variability_rmssd_milliseconds = None;
        mixed.source_guidance = Some(SourceSpecificRecoveryGuidance {
            scheme: "synthetic-guidance@1".to_owned(),
            exercise: "Synthetic exercise guidance.".to_owned(),
            sleep: "Synthetic sleep guidance.".to_owned(),
            vitality: "Synthetic vitality guidance.".to_owned(),
        });

        assert_eq!(
            decide_nightly_recovery_reconciliation(None, &existing),
            ReconciliationDecision::Create
        );
        assert_eq!(
            decide_nightly_recovery_reconciliation(Some(&existing), &existing),
            ReconciliationDecision::Equivalent
        );
        assert_eq!(
            decide_nightly_recovery_reconciliation(Some(&existing), &enriched),
            ReconciliationDecision::Enrich
        );
        assert_eq!(
            decide_nightly_recovery_reconciliation(Some(&enriched), &existing),
            ReconciliationDecision::Preserve
        );
        assert_eq!(
            decide_nightly_recovery_reconciliation(Some(&enriched), &baseline_rmssd_added),
            ReconciliationDecision::Enrich
        );
        assert_eq!(
            decide_nightly_recovery_reconciliation(Some(&baseline_rmssd_added), &enriched),
            ReconciliationDecision::Preserve
        );
        for incoming in [&changed_measurement, &changed_scheme, &mixed] {
            assert_eq!(
                decide_nightly_recovery_reconciliation(Some(&enriched), incoming),
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
