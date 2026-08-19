use std::collections::BTreeSet;

use crate::{training_detail::valid_ref, ApplicationError};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const EXERCISE_PREFIX: &str = "exercise-";
const SIGNAL_PREFIX: &str = "signal-";
const MIN_VISUAL_SAMPLES: usize = 2;
const MAX_VISUAL_SAMPLES: usize = 500;
const MAX_EXACT_SAMPLES: usize = 250;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionSignalsQuery {
    pub session_ref: String,
    pub snapshot_ref: Option<String>,
    pub max_visual_samples: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSignalRoleView {
    Primary,
    Transition,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSignalKindView {
    HeartRate,
    Speed,
    Distance,
    Altitude,
    Cadence,
    Temperature,
    LeftCrankPower,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSignalUnitView {
    BeatsPerMinute,
    KilometersPerHour,
    Meters,
    RotationsPerMinute,
    DegreesCelsius,
    Watts,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSignalSampleView {
    pub ordinal: usize,
    pub elapsed_milliseconds: i64,
    pub value: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSignalVisualSampleView {
    pub ordinal: usize,
    pub elapsed_milliseconds: i64,
    pub value: Option<f64>,
    pub gap_before: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSignalSeriesOverview {
    pub signal_ref: String,
    pub ordinal: usize,
    pub role: TrainingSignalRoleView,
    pub kind: TrainingSignalKindView,
    pub unit: TrainingSignalUnitView,
    pub interval_milliseconds: i64,
    pub sample_count: usize,
    pub available_sample_count: usize,
    pub visual_samples: Vec<TrainingSignalVisualSampleView>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSignalCollectionView {
    pub primary: Option<Vec<TrainingSignalSeriesOverview>>,
    pub transition: Option<Vec<TrainingSignalSeriesOverview>>,
    pub unsupported_primary_series_count: usize,
    pub unsupported_transition_series_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingExerciseSignalsView {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub signals: Option<TrainingSignalCollectionView>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionSignalsView {
    pub exercises: Option<Vec<TrainingExerciseSignalsView>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionSignals {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub signals: Option<TrainingSessionSignalsView>,
}

pub type TrainingSessionSignalsResult = PersistedTrainingSessionSignals;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSignalSamplesQuery {
    pub session_ref: String,
    pub signal_ref: String,
    pub snapshot_ref: Option<String>,
    pub offset: usize,
    pub limit: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSignalSamples {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub signal_ref: String,
    pub exercise_ref: String,
    pub ordinal: usize,
    pub role: TrainingSignalRoleView,
    pub kind: TrainingSignalKindView,
    pub unit: TrainingSignalUnitView,
    pub interval_milliseconds: i64,
    pub sample_count: usize,
    pub offset: usize,
    pub samples: Vec<TrainingSignalSampleView>,
    pub next_offset: Option<usize>,
}

pub type TrainingSignalSamplesResult = PersistedTrainingSignalSamples;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSessionSignalPortError {
    SnapshotChanged,
    NotFound,
    Failure(String),
}

pub trait TrainingSessionSignalPort {
    fn query_training_session_signals(
        &self,
        query: &TrainingSessionSignalsQuery,
    ) -> Result<PersistedTrainingSessionSignals, TrainingSessionSignalPortError>;

    fn query_training_signal_samples(
        &self,
        query: &TrainingSignalSamplesQuery,
    ) -> Result<PersistedTrainingSignalSamples, TrainingSessionSignalPortError>;
}

pub fn query_training_session_signals(
    port: &dyn TrainingSessionSignalPort,
    query: TrainingSessionSignalsQuery,
) -> Result<TrainingSessionSignalsResult, ApplicationError> {
    validate_common_query(&query.session_ref, query.snapshot_ref.as_deref())?;
    if !(MIN_VISUAL_SAMPLES..=MAX_VISUAL_SAMPLES).contains(&query.max_visual_samples) {
        return invalid("signal visual sample bound is invalid");
    }
    let persisted = port
        .query_training_session_signals(&query)
        .map_err(map_port_error)?;
    validate_result_identity(
        &query.session_ref,
        query.snapshot_ref.as_deref(),
        &persisted.session_ref,
        &persisted.snapshot_ref,
    )?;
    if let Some(signals) = &persisted.signals {
        validate_signals(signals, query.max_visual_samples)?;
    }
    Ok(persisted)
}

pub fn query_training_signal_samples(
    port: &dyn TrainingSessionSignalPort,
    query: TrainingSignalSamplesQuery,
) -> Result<TrainingSignalSamplesResult, ApplicationError> {
    validate_common_query(&query.session_ref, query.snapshot_ref.as_deref())?;
    if !valid_ref(&query.signal_ref, SIGNAL_PREFIX)
        || query.limit == 0
        || query.limit > MAX_EXACT_SAMPLES
    {
        return invalid("exact signal sample query is invalid");
    }
    let persisted = port
        .query_training_signal_samples(&query)
        .map_err(map_port_error)?;
    validate_result_identity(
        &query.session_ref,
        query.snapshot_ref.as_deref(),
        &persisted.session_ref,
        &persisted.snapshot_ref,
    )?;
    if persisted.signal_ref != query.signal_ref
        || !valid_ref(&persisted.exercise_ref, EXERCISE_PREFIX)
        || persisted.offset != query.offset
        || persisted.interval_milliseconds <= 0
        || !valid_kind_unit(persisted.kind, persisted.unit)
    {
        return invalid("exact signal sample identity is inconsistent");
    }
    let expected_count = query
        .limit
        .min(persisted.sample_count.saturating_sub(query.offset));
    if persisted.samples.len() != expected_count {
        return invalid("exact signal sample page size is inconsistent");
    }
    for (index, sample) in persisted.samples.iter().enumerate() {
        let expected_ordinal = query.offset.checked_add(index).ok_or(
            ApplicationError::InvalidTrainingSessionDetail("exact signal sample ordinal overflows"),
        )?;
        if sample.ordinal != expected_ordinal
            || !valid_sample(sample, persisted.kind, persisted.interval_milliseconds)
        {
            return invalid("exact signal sample page is invalid");
        }
    }
    let end = query.offset.checked_add(persisted.samples.len()).ok_or(
        ApplicationError::InvalidTrainingSessionDetail(
            "exact signal sample continuation overflows",
        ),
    )?;
    let expected_next = (end < persisted.sample_count).then_some(end);
    if persisted.next_offset != expected_next {
        return invalid("exact signal sample continuation is inconsistent");
    }
    Ok(persisted)
}

fn validate_common_query(
    session_ref: &str,
    snapshot_ref: Option<&str>,
) -> Result<(), ApplicationError> {
    if !valid_ref(session_ref, SESSION_PREFIX)
        || snapshot_ref.is_some_and(|value| !valid_ref(value, SNAPSHOT_PREFIX))
    {
        return invalid("session or snapshot reference is invalid");
    }
    Ok(())
}

fn validate_result_identity(
    requested_session_ref: &str,
    requested_snapshot_ref: Option<&str>,
    session_ref: &str,
    snapshot_ref: &str,
) -> Result<(), ApplicationError> {
    if session_ref != requested_session_ref
        || !valid_ref(snapshot_ref, SNAPSHOT_PREFIX)
        || requested_snapshot_ref.is_some_and(|expected| expected != snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionDetailChanged);
    }
    Ok(())
}

fn validate_signals(
    assessment: &TrainingSessionSignalsView,
    max_visual_samples: usize,
) -> Result<(), ApplicationError> {
    let Some(exercises) = &assessment.exercises else {
        return Ok(());
    };
    let mut exercise_refs = BTreeSet::new();
    let mut signal_refs = BTreeSet::new();
    for (ordinal, exercise) in exercises.iter().enumerate() {
        if exercise.ordinal != ordinal
            || !valid_ref(&exercise.exercise_ref, EXERCISE_PREFIX)
            || !exercise_refs.insert(exercise.exercise_ref.as_str())
        {
            return invalid("signal exercise context is invalid");
        }
        let Some(signals) = &exercise.signals else {
            continue;
        };
        validate_series_collection(
            signals.primary.as_deref(),
            TrainingSignalRoleView::Primary,
            max_visual_samples,
            &mut signal_refs,
        )?;
        validate_series_collection(
            signals.transition.as_deref(),
            TrainingSignalRoleView::Transition,
            max_visual_samples,
            &mut signal_refs,
        )?;
    }
    Ok(())
}

fn validate_series_collection<'a>(
    series: Option<&'a [TrainingSignalSeriesOverview]>,
    expected_role: TrainingSignalRoleView,
    max_visual_samples: usize,
    signal_refs: &mut BTreeSet<&'a str>,
) -> Result<(), ApplicationError> {
    let Some(series) = series else {
        return Ok(());
    };
    for (ordinal, signal) in series.iter().enumerate() {
        let expected_visual_count = signal.sample_count.min(max_visual_samples);
        if signal.ordinal != ordinal
            || signal.role != expected_role
            || !valid_ref(&signal.signal_ref, SIGNAL_PREFIX)
            || !signal_refs.insert(signal.signal_ref.as_str())
            || !valid_kind_unit(signal.kind, signal.unit)
            || signal.interval_milliseconds <= 0
            || signal.available_sample_count > signal.sample_count
            || signal.visual_samples.len() != expected_visual_count
        {
            return invalid("signal overview is invalid");
        }
        for (index, sample) in signal.visual_samples.iter().enumerate() {
            let expected_ordinal =
                selected_ordinal(signal.sample_count, expected_visual_count, index);
            if sample.ordinal != expected_ordinal
                || !valid_visual_sample(sample, signal.kind, signal.interval_milliseconds)
                || (index == 0 && sample.gap_before)
            {
                return invalid("signal visual projection is invalid");
            }
            if let Some(previous) = index
                .checked_sub(1)
                .and_then(|index| signal.visual_samples.get(index))
            {
                let consecutive = previous.ordinal.checked_add(1) == Some(sample.ordinal);
                if consecutive && sample.gap_before != sample.value.is_none() {
                    return invalid("signal visual gap evidence is inconsistent");
                }
            }
        }
    }
    Ok(())
}

fn selected_ordinal(sample_count: usize, selected_count: usize, index: usize) -> usize {
    if selected_count <= 1 {
        0
    } else {
        ((index as u128 * (sample_count - 1) as u128) / (selected_count - 1) as u128) as usize
    }
}

fn valid_sample(
    sample: &TrainingSignalSampleView,
    kind: TrainingSignalKindView,
    interval_milliseconds: i64,
) -> bool {
    valid_sample_values(
        sample.ordinal,
        sample.elapsed_milliseconds,
        sample.value,
        kind,
        interval_milliseconds,
    )
}

fn valid_visual_sample(
    sample: &TrainingSignalVisualSampleView,
    kind: TrainingSignalKindView,
    interval_milliseconds: i64,
) -> bool {
    valid_sample_values(
        sample.ordinal,
        sample.elapsed_milliseconds,
        sample.value,
        kind,
        interval_milliseconds,
    )
}

fn valid_sample_values(
    ordinal: usize,
    elapsed_milliseconds: i64,
    value: Option<f64>,
    kind: TrainingSignalKindView,
    interval_milliseconds: i64,
) -> bool {
    let elapsed = i64::try_from(ordinal)
        .ok()
        .and_then(|ordinal| ordinal.checked_mul(interval_milliseconds));
    elapsed == Some(elapsed_milliseconds)
        && value.is_none_or(|value| {
            value.is_finite()
                && (matches!(
                    kind,
                    TrainingSignalKindView::Altitude | TrainingSignalKindView::Temperature
                ) || value >= 0.0)
        })
}

fn valid_kind_unit(kind: TrainingSignalKindView, unit: TrainingSignalUnitView) -> bool {
    matches!(
        (kind, unit),
        (
            TrainingSignalKindView::HeartRate,
            TrainingSignalUnitView::BeatsPerMinute
        ) | (
            TrainingSignalKindView::Speed,
            TrainingSignalUnitView::KilometersPerHour
        ) | (
            TrainingSignalKindView::Distance | TrainingSignalKindView::Altitude,
            TrainingSignalUnitView::Meters
        ) | (
            TrainingSignalKindView::Cadence,
            TrainingSignalUnitView::RotationsPerMinute
        ) | (
            TrainingSignalKindView::Temperature,
            TrainingSignalUnitView::DegreesCelsius
        ) | (
            TrainingSignalKindView::LeftCrankPower,
            TrainingSignalUnitView::Watts
        )
    )
}

fn map_port_error(error: TrainingSessionSignalPortError) -> ApplicationError {
    match error {
        TrainingSessionSignalPortError::SnapshotChanged => {
            ApplicationError::TrainingSessionDetailChanged
        }
        TrainingSessionSignalPortError::NotFound => {
            ApplicationError::TrainingSessionDetail("signal evidence was not found".to_owned())
        }
        TrainingSessionSignalPortError::Failure(message) => {
            ApplicationError::TrainingSessionDetail(message)
        }
    }
}

fn invalid<T>(message: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidTrainingSessionDetail(message))
}
