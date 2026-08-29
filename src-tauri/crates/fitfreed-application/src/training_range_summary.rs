use std::cmp::Ordering;
use std::collections::BTreeSet;
use std::f64::consts::PI;

use fitfreed_domain::{
    TrainingSessionRange, TrainingSessionRangeCoordinate, TrainingSessionRangeCoordinateScope,
    TrainingSessionRangeState,
};

use crate::{
    training_detail::valid_ref, training_discovery::training_session_sport_is_valid,
    ApplicationError, TrainingRouteKindView, TrainingRoutePointView, TrainingSessionSport,
    TrainingSignalKindView, TrainingSignalRoleView, TrainingSignalSampleView,
    TrainingSignalUnitView, TrainingSourceProviderView,
};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const EXERCISE_PREFIX: &str = "exercise-";
const RANGE_PREFIX: &str = "range-";
const ROUTE_PREFIX: &str = "route-";
const SIGNAL_PREFIX: &str = "signal-";
const LAP_PREFIX: &str = "lap-";
const EVIDENCE_REVISION_PREFIX: &str = "range-evidence-";
const MAX_SOURCE_RANGES: usize = 2_000;
const MAX_COORDINATE_COUNT: usize = 1_000;
const MAX_EXACT_BOUNDARY_MATCHES: usize = 25;
const MAX_MISSING_INTERVALS: usize = 1_000;
const EARTH_RADIUS_METERS: f64 = 6_371_008.8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionRangeSummaryQuery {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub range_ref: String,
    pub expected_range_revision: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionRangeDraftSummaryQuery {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub exercise_ref: String,
    pub coordinate: TrainingSessionRangeCoordinate,
    pub started_at_elapsed_milliseconds: i64,
    pub ended_at_elapsed_milliseconds: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TrainingRangeSourceRangeKind {
    ManualLap,
    AutomaticLap,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingRangeSummarySourceRange {
    pub source_range_ref: String,
    pub kind: TrainingRangeSourceRangeKind,
    pub ordinal: usize,
    pub started_at_elapsed_milliseconds: i64,
    pub ended_at_elapsed_milliseconds: i64,
    pub distance_meters: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingRangeSummaryExercise {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
    pub sport: TrainingSessionSport,
    pub source_ranges: Vec<PersistedTrainingRangeSummarySourceRange>,
    pub route_coordinate_count: usize,
    pub signal_coordinate_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PersistedTrainingRangeCoordinateEvidence {
    Exercise {
        maximum_elapsed_milliseconds: i64,
    },
    Route {
        route_ref: String,
        kind: TrainingRouteKindView,
        point_count: usize,
        elapsed_point_count: usize,
        maximum_elapsed_milliseconds: i64,
    },
    Signal {
        signal_ref: String,
        ordinal: usize,
        role: TrainingSignalRoleView,
        kind: TrainingSignalKindView,
        unit: TrainingSignalUnitView,
        interval_milliseconds: i64,
        sample_count: usize,
        available_sample_count: usize,
    },
    Unavailable,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionRangeSummary {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub evidence_revision: String,
    pub source_provider: TrainingSourceProviderView,
    pub range: TrainingSessionRange,
    pub exercise: Option<PersistedTrainingRangeSummaryExercise>,
    pub coordinate_evidence: PersistedTrainingRangeCoordinateEvidence,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionRangeDraftSummary {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub evidence_revision: String,
    pub source_provider: TrainingSourceProviderView,
    pub exercise: PersistedTrainingRangeSummaryExercise,
    pub coordinate_evidence: PersistedTrainingRangeCoordinateEvidence,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TrainingRangeEvidenceStreamItem {
    RoutePoint {
        route_ref: String,
        point: TrainingRoutePointView,
    },
    SignalSample {
        signal_ref: String,
        sample: TrainingSignalSampleView,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSessionRangeSummaryPortError {
    SnapshotChanged,
    RangeChanged,
    NotFound,
    InvalidEvidence(&'static str),
    Failure(String),
}

pub trait TrainingSessionRangeSummaryPort {
    fn query_training_session_range_summary_context(
        &self,
        query: &TrainingSessionRangeSummaryQuery,
    ) -> Result<PersistedTrainingSessionRangeSummary, TrainingSessionRangeSummaryPortError>;

    fn visit_training_session_range_summary_evidence(
        &self,
        query: &TrainingSessionRangeSummaryQuery,
        visitor: &mut dyn FnMut(TrainingRangeEvidenceStreamItem) -> Result<(), &'static str>,
    ) -> Result<(), TrainingSessionRangeSummaryPortError>;

    fn query_training_session_range_draft_summary_context(
        &self,
        query: &TrainingSessionRangeDraftSummaryQuery,
    ) -> Result<PersistedTrainingSessionRangeDraftSummary, TrainingSessionRangeSummaryPortError>;

    fn visit_training_session_range_draft_summary_evidence(
        &self,
        query: &TrainingSessionRangeDraftSummaryQuery,
        visitor: &mut dyn FnMut(TrainingRangeEvidenceStreamItem) -> Result<(), &'static str>,
    ) -> Result<(), TrainingSessionRangeSummaryPortError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingRangeSummaryCoverageState {
    Complete,
    Partial,
    Empty,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingRangeBoundaryEvidenceState {
    Exact,
    BetweenEvidence,
    OutsideRecordedEvidence,
    NoEvidence,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TrainingRangeExactEvidenceKind {
    Exercise,
    ManualLap,
    AutomaticLap,
    RoutePoint,
    SignalSample,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingRangeEvidenceLocation {
    pub kind: TrainingRangeExactEvidenceKind,
    pub evidence_ref: String,
    pub ordinal: Option<usize>,
    pub elapsed_milliseconds: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingRangeBoundaryEvidence {
    pub elapsed_milliseconds: i64,
    pub state: TrainingRangeBoundaryEvidenceState,
    pub exact_match_count: usize,
    pub exact_matches: Vec<TrainingRangeEvidenceLocation>,
    pub preceding: Option<TrainingRangeEvidenceLocation>,
    pub following: Option<TrainingRangeEvidenceLocation>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingRangeBoundaryPair {
    pub start: TrainingRangeBoundaryEvidence,
    pub end: TrainingRangeBoundaryEvidence,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingRangeMissingInterval {
    pub started_at_elapsed_milliseconds: i64,
    pub ended_at_elapsed_milliseconds: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingRangeEvidenceCoverage {
    pub state: TrainingRangeSummaryCoverageState,
    pub recorded_evidence_count: usize,
    pub selected_evidence_count: usize,
    pub available_evidence_count: usize,
    pub missing_evidence_count: usize,
    pub missing_elapsed_evidence_count: usize,
    pub missing_intervals: Vec<TrainingRangeMissingInterval>,
    pub omitted_missing_interval_count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingRangeMetricCoverage {
    Complete,
    Partial,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRangeDistanceSummary {
    pub meters: f64,
    pub coverage: TrainingRangeMetricCoverage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingRangeCardinalDirection {
    North,
    NorthEast,
    East,
    SouthEast,
    South,
    SouthWest,
    West,
    NorthWest,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRangeDirectionSummary {
    pub initial_bearing_degrees: f64,
    pub cardinal: TrainingRangeCardinalDirection,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRangeMeasurementSummary {
    pub kind: TrainingSignalKindView,
    pub unit: TrainingSignalUnitView,
    pub minimum: f64,
    pub maximum: f64,
    pub average: f64,
    pub available_evidence_count: usize,
    pub missing_evidence_count: usize,
    pub start_boundary_value: Option<f64>,
    pub end_boundary_value: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingRangeSourceOverlapRelation {
    Exact,
    SourceContainsRange,
    RangeContainsSource,
    Overlap,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRangeSourceOverlap {
    pub source_range_ref: String,
    pub kind: TrainingRangeSourceRangeKind,
    pub ordinal: usize,
    pub started_at_elapsed_milliseconds: i64,
    pub ended_at_elapsed_milliseconds: i64,
    pub distance_meters: Option<f64>,
    pub relation: TrainingRangeSourceOverlapRelation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingRangeIndependentEvidence {
    pub source_range_count: usize,
    pub route_coordinate_count: usize,
    pub signal_coordinate_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TrainingRangeCoordinateEvidence {
    Exercise {
        maximum_elapsed_milliseconds: i64,
    },
    Route {
        route_ref: String,
        kind: TrainingRouteKindView,
    },
    Signal {
        signal_ref: String,
        ordinal: usize,
        role: TrainingSignalRoleView,
        kind: TrainingSignalKindView,
        unit: TrainingSignalUnitView,
        interval_milliseconds: i64,
    },
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingRangeSummaryLimitation {
    CoordinateUnavailable,
    BoundaryNotExact,
    MissingElapsedRouteEvidence,
    MissingSignalEvidence,
    InsufficientRouteGeometry,
    AmbiguousSourceDistance,
    DistanceUnavailable,
    MovingTimeUnavailable,
    PausedTimeUnavailable,
    UnalignedSourceRangeEvidence,
    UnalignedRouteEvidence,
    UnalignedSignalEvidence,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionRangeSummary {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub evidence_revision: String,
    pub source_provider: TrainingSourceProviderView,
    pub range: TrainingSessionRange,
    pub exercise: Option<PersistedTrainingRangeSummaryExercise>,
    pub coordinate_evidence: TrainingRangeCoordinateEvidence,
    pub elapsed_duration_milliseconds: i64,
    pub moving_duration_milliseconds: Option<i64>,
    pub paused_duration_milliseconds: Option<i64>,
    pub distance: Option<TrainingRangeDistanceSummary>,
    pub direction: Option<TrainingRangeDirectionSummary>,
    pub measurements: Vec<TrainingRangeMeasurementSummary>,
    pub boundaries: TrainingRangeBoundaryPair,
    pub coverage: TrainingRangeEvidenceCoverage,
    pub source_ranges: Vec<TrainingRangeSourceOverlap>,
    pub independent_evidence: TrainingRangeIndependentEvidence,
    pub limitations: Vec<TrainingRangeSummaryLimitation>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionRangeDraftSummary {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub evidence_revision: String,
    pub source_provider: TrainingSourceProviderView,
    pub exercise: PersistedTrainingRangeSummaryExercise,
    pub coordinate: TrainingSessionRangeCoordinate,
    pub started_at_elapsed_milliseconds: i64,
    pub ended_at_elapsed_milliseconds: i64,
    pub coordinate_evidence: TrainingRangeCoordinateEvidence,
    pub elapsed_duration_milliseconds: i64,
    pub moving_duration_milliseconds: Option<i64>,
    pub paused_duration_milliseconds: Option<i64>,
    pub distance: Option<TrainingRangeDistanceSummary>,
    pub direction: Option<TrainingRangeDirectionSummary>,
    pub measurements: Vec<TrainingRangeMeasurementSummary>,
    pub boundaries: TrainingRangeBoundaryPair,
    pub coverage: TrainingRangeEvidenceCoverage,
    pub source_ranges: Vec<TrainingRangeSourceOverlap>,
    pub independent_evidence: TrainingRangeIndependentEvidence,
    pub limitations: Vec<TrainingRangeSummaryLimitation>,
}

pub fn query_training_session_range_summary(
    port: &dyn TrainingSessionRangeSummaryPort,
    query: TrainingSessionRangeSummaryQuery,
) -> Result<TrainingSessionRangeSummary, ApplicationError> {
    validate_query(&query)?;
    let persisted = port
        .query_training_session_range_summary_context(&query)
        .map_err(map_port_error)?;
    validate_context(&query, &persisted)?;
    let exercise = persisted.exercise.as_ref();
    let independent_evidence = TrainingRangeIndependentEvidence {
        source_range_count: exercise.map_or(0, |value| value.source_ranges.len()),
        route_coordinate_count: exercise.map_or(0, |value| value.route_coordinate_count),
        signal_coordinate_count: exercise.map_or(0, |value| value.signal_coordinate_count),
    };
    let started = persisted.range.started_at_elapsed_milliseconds();
    let ended = persisted.range.ended_at_elapsed_milliseconds();
    let elapsed_duration_milliseconds = ended
        .checked_sub(started)
        .ok_or_else(|| invalid_error("training-session range summary duration overflows"))?;
    let mut limitations = vec![
        TrainingRangeSummaryLimitation::MovingTimeUnavailable,
        TrainingRangeSummaryLimitation::PausedTimeUnavailable,
    ];
    let evidence = summarize_coordinate(
        port,
        TrainingRangeSummaryEvidenceQuery::Saved(&query),
        TrainingRangeSummarySelection {
            exercise: persisted.exercise.as_ref(),
            coordinate_evidence: &persisted.coordinate_evidence,
            started_at_elapsed_milliseconds: started,
            ended_at_elapsed_milliseconds: ended,
        },
        &independent_evidence,
        &mut limitations,
    )?;
    Ok(TrainingSessionRangeSummary {
        snapshot_ref: persisted.snapshot_ref,
        session_ref: persisted.session_ref,
        evidence_revision: persisted.evidence_revision,
        source_provider: persisted.source_provider,
        range: persisted.range,
        exercise: persisted.exercise,
        coordinate_evidence: evidence.coordinate,
        elapsed_duration_milliseconds,
        moving_duration_milliseconds: None,
        paused_duration_milliseconds: None,
        distance: evidence.distance,
        direction: evidence.direction,
        measurements: evidence.measurements,
        boundaries: evidence.boundaries,
        coverage: evidence.coverage,
        source_ranges: evidence.source_ranges,
        independent_evidence,
        limitations,
    })
}

pub fn query_training_session_range_draft_summary(
    port: &dyn TrainingSessionRangeSummaryPort,
    query: TrainingSessionRangeDraftSummaryQuery,
) -> Result<TrainingSessionRangeDraftSummary, ApplicationError> {
    validate_draft_query(&query)?;
    let persisted = port
        .query_training_session_range_draft_summary_context(&query)
        .map_err(map_port_error)?;
    validate_draft_context(&query, &persisted)?;
    let independent_evidence = TrainingRangeIndependentEvidence {
        source_range_count: persisted.exercise.source_ranges.len(),
        route_coordinate_count: persisted.exercise.route_coordinate_count,
        signal_coordinate_count: persisted.exercise.signal_coordinate_count,
    };
    let elapsed_duration_milliseconds = query
        .ended_at_elapsed_milliseconds
        .checked_sub(query.started_at_elapsed_milliseconds)
        .ok_or_else(|| invalid_error("training-session range summary duration overflows"))?;
    let mut limitations = vec![
        TrainingRangeSummaryLimitation::MovingTimeUnavailable,
        TrainingRangeSummaryLimitation::PausedTimeUnavailable,
    ];
    let evidence = summarize_coordinate(
        port,
        TrainingRangeSummaryEvidenceQuery::Draft(&query),
        TrainingRangeSummarySelection {
            exercise: Some(&persisted.exercise),
            coordinate_evidence: &persisted.coordinate_evidence,
            started_at_elapsed_milliseconds: query.started_at_elapsed_milliseconds,
            ended_at_elapsed_milliseconds: query.ended_at_elapsed_milliseconds,
        },
        &independent_evidence,
        &mut limitations,
    )?;
    Ok(TrainingSessionRangeDraftSummary {
        snapshot_ref: persisted.snapshot_ref,
        session_ref: persisted.session_ref,
        evidence_revision: persisted.evidence_revision,
        source_provider: persisted.source_provider,
        exercise: persisted.exercise,
        coordinate: query.coordinate,
        started_at_elapsed_milliseconds: query.started_at_elapsed_milliseconds,
        ended_at_elapsed_milliseconds: query.ended_at_elapsed_milliseconds,
        coordinate_evidence: evidence.coordinate,
        elapsed_duration_milliseconds,
        moving_duration_milliseconds: None,
        paused_duration_milliseconds: None,
        distance: evidence.distance,
        direction: evidence.direction,
        measurements: evidence.measurements,
        boundaries: evidence.boundaries,
        coverage: evidence.coverage,
        source_ranges: evidence.source_ranges,
        independent_evidence,
        limitations,
    })
}

#[derive(Clone, Copy)]
enum TrainingRangeSummaryEvidenceQuery<'a> {
    Saved(&'a TrainingSessionRangeSummaryQuery),
    Draft(&'a TrainingSessionRangeDraftSummaryQuery),
}

#[derive(Clone, Copy)]
struct TrainingRangeSummarySelection<'a> {
    exercise: Option<&'a PersistedTrainingRangeSummaryExercise>,
    coordinate_evidence: &'a PersistedTrainingRangeCoordinateEvidence,
    started_at_elapsed_milliseconds: i64,
    ended_at_elapsed_milliseconds: i64,
}

struct CoordinateSummary {
    coordinate: TrainingRangeCoordinateEvidence,
    distance: Option<TrainingRangeDistanceSummary>,
    direction: Option<TrainingRangeDirectionSummary>,
    measurements: Vec<TrainingRangeMeasurementSummary>,
    boundaries: TrainingRangeBoundaryPair,
    coverage: TrainingRangeEvidenceCoverage,
    source_ranges: Vec<TrainingRangeSourceOverlap>,
}

fn visit_training_range_summary_evidence(
    port: &dyn TrainingSessionRangeSummaryPort,
    query: TrainingRangeSummaryEvidenceQuery<'_>,
    visitor: &mut dyn FnMut(TrainingRangeEvidenceStreamItem) -> Result<(), &'static str>,
) -> Result<(), ApplicationError> {
    match query {
        TrainingRangeSummaryEvidenceQuery::Saved(query) => {
            port.visit_training_session_range_summary_evidence(query, visitor)
        }
        TrainingRangeSummaryEvidenceQuery::Draft(query) => {
            port.visit_training_session_range_draft_summary_evidence(query, visitor)
        }
    }
    .map_err(map_port_error)
}

fn summarize_coordinate(
    port: &dyn TrainingSessionRangeSummaryPort,
    query: TrainingRangeSummaryEvidenceQuery<'_>,
    selection: TrainingRangeSummarySelection<'_>,
    independent: &TrainingRangeIndependentEvidence,
    limitations: &mut Vec<TrainingRangeSummaryLimitation>,
) -> Result<CoordinateSummary, ApplicationError> {
    match selection.coordinate_evidence {
        PersistedTrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds,
        } => summarize_exercise(
            selection,
            *maximum_elapsed_milliseconds,
            independent,
            limitations,
        ),
        PersistedTrainingRangeCoordinateEvidence::Route {
            route_ref,
            kind,
            point_count,
            elapsed_point_count,
            maximum_elapsed_milliseconds,
        } => summarize_route(
            port,
            query,
            selection,
            RouteMetadata {
                route_ref,
                kind: *kind,
                point_count: *point_count,
                elapsed_point_count: *elapsed_point_count,
                maximum_elapsed_milliseconds: *maximum_elapsed_milliseconds,
            },
            independent,
            limitations,
        ),
        PersistedTrainingRangeCoordinateEvidence::Signal {
            signal_ref,
            ordinal,
            role,
            kind,
            unit,
            interval_milliseconds,
            sample_count,
            available_sample_count,
        } => summarize_signal(
            port,
            query,
            selection,
            SignalMetadata {
                signal_ref,
                ordinal: *ordinal,
                role: *role,
                kind: *kind,
                unit: *unit,
                interval_milliseconds: *interval_milliseconds,
                sample_count: *sample_count,
                available_sample_count: *available_sample_count,
            },
            independent,
            limitations,
        ),
        PersistedTrainingRangeCoordinateEvidence::Unavailable => {
            push_limitation(
                limitations,
                TrainingRangeSummaryLimitation::CoordinateUnavailable,
            );
            Ok(CoordinateSummary {
                coordinate: TrainingRangeCoordinateEvidence::Unavailable,
                distance: None,
                direction: None,
                measurements: Vec::new(),
                boundaries: TrainingRangeBoundaryPair {
                    start: empty_boundary(selection.started_at_elapsed_milliseconds),
                    end: empty_boundary(selection.ended_at_elapsed_milliseconds),
                },
                coverage: unavailable_coverage(),
                source_ranges: Vec::new(),
            })
        }
    }
}

fn summarize_exercise(
    selection: TrainingRangeSummarySelection<'_>,
    maximum_elapsed_milliseconds: i64,
    independent: &TrainingRangeIndependentEvidence,
    limitations: &mut Vec<TrainingRangeSummaryLimitation>,
) -> Result<CoordinateSummary, ApplicationError> {
    let exercise = selection
        .exercise
        .ok_or_else(|| invalid_error("exercise range summary has no exercise"))?;
    let started = selection.started_at_elapsed_milliseconds;
    let ended = selection.ended_at_elapsed_milliseconds;
    let mut start_boundary = BoundaryAccumulator::new(started);
    let mut end_boundary = BoundaryAccumulator::new(ended);
    let mut selected_boundary_evidence_count = 0_usize;
    for (elapsed, kind, evidence_ref, ordinal) in [
        (
            0,
            TrainingRangeExactEvidenceKind::Exercise,
            exercise.exercise_ref.clone(),
            None,
        ),
        (
            maximum_elapsed_milliseconds,
            TrainingRangeExactEvidenceKind::Exercise,
            exercise.exercise_ref.clone(),
            None,
        ),
    ] {
        if elapsed >= started && elapsed <= ended {
            selected_boundary_evidence_count += 1;
        }
        let location = TrainingRangeEvidenceLocation {
            kind,
            evidence_ref,
            ordinal,
            elapsed_milliseconds: elapsed,
        };
        start_boundary.observe(location.clone());
        end_boundary.observe(location);
    }
    let mut source_ranges = Vec::new();
    for source in &exercise.source_ranges {
        let kind = source_exact_kind(source.kind);
        for elapsed in [
            source.started_at_elapsed_milliseconds,
            source.ended_at_elapsed_milliseconds,
        ] {
            if elapsed >= started && elapsed <= ended {
                selected_boundary_evidence_count += 1;
            }
            let location = TrainingRangeEvidenceLocation {
                kind,
                evidence_ref: source.source_range_ref.clone(),
                ordinal: Some(source.ordinal),
                elapsed_milliseconds: elapsed,
            };
            start_boundary.observe(location.clone());
            end_boundary.observe(location);
        }
        if source.started_at_elapsed_milliseconds < ended
            && source.ended_at_elapsed_milliseconds > started
        {
            source_ranges.push(TrainingRangeSourceOverlap {
                source_range_ref: source.source_range_ref.clone(),
                kind: source.kind,
                ordinal: source.ordinal,
                started_at_elapsed_milliseconds: source.started_at_elapsed_milliseconds,
                ended_at_elapsed_milliseconds: source.ended_at_elapsed_milliseconds,
                distance_meters: source.distance_meters,
                relation: overlap_relation(started, ended, source),
            });
        }
    }
    source_ranges.sort_by_key(|source| (source.kind, source.ordinal));
    let boundaries = TrainingRangeBoundaryPair {
        start: start_boundary.finish(),
        end: end_boundary.finish(),
    };
    if boundaries.start.state != TrainingRangeBoundaryEvidenceState::Exact
        || boundaries.end.state != TrainingRangeBoundaryEvidenceState::Exact
    {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::BoundaryNotExact,
        );
    }
    if independent.route_coordinate_count > 0 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::UnalignedRouteEvidence,
        );
    }
    if independent.signal_coordinate_count > 0 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::UnalignedSignalEvidence,
        );
    }
    let distance = exercise_distance(exercise, started, ended, &source_ranges, limitations);
    let state = if boundaries.start.state == TrainingRangeBoundaryEvidenceState::Exact
        && boundaries.end.state == TrainingRangeBoundaryEvidenceState::Exact
    {
        TrainingRangeSummaryCoverageState::Complete
    } else {
        TrainingRangeSummaryCoverageState::Partial
    };
    Ok(CoordinateSummary {
        coordinate: TrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds,
        },
        distance,
        direction: None,
        measurements: Vec::new(),
        boundaries,
        coverage: TrainingRangeEvidenceCoverage {
            state,
            recorded_evidence_count: exercise.source_ranges.len().saturating_mul(2) + 2,
            selected_evidence_count: selected_boundary_evidence_count,
            available_evidence_count: selected_boundary_evidence_count,
            missing_evidence_count: 0,
            missing_elapsed_evidence_count: 0,
            missing_intervals: Vec::new(),
            omitted_missing_interval_count: 0,
        },
        source_ranges,
    })
}

fn exercise_distance(
    exercise: &PersistedTrainingRangeSummaryExercise,
    started: i64,
    ended: i64,
    source_ranges: &[TrainingRangeSourceOverlap],
    limitations: &mut Vec<TrainingRangeSummaryLimitation>,
) -> Option<TrainingRangeDistanceSummary> {
    if started == 0 && ended == exercise.duration_milliseconds {
        if let Some(distance) = exercise.distance_meters {
            return Some(complete_distance(distance));
        }
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::DistanceUnavailable,
        );
        return None;
    }
    let exact = source_ranges
        .iter()
        .filter(|source| source.relation == TrainingRangeSourceOverlapRelation::Exact)
        .collect::<Vec<_>>();
    if exact.len() == 1 {
        if let Some(distance) = exact[0].distance_meters {
            return Some(complete_distance(distance));
        }
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::DistanceUnavailable,
        );
        return None;
    }
    if exact.len() > 1 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::AmbiguousSourceDistance,
        );
    } else {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::DistanceUnavailable,
        );
    }
    None
}

fn complete_distance(meters: f64) -> TrainingRangeDistanceSummary {
    TrainingRangeDistanceSummary {
        meters,
        coverage: TrainingRangeMetricCoverage::Complete,
    }
}

fn overlap_relation(
    range_started: i64,
    range_ended: i64,
    source: &PersistedTrainingRangeSummarySourceRange,
) -> TrainingRangeSourceOverlapRelation {
    if source.started_at_elapsed_milliseconds == range_started
        && source.ended_at_elapsed_milliseconds == range_ended
    {
        TrainingRangeSourceOverlapRelation::Exact
    } else if source.started_at_elapsed_milliseconds <= range_started
        && source.ended_at_elapsed_milliseconds >= range_ended
    {
        TrainingRangeSourceOverlapRelation::SourceContainsRange
    } else if range_started <= source.started_at_elapsed_milliseconds
        && range_ended >= source.ended_at_elapsed_milliseconds
    {
        TrainingRangeSourceOverlapRelation::RangeContainsSource
    } else {
        TrainingRangeSourceOverlapRelation::Overlap
    }
}

fn source_exact_kind(kind: TrainingRangeSourceRangeKind) -> TrainingRangeExactEvidenceKind {
    match kind {
        TrainingRangeSourceRangeKind::ManualLap => TrainingRangeExactEvidenceKind::ManualLap,
        TrainingRangeSourceRangeKind::AutomaticLap => TrainingRangeExactEvidenceKind::AutomaticLap,
    }
}

struct RouteMetadata<'a> {
    route_ref: &'a str,
    kind: TrainingRouteKindView,
    point_count: usize,
    elapsed_point_count: usize,
    maximum_elapsed_milliseconds: i64,
}

fn summarize_route(
    port: &dyn TrainingSessionRangeSummaryPort,
    query: TrainingRangeSummaryEvidenceQuery<'_>,
    selection: TrainingRangeSummarySelection<'_>,
    metadata: RouteMetadata<'_>,
    independent: &TrainingRangeIndependentEvidence,
    limitations: &mut Vec<TrainingRangeSummaryLimitation>,
) -> Result<CoordinateSummary, ApplicationError> {
    let mut accumulator = RouteAccumulator::new(
        metadata.route_ref,
        metadata.point_count,
        metadata.elapsed_point_count,
        metadata.maximum_elapsed_milliseconds,
        selection.started_at_elapsed_milliseconds,
        selection.ended_at_elapsed_milliseconds,
    );
    visit_training_range_summary_evidence(port, query, &mut |item| accumulator.observe(item))?;
    let route = accumulator.finish()?;
    if route.coverage.missing_elapsed_evidence_count > 0 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::MissingElapsedRouteEvidence,
        );
    }
    if route.boundaries.start.state != TrainingRangeBoundaryEvidenceState::Exact
        || route.boundaries.end.state != TrainingRangeBoundaryEvidenceState::Exact
    {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::BoundaryNotExact,
        );
    }
    if route.distance.is_none() {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::InsufficientRouteGeometry,
        );
    }
    if independent.source_range_count > 0 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::UnalignedSourceRangeEvidence,
        );
    }
    if independent.route_coordinate_count > 1 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::UnalignedRouteEvidence,
        );
    }
    if independent.signal_coordinate_count > 0 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::UnalignedSignalEvidence,
        );
    }
    Ok(CoordinateSummary {
        coordinate: TrainingRangeCoordinateEvidence::Route {
            route_ref: metadata.route_ref.to_owned(),
            kind: metadata.kind,
        },
        distance: route.distance,
        direction: route.direction,
        measurements: route.measurements,
        boundaries: route.boundaries,
        coverage: route.coverage,
        source_ranges: Vec::new(),
    })
}

struct RouteAccumulator<'a> {
    route_ref: &'a str,
    point_count: usize,
    elapsed_point_count: usize,
    maximum_elapsed_milliseconds: i64,
    expected_ordinal: usize,
    observed_elapsed_count: usize,
    previous_elapsed: Option<i64>,
    started: i64,
    ended: i64,
    selection_started: bool,
    selection_ended: bool,
    selected_point_count: usize,
    selected_missing_elapsed_count: usize,
    selected_missing_altitude_count: usize,
    previous_selected_point: Option<(f64, f64)>,
    first_selected_point: Option<(f64, f64)>,
    last_selected_point: Option<(f64, f64)>,
    distance_meters: f64,
    altitude: MeasurementAccumulator,
    start_boundary: BoundaryAccumulator,
    end_boundary: BoundaryAccumulator,
}

impl<'a> RouteAccumulator<'a> {
    fn new(
        route_ref: &'a str,
        point_count: usize,
        elapsed_point_count: usize,
        maximum_elapsed_milliseconds: i64,
        started: i64,
        ended: i64,
    ) -> Self {
        Self {
            route_ref,
            point_count,
            elapsed_point_count,
            maximum_elapsed_milliseconds,
            expected_ordinal: 0,
            observed_elapsed_count: 0,
            previous_elapsed: None,
            started,
            ended,
            selection_started: false,
            selection_ended: false,
            selected_point_count: 0,
            selected_missing_elapsed_count: 0,
            selected_missing_altitude_count: 0,
            previous_selected_point: None,
            first_selected_point: None,
            last_selected_point: None,
            distance_meters: 0.0,
            altitude: MeasurementAccumulator::default(),
            start_boundary: BoundaryAccumulator::new(started),
            end_boundary: BoundaryAccumulator::new(ended),
        }
    }

    fn observe(&mut self, item: TrainingRangeEvidenceStreamItem) -> Result<(), &'static str> {
        let TrainingRangeEvidenceStreamItem::RoutePoint { route_ref, point } = item else {
            return Err("route range summary received signal evidence");
        };
        if route_ref != self.route_ref
            || point.ordinal != self.expected_ordinal
            || !valid_route_point(&point)
        {
            return Err("route range summary evidence is inconsistent");
        }
        self.expected_ordinal = self
            .expected_ordinal
            .checked_add(1)
            .ok_or("route range summary point count overflows")?;
        if let Some(elapsed) = point.elapsed_milliseconds {
            if self
                .previous_elapsed
                .is_some_and(|previous| elapsed < previous)
            {
                return Err("route range summary elapsed evidence is unordered");
            }
            self.previous_elapsed = Some(elapsed);
            self.observed_elapsed_count = self
                .observed_elapsed_count
                .checked_add(1)
                .ok_or("route range summary elapsed count overflows")?;
            let location = TrainingRangeEvidenceLocation {
                kind: TrainingRangeExactEvidenceKind::RoutePoint,
                evidence_ref: route_ref,
                ordinal: Some(point.ordinal),
                elapsed_milliseconds: elapsed,
            };
            self.start_boundary.observe(location.clone());
            self.end_boundary.observe(location);
            if elapsed >= self.started && elapsed <= self.ended {
                self.selection_started = true;
            }
            if elapsed > self.ended {
                self.selection_ended = true;
            }
        }
        let selected_by_recorded_order = point.elapsed_milliseconds.is_some()
            || self
                .previous_elapsed
                .is_some_and(|previous| previous < self.ended);
        if self.selection_started && !self.selection_ended && selected_by_recorded_order {
            self.observe_selected(&point)?;
        }
        Ok(())
    }

    fn observe_selected(&mut self, point: &TrainingRoutePointView) -> Result<(), &'static str> {
        self.selected_point_count = self
            .selected_point_count
            .checked_add(1)
            .ok_or("route range summary selected count overflows")?;
        if point.elapsed_milliseconds.is_none() {
            self.selected_missing_elapsed_count = self
                .selected_missing_elapsed_count
                .checked_add(1)
                .ok_or("route range summary missing elapsed count overflows")?;
        }
        let location = (point.latitude_degrees, point.longitude_degrees);
        if let Some(previous) = self.previous_selected_point {
            let distance = haversine_distance(previous, location);
            if !distance.is_finite() {
                return Err("route range summary distance is invalid");
            }
            self.distance_meters += distance;
            if !self.distance_meters.is_finite() {
                return Err("route range summary distance overflows");
            }
        }
        self.previous_selected_point = Some(location);
        self.first_selected_point.get_or_insert(location);
        self.last_selected_point = Some(location);
        if let Some(altitude) = point.altitude_meters {
            self.altitude.observe(altitude)?;
        } else {
            self.selected_missing_altitude_count = self
                .selected_missing_altitude_count
                .checked_add(1)
                .ok_or("route range summary missing altitude count overflows")?;
        }
        Ok(())
    }

    fn finish(self) -> Result<RouteSummary, ApplicationError> {
        if self.expected_ordinal != self.point_count
            || self.observed_elapsed_count != self.elapsed_point_count
            || self.previous_elapsed != Some(self.maximum_elapsed_milliseconds)
        {
            return invalid("route range summary evidence count is inconsistent");
        }
        let boundaries = TrainingRangeBoundaryPair {
            start: self.start_boundary.finish(),
            end: self.end_boundary.finish(),
        };
        let boundaries_exact = boundaries.start.state == TrainingRangeBoundaryEvidenceState::Exact
            && boundaries.end.state == TrainingRangeBoundaryEvidenceState::Exact;
        let coverage_state = if self.selected_point_count == 0 {
            TrainingRangeSummaryCoverageState::Empty
        } else if boundaries_exact && self.selected_missing_elapsed_count == 0 {
            TrainingRangeSummaryCoverageState::Complete
        } else {
            TrainingRangeSummaryCoverageState::Partial
        };
        let enough_geometry = self.selected_point_count >= 2;
        let distance = enough_geometry.then_some(TrainingRangeDistanceSummary {
            meters: self.distance_meters,
            coverage: if boundaries_exact {
                TrainingRangeMetricCoverage::Complete
            } else {
                TrainingRangeMetricCoverage::Partial
            },
        });
        let direction = match (self.first_selected_point, self.last_selected_point) {
            (Some(first), Some(last)) if first != last => Some(direction(first, last)),
            _ => None,
        };
        let measurements = self
            .altitude
            .finish(
                TrainingSignalKindView::Altitude,
                TrainingSignalUnitView::Meters,
                self.selected_missing_altitude_count,
                None,
                None,
            )
            .into_iter()
            .collect();
        Ok(RouteSummary {
            distance,
            direction,
            measurements,
            boundaries,
            coverage: TrainingRangeEvidenceCoverage {
                state: coverage_state,
                recorded_evidence_count: self.point_count,
                selected_evidence_count: self.selected_point_count,
                available_evidence_count: self.selected_point_count,
                missing_evidence_count: 0,
                missing_elapsed_evidence_count: self.selected_missing_elapsed_count,
                missing_intervals: Vec::new(),
                omitted_missing_interval_count: 0,
            },
        })
    }
}

struct RouteSummary {
    distance: Option<TrainingRangeDistanceSummary>,
    direction: Option<TrainingRangeDirectionSummary>,
    measurements: Vec<TrainingRangeMeasurementSummary>,
    boundaries: TrainingRangeBoundaryPair,
    coverage: TrainingRangeEvidenceCoverage,
}

struct SignalMetadata<'a> {
    signal_ref: &'a str,
    ordinal: usize,
    role: TrainingSignalRoleView,
    kind: TrainingSignalKindView,
    unit: TrainingSignalUnitView,
    interval_milliseconds: i64,
    sample_count: usize,
    available_sample_count: usize,
}

fn summarize_signal(
    port: &dyn TrainingSessionRangeSummaryPort,
    query: TrainingRangeSummaryEvidenceQuery<'_>,
    selection: TrainingRangeSummarySelection<'_>,
    metadata: SignalMetadata<'_>,
    independent: &TrainingRangeIndependentEvidence,
    limitations: &mut Vec<TrainingRangeSummaryLimitation>,
) -> Result<CoordinateSummary, ApplicationError> {
    let mut accumulator = SignalAccumulator::new(
        &metadata,
        selection.started_at_elapsed_milliseconds,
        selection.ended_at_elapsed_milliseconds,
    );
    visit_training_range_summary_evidence(port, query, &mut |item| accumulator.observe(item))?;
    let signal = accumulator.finish()?;
    if signal.coverage.missing_evidence_count > 0 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::MissingSignalEvidence,
        );
    }
    if signal.boundaries.start.state != TrainingRangeBoundaryEvidenceState::Exact
        || signal.boundaries.end.state != TrainingRangeBoundaryEvidenceState::Exact
    {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::BoundaryNotExact,
        );
    }
    if independent.source_range_count > 0 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::UnalignedSourceRangeEvidence,
        );
    }
    if independent.route_coordinate_count > 0 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::UnalignedRouteEvidence,
        );
    }
    if independent.signal_coordinate_count > 1 {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::UnalignedSignalEvidence,
        );
    }
    if signal.distance.is_none() && metadata.kind == TrainingSignalKindView::Distance {
        push_limitation(
            limitations,
            TrainingRangeSummaryLimitation::DistanceUnavailable,
        );
    }
    Ok(CoordinateSummary {
        coordinate: TrainingRangeCoordinateEvidence::Signal {
            signal_ref: metadata.signal_ref.to_owned(),
            ordinal: metadata.ordinal,
            role: metadata.role,
            kind: metadata.kind,
            unit: metadata.unit,
            interval_milliseconds: metadata.interval_milliseconds,
        },
        distance: signal.distance,
        direction: None,
        measurements: signal.measurements,
        boundaries: signal.boundaries,
        coverage: signal.coverage,
        source_ranges: Vec::new(),
    })
}

struct SignalAccumulator<'a> {
    metadata: &'a SignalMetadata<'a>,
    started: i64,
    ended: i64,
    expected_ordinal: usize,
    observed_available_count: usize,
    selected_count: usize,
    selected_available_count: usize,
    selected_missing_count: usize,
    measurement: MeasurementAccumulator,
    start_boundary_value: Option<f64>,
    end_boundary_value: Option<f64>,
    start_boundary: BoundaryAccumulator,
    end_boundary: BoundaryAccumulator,
    open_gap_start: Option<i64>,
    missing_intervals: Vec<TrainingRangeMissingInterval>,
    omitted_missing_interval_count: usize,
}

impl<'a> SignalAccumulator<'a> {
    fn new(metadata: &'a SignalMetadata<'a>, started: i64, ended: i64) -> Self {
        Self {
            metadata,
            started,
            ended,
            expected_ordinal: 0,
            observed_available_count: 0,
            selected_count: 0,
            selected_available_count: 0,
            selected_missing_count: 0,
            measurement: MeasurementAccumulator::default(),
            start_boundary_value: None,
            end_boundary_value: None,
            start_boundary: BoundaryAccumulator::new(started),
            end_boundary: BoundaryAccumulator::new(ended),
            open_gap_start: None,
            missing_intervals: Vec::new(),
            omitted_missing_interval_count: 0,
        }
    }

    fn observe(&mut self, item: TrainingRangeEvidenceStreamItem) -> Result<(), &'static str> {
        let TrainingRangeEvidenceStreamItem::SignalSample { signal_ref, sample } = item else {
            return Err("signal range summary received route evidence");
        };
        if signal_ref != self.metadata.signal_ref
            || sample.ordinal != self.expected_ordinal
            || !valid_signal_sample(&sample, self.metadata)
        {
            return Err("signal range summary evidence is inconsistent");
        }
        self.expected_ordinal = self
            .expected_ordinal
            .checked_add(1)
            .ok_or("signal range summary sample count overflows")?;
        if sample.value.is_some() {
            self.observed_available_count = self
                .observed_available_count
                .checked_add(1)
                .ok_or("signal range summary available count overflows")?;
        }
        let location = TrainingRangeEvidenceLocation {
            kind: TrainingRangeExactEvidenceKind::SignalSample,
            evidence_ref: signal_ref,
            ordinal: Some(sample.ordinal),
            elapsed_milliseconds: sample.elapsed_milliseconds,
        };
        self.start_boundary.observe(location.clone());
        self.end_boundary.observe(location);
        if sample.elapsed_milliseconds == self.started {
            self.start_boundary_value = sample.value;
        }
        if sample.elapsed_milliseconds == self.ended {
            self.end_boundary_value = sample.value;
        }
        if sample.elapsed_milliseconds >= self.started && sample.elapsed_milliseconds < self.ended {
            self.observe_selected(&sample)?;
        }
        Ok(())
    }

    fn observe_selected(&mut self, sample: &TrainingSignalSampleView) -> Result<(), &'static str> {
        self.selected_count = self
            .selected_count
            .checked_add(1)
            .ok_or("signal range summary selected count overflows")?;
        match sample.value {
            Some(value) => {
                self.selected_available_count = self
                    .selected_available_count
                    .checked_add(1)
                    .ok_or("signal range summary selected available count overflows")?;
                self.close_gap(sample.elapsed_milliseconds);
                self.measurement.observe(value)?;
            }
            None => {
                self.selected_missing_count = self
                    .selected_missing_count
                    .checked_add(1)
                    .ok_or("signal range summary selected missing count overflows")?;
                self.open_gap_start
                    .get_or_insert(sample.elapsed_milliseconds);
            }
        }
        Ok(())
    }

    fn close_gap(&mut self, end: i64) {
        if let Some(start) = self.open_gap_start.take() {
            self.record_gap(start, end.min(self.ended));
        }
    }

    fn record_gap(&mut self, start: i64, end: i64) {
        if self.missing_intervals.len() < MAX_MISSING_INTERVALS {
            self.missing_intervals.push(TrainingRangeMissingInterval {
                started_at_elapsed_milliseconds: start,
                ended_at_elapsed_milliseconds: end,
            });
        } else {
            self.omitted_missing_interval_count =
                self.omitted_missing_interval_count.saturating_add(1);
        }
    }

    fn finish(mut self) -> Result<SignalSummary, ApplicationError> {
        if self.expected_ordinal != self.metadata.sample_count
            || self.observed_available_count != self.metadata.available_sample_count
        {
            return invalid("signal range summary evidence count is inconsistent");
        }
        if let Some(start) = self.open_gap_start.take() {
            self.record_gap(start, self.ended);
        }
        let boundaries = TrainingRangeBoundaryPair {
            start: self.start_boundary.finish(),
            end: self.end_boundary.finish(),
        };
        let boundaries_exact = boundaries.start.state == TrainingRangeBoundaryEvidenceState::Exact
            && boundaries.end.state == TrainingRangeBoundaryEvidenceState::Exact;
        let state = if self.selected_count == 0 {
            TrainingRangeSummaryCoverageState::Empty
        } else if boundaries_exact && self.selected_missing_count == 0 {
            TrainingRangeSummaryCoverageState::Complete
        } else {
            TrainingRangeSummaryCoverageState::Partial
        };
        let measurement = self.measurement.finish(
            self.metadata.kind,
            self.metadata.unit,
            self.selected_missing_count,
            self.start_boundary_value,
            self.end_boundary_value,
        );
        let distance = if self.metadata.kind == TrainingSignalKindView::Distance && boundaries_exact
        {
            self.start_boundary_value
                .zip(self.end_boundary_value)
                .and_then(|(start, end)| {
                    (end >= start).then_some(TrainingRangeDistanceSummary {
                        meters: end - start,
                        coverage: TrainingRangeMetricCoverage::Complete,
                    })
                })
        } else {
            None
        };
        Ok(SignalSummary {
            distance,
            measurements: measurement.into_iter().collect(),
            boundaries,
            coverage: TrainingRangeEvidenceCoverage {
                state,
                recorded_evidence_count: self.metadata.sample_count,
                selected_evidence_count: self.selected_count,
                available_evidence_count: self.selected_available_count,
                missing_evidence_count: self.selected_missing_count,
                missing_elapsed_evidence_count: 0,
                missing_intervals: self.missing_intervals,
                omitted_missing_interval_count: self.omitted_missing_interval_count,
            },
        })
    }
}

struct SignalSummary {
    distance: Option<TrainingRangeDistanceSummary>,
    measurements: Vec<TrainingRangeMeasurementSummary>,
    boundaries: TrainingRangeBoundaryPair,
    coverage: TrainingRangeEvidenceCoverage,
}

#[derive(Default)]
struct MeasurementAccumulator {
    count: usize,
    minimum: f64,
    maximum: f64,
    average: f64,
}

impl MeasurementAccumulator {
    fn observe(&mut self, value: f64) -> Result<(), &'static str> {
        if !value.is_finite() {
            return Err("range summary measurement is invalid");
        }
        self.count = self
            .count
            .checked_add(1)
            .ok_or("range summary measurement count overflows")?;
        if self.count == 1 {
            self.minimum = value;
            self.maximum = value;
            self.average = value;
        } else {
            self.minimum = self.minimum.min(value);
            self.maximum = self.maximum.max(value);
            self.average += (value - self.average) / self.count as f64;
        }
        if !self.average.is_finite() {
            return Err("range summary measurement average overflows");
        }
        Ok(())
    }

    fn finish(
        self,
        kind: TrainingSignalKindView,
        unit: TrainingSignalUnitView,
        missing_evidence_count: usize,
        start_boundary_value: Option<f64>,
        end_boundary_value: Option<f64>,
    ) -> Option<TrainingRangeMeasurementSummary> {
        (self.count > 0).then_some(TrainingRangeMeasurementSummary {
            kind,
            unit,
            minimum: self.minimum,
            maximum: self.maximum,
            average: self.average,
            available_evidence_count: self.count,
            missing_evidence_count,
            start_boundary_value,
            end_boundary_value,
        })
    }
}

struct BoundaryAccumulator {
    target: i64,
    exact_match_count: usize,
    exact_matches: Vec<TrainingRangeEvidenceLocation>,
    preceding: Option<TrainingRangeEvidenceLocation>,
    following: Option<TrainingRangeEvidenceLocation>,
}

impl BoundaryAccumulator {
    fn new(target: i64) -> Self {
        Self {
            target,
            exact_match_count: 0,
            exact_matches: Vec::new(),
            preceding: None,
            following: None,
        }
    }

    fn observe(&mut self, location: TrainingRangeEvidenceLocation) {
        match location.elapsed_milliseconds.cmp(&self.target) {
            Ordering::Equal => {
                self.exact_match_count = self.exact_match_count.saturating_add(1);
                if self.exact_matches.len() < MAX_EXACT_BOUNDARY_MATCHES {
                    self.exact_matches.push(location);
                }
            }
            Ordering::Less => {
                if self.preceding.as_ref().is_none_or(|previous| {
                    previous.elapsed_milliseconds <= location.elapsed_milliseconds
                }) {
                    self.preceding = Some(location);
                }
            }
            Ordering::Greater => {
                if self.following.as_ref().is_none_or(|following| {
                    location.elapsed_milliseconds < following.elapsed_milliseconds
                }) {
                    self.following = Some(location);
                }
            }
        }
    }

    fn finish(mut self) -> TrainingRangeBoundaryEvidence {
        self.exact_matches.sort_by(|left, right| {
            (left.kind, left.ordinal, left.evidence_ref.as_str()).cmp(&(
                right.kind,
                right.ordinal,
                right.evidence_ref.as_str(),
            ))
        });
        let state = if self.exact_match_count > 0 {
            TrainingRangeBoundaryEvidenceState::Exact
        } else if self.preceding.is_some() && self.following.is_some() {
            TrainingRangeBoundaryEvidenceState::BetweenEvidence
        } else if self.preceding.is_some() || self.following.is_some() {
            TrainingRangeBoundaryEvidenceState::OutsideRecordedEvidence
        } else {
            TrainingRangeBoundaryEvidenceState::NoEvidence
        };
        TrainingRangeBoundaryEvidence {
            elapsed_milliseconds: self.target,
            state,
            exact_match_count: self.exact_match_count,
            exact_matches: self.exact_matches,
            preceding: self.preceding,
            following: self.following,
        }
    }
}

fn empty_boundary(elapsed_milliseconds: i64) -> TrainingRangeBoundaryEvidence {
    TrainingRangeBoundaryEvidence {
        elapsed_milliseconds,
        state: TrainingRangeBoundaryEvidenceState::NoEvidence,
        exact_match_count: 0,
        exact_matches: Vec::new(),
        preceding: None,
        following: None,
    }
}

fn unavailable_coverage() -> TrainingRangeEvidenceCoverage {
    TrainingRangeEvidenceCoverage {
        state: TrainingRangeSummaryCoverageState::Unavailable,
        recorded_evidence_count: 0,
        selected_evidence_count: 0,
        available_evidence_count: 0,
        missing_evidence_count: 0,
        missing_elapsed_evidence_count: 0,
        missing_intervals: Vec::new(),
        omitted_missing_interval_count: 0,
    }
}

fn validate_query(query: &TrainingSessionRangeSummaryQuery) -> Result<(), ApplicationError> {
    if !valid_ref(&query.session_ref, SESSION_PREFIX)
        || !valid_ref(&query.snapshot_ref, SNAPSHOT_PREFIX)
        || !valid_ref(&query.range_ref, RANGE_PREFIX)
        || query.expected_range_revision == 0
    {
        return invalid("training-session range summary query is invalid");
    }
    Ok(())
}

fn validate_draft_query(
    query: &TrainingSessionRangeDraftSummaryQuery,
) -> Result<(), ApplicationError> {
    if !valid_ref(&query.session_ref, SESSION_PREFIX)
        || !valid_ref(&query.snapshot_ref, SNAPSHOT_PREFIX)
        || !valid_ref(&query.exercise_ref, EXERCISE_PREFIX)
        || query.coordinate.scope() == TrainingSessionRangeCoordinateScope::LegacySessionElapsed
        || query.started_at_elapsed_milliseconds < 0
        || query.ended_at_elapsed_milliseconds <= query.started_at_elapsed_milliseconds
    {
        return invalid("training-session range draft summary query is invalid");
    }
    Ok(())
}

fn validate_context(
    query: &TrainingSessionRangeSummaryQuery,
    persisted: &PersistedTrainingSessionRangeSummary,
) -> Result<(), ApplicationError> {
    if persisted.snapshot_ref != query.snapshot_ref
        || persisted.session_ref != query.session_ref
        || persisted.range.session_ref() != query.session_ref
        || persisted.range.range_id() != query.range_ref
        || persisted.range.revision() != query.expected_range_revision
    {
        return Err(ApplicationError::TrainingSessionRangeSummaryChanged);
    }
    if !valid_ref(&persisted.evidence_revision, EVIDENCE_REVISION_PREFIX) {
        return invalid("training-session range summary evidence revision is invalid");
    }
    if persisted.range.state() == TrainingSessionRangeState::Current
        && persisted.range.evidence_revision() != persisted.evidence_revision
    {
        return invalid("current range summary evidence revision is inconsistent");
    }
    validate_exercise(persisted)?;
    validate_coordinate_evidence(persisted)
}

fn validate_draft_context(
    query: &TrainingSessionRangeDraftSummaryQuery,
    persisted: &PersistedTrainingSessionRangeDraftSummary,
) -> Result<(), ApplicationError> {
    if persisted.snapshot_ref != query.snapshot_ref || persisted.session_ref != query.session_ref {
        return Err(ApplicationError::TrainingSessionRangeSummaryChanged);
    }
    if !valid_ref(&persisted.evidence_revision, EVIDENCE_REVISION_PREFIX) {
        return invalid("training-session range draft summary evidence revision is invalid");
    }
    if persisted.exercise.exercise_ref != query.exercise_ref {
        return Err(ApplicationError::TrainingSessionRangeSummaryChanged);
    }
    validate_exercise_record(&persisted.exercise)?;
    validate_coordinate_evidence_value(
        &query.coordinate,
        query.ended_at_elapsed_milliseconds,
        TrainingSessionRangeState::Current,
        Some(&persisted.exercise),
        &persisted.coordinate_evidence,
    )
}

fn validate_exercise(
    persisted: &PersistedTrainingSessionRangeSummary,
) -> Result<(), ApplicationError> {
    let Some(exercise_ref) = persisted.range.exercise_ref() else {
        if persisted.exercise.is_some() {
            return invalid("legacy range summary unexpectedly has an exercise");
        }
        return Ok(());
    };
    let Some(exercise) = persisted.exercise.as_ref() else {
        if persisted.range.state() == TrainingSessionRangeState::ReviewRequired
            && persisted.coordinate_evidence
                == PersistedTrainingRangeCoordinateEvidence::Unavailable
        {
            return Ok(());
        }
        return invalid("range summary exercise is missing");
    };
    if exercise.exercise_ref != exercise_ref {
        return invalid("range summary exercise is invalid");
    }
    validate_exercise_record(exercise)
}

fn validate_exercise_record(
    exercise: &PersistedTrainingRangeSummaryExercise,
) -> Result<(), ApplicationError> {
    if !valid_ref(&exercise.exercise_ref, EXERCISE_PREFIX)
        || exercise.duration_milliseconds < 0
        || exercise
            .distance_meters
            .is_some_and(|value| !value.is_finite() || value < 0.0)
        || !training_session_sport_is_valid(&exercise.sport)
        || exercise.source_ranges.len() > MAX_SOURCE_RANGES
        || exercise.route_coordinate_count > MAX_COORDINATE_COUNT
        || exercise.signal_coordinate_count > MAX_COORDINATE_COUNT
    {
        return invalid("range summary exercise is invalid");
    }
    let mut refs = BTreeSet::new();
    let mut ordinals = BTreeSet::new();
    for source in &exercise.source_ranges {
        if !valid_ref(&source.source_range_ref, LAP_PREFIX)
            || !refs.insert(source.source_range_ref.as_str())
            || !ordinals.insert((source.kind, source.ordinal))
            || source.started_at_elapsed_milliseconds < 0
            || source.ended_at_elapsed_milliseconds <= source.started_at_elapsed_milliseconds
            || source
                .distance_meters
                .is_some_and(|value| !value.is_finite() || value < 0.0)
        {
            return invalid("range summary source range is invalid");
        }
    }
    Ok(())
}

fn validate_coordinate_evidence(
    persisted: &PersistedTrainingSessionRangeSummary,
) -> Result<(), ApplicationError> {
    validate_coordinate_evidence_value(
        persisted.range.coordinate(),
        persisted.range.ended_at_elapsed_milliseconds(),
        persisted.range.state(),
        persisted.exercise.as_ref(),
        &persisted.coordinate_evidence,
    )
}

fn validate_coordinate_evidence_value(
    coordinate: &TrainingSessionRangeCoordinate,
    ended: i64,
    state: TrainingSessionRangeState,
    exercise: Option<&PersistedTrainingRangeSummaryExercise>,
    coordinate_evidence: &PersistedTrainingRangeCoordinateEvidence,
) -> Result<(), ApplicationError> {
    let matches = match coordinate_evidence {
        PersistedTrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds,
        } => {
            coordinate.scope() == TrainingSessionRangeCoordinateScope::ExerciseElapsed
                && *maximum_elapsed_milliseconds >= 0
                && exercise.is_some_and(|exercise| {
                    exercise.duration_milliseconds == *maximum_elapsed_milliseconds
                })
                && (state == TrainingSessionRangeState::ReviewRequired
                    || ended <= *maximum_elapsed_milliseconds)
        }
        PersistedTrainingRangeCoordinateEvidence::Route {
            route_ref,
            point_count,
            elapsed_point_count,
            maximum_elapsed_milliseconds,
            ..
        } => {
            coordinate.scope() == TrainingSessionRangeCoordinateScope::RouteElapsed
                && coordinate.reference() == Some(route_ref)
                && valid_ref(route_ref, ROUTE_PREFIX)
                && *elapsed_point_count <= *point_count
                && *elapsed_point_count > 0
                && *maximum_elapsed_milliseconds >= 0
                && (state == TrainingSessionRangeState::ReviewRequired
                    || ended <= *maximum_elapsed_milliseconds)
        }
        PersistedTrainingRangeCoordinateEvidence::Signal {
            signal_ref,
            kind,
            unit,
            interval_milliseconds,
            sample_count,
            available_sample_count,
            ..
        } => {
            let maximum_elapsed_milliseconds = i64::try_from(sample_count.saturating_sub(1))
                .ok()
                .and_then(|last_ordinal| last_ordinal.checked_mul(*interval_milliseconds));
            coordinate.scope() == TrainingSessionRangeCoordinateScope::SignalElapsed
                && coordinate.reference() == Some(signal_ref)
                && valid_ref(signal_ref, SIGNAL_PREFIX)
                && *interval_milliseconds > 0
                && *available_sample_count <= *sample_count
                && valid_kind_unit(*kind, *unit)
                && maximum_elapsed_milliseconds.is_some_and(|maximum| {
                    state == TrainingSessionRangeState::ReviewRequired || ended <= maximum
                })
        }
        PersistedTrainingRangeCoordinateEvidence::Unavailable => {
            state == TrainingSessionRangeState::ReviewRequired
        }
    };
    if !matches {
        return invalid("range summary coordinate evidence is inconsistent");
    }
    Ok(())
}

fn valid_route_point(point: &TrainingRoutePointView) -> bool {
    point.latitude_degrees.is_finite()
        && (-90.0..=90.0).contains(&point.latitude_degrees)
        && point.longitude_degrees.is_finite()
        && (-180.0..=180.0).contains(&point.longitude_degrees)
        && point.altitude_meters.is_none_or(f64::is_finite)
        && point
            .elapsed_milliseconds
            .is_none_or(|elapsed| elapsed >= 0)
}

fn valid_signal_sample(sample: &TrainingSignalSampleView, metadata: &SignalMetadata<'_>) -> bool {
    let elapsed = i64::try_from(sample.ordinal)
        .ok()
        .and_then(|ordinal| ordinal.checked_mul(metadata.interval_milliseconds));
    elapsed == Some(sample.elapsed_milliseconds)
        && sample.value.is_none_or(|value| {
            value.is_finite()
                && (matches!(
                    metadata.kind,
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

fn haversine_distance(left: (f64, f64), right: (f64, f64)) -> f64 {
    let (left_latitude, left_longitude) = (radians(left.0), radians(left.1));
    let (right_latitude, right_longitude) = (radians(right.0), radians(right.1));
    let latitude_delta = right_latitude - left_latitude;
    let longitude_delta = right_longitude - left_longitude;
    let half_latitude = (latitude_delta / 2.0).sin();
    let half_longitude = (longitude_delta / 2.0).sin();
    let haversine = half_latitude * half_latitude
        + left_latitude.cos() * right_latitude.cos() * half_longitude * half_longitude;
    2.0 * EARTH_RADIUS_METERS * haversine.sqrt().atan2((1.0 - haversine).max(0.0).sqrt())
}

fn direction(first: (f64, f64), last: (f64, f64)) -> TrainingRangeDirectionSummary {
    let (first_latitude, first_longitude) = (radians(first.0), radians(first.1));
    let (last_latitude, last_longitude) = (radians(last.0), radians(last.1));
    let longitude_delta = last_longitude - first_longitude;
    let y = longitude_delta.sin() * last_latitude.cos();
    let x = first_latitude.cos() * last_latitude.sin()
        - first_latitude.sin() * last_latitude.cos() * longitude_delta.cos();
    let initial_bearing_degrees = (y.atan2(x).to_degrees() + 360.0) % 360.0;
    let cardinal = match ((initial_bearing_degrees + 22.5) / 45.0).floor() as u8 % 8 {
        0 => TrainingRangeCardinalDirection::North,
        1 => TrainingRangeCardinalDirection::NorthEast,
        2 => TrainingRangeCardinalDirection::East,
        3 => TrainingRangeCardinalDirection::SouthEast,
        4 => TrainingRangeCardinalDirection::South,
        5 => TrainingRangeCardinalDirection::SouthWest,
        6 => TrainingRangeCardinalDirection::West,
        _ => TrainingRangeCardinalDirection::NorthWest,
    };
    TrainingRangeDirectionSummary {
        initial_bearing_degrees,
        cardinal,
    }
}

fn radians(degrees: f64) -> f64 {
    degrees * PI / 180.0
}

fn push_limitation(
    limitations: &mut Vec<TrainingRangeSummaryLimitation>,
    limitation: TrainingRangeSummaryLimitation,
) {
    if !limitations.contains(&limitation) {
        limitations.push(limitation);
    }
}

fn map_port_error(error: TrainingSessionRangeSummaryPortError) -> ApplicationError {
    match error {
        TrainingSessionRangeSummaryPortError::SnapshotChanged
        | TrainingSessionRangeSummaryPortError::RangeChanged => {
            ApplicationError::TrainingSessionRangeSummaryChanged
        }
        TrainingSessionRangeSummaryPortError::NotFound => {
            ApplicationError::TrainingSessionRangeNotFound
        }
        TrainingSessionRangeSummaryPortError::InvalidEvidence(message) => {
            ApplicationError::InvalidTrainingSessionRangeSummary(message)
        }
        TrainingSessionRangeSummaryPortError::Failure(message) => {
            ApplicationError::TrainingSessionRangeSummaryQuery(message)
        }
    }
}

fn invalid<T>(message: &'static str) -> Result<T, ApplicationError> {
    Err(invalid_error(message))
}

fn invalid_error(message: &'static str) -> ApplicationError {
    ApplicationError::InvalidTrainingSessionRangeSummary(message)
}
