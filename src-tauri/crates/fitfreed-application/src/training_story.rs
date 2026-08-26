use std::collections::{BTreeMap, BTreeSet};

use crate::{
    query_training_session_provenance, query_training_session_routes,
    query_training_session_selection, query_training_session_signals,
    query_training_session_structure, query_training_session_zones,
    training_detail::{valid_ref, TrainingExerciseStructure},
    training_route::{MAX_VISUAL_POINTS, MIN_VISUAL_POINTS},
    training_signal::{MAX_VISUAL_SAMPLES, MIN_VISUAL_SAMPLES},
    ApplicationError, TrainingExerciseRoutesView, TrainingExerciseSignalsView,
    TrainingExerciseZonesView, TrainingProvenanceCurrentView, TrainingRouteCollectionView,
    TrainingRouteKindView, TrainingRouteOverview, TrainingSessionDiscoveryPort,
    TrainingSessionProvenancePort, TrainingSessionProvenanceQuery, TrainingSessionRoutePort,
    TrainingSessionRouteQuery, TrainingSessionRoutesView, TrainingSessionSearchItem,
    TrainingSessionSelectionRequest, TrainingSessionSignalPort, TrainingSessionSignalsQuery,
    TrainingSessionSignalsView, TrainingSessionSport, TrainingSessionStructurePort,
    TrainingSessionStructureQuery, TrainingSessionZonePort, TrainingSessionZonesQuery,
    TrainingSessionZonesView, TrainingSignalCollectionView, TrainingSignalKindView,
    TrainingSignalRoleView, TrainingSignalSeriesOverview, TrainingSignalUnitView,
    TrainingStructure, TrainingZoneCollectionView, TrainingZoneGroupView,
};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";

pub const TRAINING_SESSION_STORY_SCHEMA_VERSION: u32 = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionStoryQuery {
    pub session_ref: String,
    pub snapshot_ref: Option<String>,
    pub max_visual_points: usize,
    pub max_visual_samples: usize,
}

pub struct SessionStoryPorts<'a> {
    pub discovery: &'a dyn TrainingSessionDiscoveryPort,
    pub structure: &'a dyn TrainingSessionStructurePort,
    pub routes: &'a dyn TrainingSessionRoutePort,
    pub signals: &'a dyn TrainingSessionSignalPort,
    pub zones: &'a dyn TrainingSessionZonePort,
    pub provenance: &'a dyn TrainingSessionProvenancePort,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionStoryMetricView {
    Pace,
    Speed,
    HeartRate,
    Elevation,
    Cadence,
    StrokeRate,
    Temperature,
    Power,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionStoryValueTransform {
    Identity,
    KilometersPerHourToMinutesPerKilometer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionStoryAlignmentStateView {
    ExactRecorded,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SessionStoryAlignedSampleView {
    pub route_point_ordinal: usize,
    pub signal_sample_ordinal: usize,
    pub elapsed_milliseconds: i64,
    pub value: Option<f64>,
    pub gap_before: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SessionStoryOverlayView {
    pub signal_ref: String,
    pub metric: SessionStoryMetricView,
    pub source_kind: TrainingSignalKindView,
    pub source_unit: TrainingSignalUnitView,
    pub value_transform: SessionStoryValueTransform,
    pub alignment_state: SessionStoryAlignmentStateView,
    pub aligned_samples: Vec<SessionStoryAlignedSampleView>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionStoryExactRoute {
    pub route_ref: String,
    pub point_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SessionStoryExactSignal {
    pub signal_ref: String,
    pub kind: TrainingSignalKindView,
    pub unit: TrainingSignalUnitView,
    pub sample_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SessionStoryRole {
    pub route: Option<TrainingRouteOverview>,
    pub signals: Vec<TrainingSignalSeriesOverview>,
    pub evidence: SessionStoryRoleEvidenceView,
    pub primary_metric: Option<SessionStoryMetricView>,
    pub eligible_overlays: Vec<SessionStoryOverlayView>,
    pub exact_route: Option<SessionStoryExactRoute>,
    pub exact_signals: Vec<SessionStoryExactSignal>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionStoryRoleEvidenceView {
    pub route_point_count: usize,
    pub signal_series_count: usize,
    pub signal_series_with_values_count: usize,
    pub partial_signal_series_count: usize,
    pub unavailable_signal_series_count: usize,
    pub empty_signal_series_count: usize,
    pub unsupported_signal_series_count: usize,
    pub signal_sample_count: usize,
    pub available_signal_sample_count: usize,
    pub unavailable_signal_sample_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SessionStoryExercise {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub sport: Option<TrainingSessionSport>,
    pub structure: Option<TrainingExerciseStructure>,
    pub zones: Option<TrainingZoneCollectionView>,
    pub evidence: SessionStoryExerciseEvidenceView,
    pub primary: SessionStoryRole,
    pub transition: SessionStoryRole,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionStoryExerciseEvidenceView {
    pub has_structure: bool,
    pub manual_lap_count: usize,
    pub automatic_lap_count: usize,
    pub pause_count: usize,
    pub zone_group_count: usize,
    pub zone_count: usize,
    pub timed_zone_count: usize,
    pub unsupported_zone_group_count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionStoryAssessmentStateView {
    NotEvaluated,
    SourceAbsent,
    SourceEmpty,
    SourcePresent,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionStoryCompositionView {
    pub structure_state: SessionStoryAssessmentStateView,
    pub route_state: SessionStoryAssessmentStateView,
    pub signal_state: SessionStoryAssessmentStateView,
    pub zone_state: SessionStoryAssessmentStateView,
    pub exercise_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionStoryProvenance {
    pub total_event_count: usize,
    pub current: TrainingProvenanceCurrentView,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SessionStory {
    pub schema_version: u32,
    pub snapshot_ref: String,
    pub session: TrainingSessionSearchItem,
    pub structure: Option<TrainingStructure>,
    pub routes: Option<TrainingSessionRoutesView>,
    pub signals: Option<TrainingSessionSignalsView>,
    pub zones: Option<TrainingSessionZonesView>,
    pub provenance: SessionStoryProvenance,
    pub composition: SessionStoryCompositionView,
    pub exercises: Vec<SessionStoryExercise>,
}

pub fn query_session_story(
    ports: SessionStoryPorts<'_>,
    query: SessionStoryQuery,
) -> Result<SessionStory, ApplicationError> {
    validate_query(&query)?;
    let selection = query_training_session_selection(
        ports.discovery,
        TrainingSessionSelectionRequest {
            session_refs: vec![query.session_ref.clone()],
            snapshot_ref: query.snapshot_ref,
        },
    )
    .map_err(map_selection_error)?;
    let snapshot_ref = selection.snapshot_ref;
    let session = selection.sessions.into_iter().next().ok_or(
        ApplicationError::InvalidTrainingSessionDetail("session story selection is empty"),
    )?;
    let structure = query_training_session_structure(
        ports.structure,
        TrainingSessionStructureQuery {
            session_ref: query.session_ref.clone(),
            snapshot_ref: Some(snapshot_ref.clone()),
        },
    )?
    .structure;
    let routes = query_training_session_routes(
        ports.routes,
        TrainingSessionRouteQuery {
            session_ref: query.session_ref.clone(),
            snapshot_ref: Some(snapshot_ref.clone()),
            max_visual_points: query.max_visual_points,
        },
    )?
    .routes;
    let signals = query_training_session_signals(
        ports.signals,
        TrainingSessionSignalsQuery {
            session_ref: query.session_ref.clone(),
            snapshot_ref: Some(snapshot_ref.clone()),
            max_visual_samples: query.max_visual_samples,
        },
    )?
    .signals;
    let zones = query_training_session_zones(
        ports.zones,
        TrainingSessionZonesQuery {
            session_ref: query.session_ref.clone(),
            snapshot_ref: Some(snapshot_ref.clone()),
        },
    )?
    .zones;
    let provenance = query_training_session_provenance(
        ports.provenance,
        TrainingSessionProvenanceQuery {
            session_ref: query.session_ref,
            snapshot_ref: Some(snapshot_ref.clone()),
            offset: 0,
            limit: 1,
        },
    )?;
    let exercises = compose_exercises(
        &session,
        structure.as_ref(),
        routes.as_ref(),
        signals.as_ref(),
        zones.as_ref(),
    )?;
    let composition = SessionStoryCompositionView {
        structure_state: assessment_state(
            structure.as_ref().map(|value| value.exercises.as_deref()),
        ),
        route_state: assessment_state(routes.as_ref().map(|value| value.exercises.as_deref())),
        signal_state: assessment_state(signals.as_ref().map(|value| value.exercises.as_deref())),
        zone_state: assessment_state(zones.as_ref().map(|value| value.exercises.as_deref())),
        exercise_count: exercises.len(),
    };

    Ok(SessionStory {
        schema_version: TRAINING_SESSION_STORY_SCHEMA_VERSION,
        snapshot_ref,
        session,
        structure,
        routes,
        signals,
        zones,
        provenance: SessionStoryProvenance {
            total_event_count: provenance.total_event_count,
            current: provenance.current,
        },
        composition,
        exercises,
    })
}

fn assessment_state<T>(exercises: Option<Option<&[T]>>) -> SessionStoryAssessmentStateView {
    match exercises {
        None => SessionStoryAssessmentStateView::NotEvaluated,
        Some(None) => SessionStoryAssessmentStateView::SourceAbsent,
        Some(Some([])) => SessionStoryAssessmentStateView::SourceEmpty,
        Some(Some(_)) => SessionStoryAssessmentStateView::SourcePresent,
    }
}

fn validate_query(query: &SessionStoryQuery) -> Result<(), ApplicationError> {
    if !valid_ref(&query.session_ref, SESSION_PREFIX)
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|value| !valid_ref(value, SNAPSHOT_PREFIX))
        || !(MIN_VISUAL_POINTS..=MAX_VISUAL_POINTS).contains(&query.max_visual_points)
        || !(MIN_VISUAL_SAMPLES..=MAX_VISUAL_SAMPLES).contains(&query.max_visual_samples)
    {
        return invalid("session story query is invalid");
    }
    Ok(())
}

fn map_selection_error(error: ApplicationError) -> ApplicationError {
    match error {
        ApplicationError::TrainingSessionSearchChanged => {
            ApplicationError::TrainingSessionDetailChanged
        }
        ApplicationError::InvalidTrainingSessionSearch(_) => {
            ApplicationError::InvalidTrainingSessionDetail("session story selection is invalid")
        }
        ApplicationError::TrainingSessionSearch(message) => {
            ApplicationError::TrainingSessionDetail(message)
        }
        error => error,
    }
}

#[derive(Debug)]
struct ExerciseComposition {
    exercise_ref: String,
    ordinal: usize,
    structure: Option<TrainingExerciseStructure>,
    routes: Option<TrainingRouteCollectionView>,
    signals: Option<TrainingSignalCollectionView>,
    zones: Option<TrainingZoneCollectionView>,
}

impl ExerciseComposition {
    fn new(exercise_ref: &str, ordinal: usize) -> Self {
        Self {
            exercise_ref: exercise_ref.to_owned(),
            ordinal,
            structure: None,
            routes: None,
            signals: None,
            zones: None,
        }
    }
}

fn compose_exercises(
    session: &TrainingSessionSearchItem,
    structure: Option<&TrainingStructure>,
    routes: Option<&TrainingSessionRoutesView>,
    signals: Option<&TrainingSessionSignalsView>,
    zones: Option<&TrainingSessionZonesView>,
) -> Result<Vec<SessionStoryExercise>, ApplicationError> {
    let authoritative_exercises =
        structure
            .and_then(|value| value.exercises.as_ref())
            .map(|exercises| {
                exercises
                    .iter()
                    .map(|exercise| (exercise.ordinal, exercise.exercise_ref.as_str()))
                    .collect::<BTreeSet<_>>()
            });
    if let (Some(expected), Some(exercises)) = (
        session.exercise_count,
        structure.and_then(|value| value.exercises.as_ref()),
    ) {
        if expected != exercises.len() {
            return invalid("session story exercise count is inconsistent");
        }
    }

    let mut compositions = BTreeMap::new();
    let mut ordinals_by_ref = BTreeMap::new();
    if let Some(exercises) = structure.and_then(|value| value.exercises.as_ref()) {
        for exercise in exercises {
            let composition = register_exercise(
                &mut compositions,
                &mut ordinals_by_ref,
                &authoritative_exercises,
                &exercise.exercise_ref,
                exercise.ordinal,
            )?;
            composition.structure = Some(exercise.clone());
        }
    }
    if let Some(exercises) = routes.and_then(|value| value.exercises.as_ref()) {
        for exercise in exercises {
            add_routes(
                &mut compositions,
                &mut ordinals_by_ref,
                &authoritative_exercises,
                exercise,
            )?;
        }
    }
    if let Some(exercises) = signals.and_then(|value| value.exercises.as_ref()) {
        for exercise in exercises {
            add_signals(
                &mut compositions,
                &mut ordinals_by_ref,
                &authoritative_exercises,
                exercise,
            )?;
        }
    }
    if let Some(exercises) = zones.and_then(|value| value.exercises.as_ref()) {
        for exercise in exercises {
            add_zones(
                &mut compositions,
                &mut ordinals_by_ref,
                &authoritative_exercises,
                exercise,
            )?;
        }
    }

    let single_session_sport =
        (session.exercise_count == Some(1) && compositions.len() == 1).then_some(&session.sport);
    compositions
        .into_values()
        .map(|composition| build_exercise(composition, single_session_sport))
        .collect()
}

fn register_exercise<'a>(
    compositions: &'a mut BTreeMap<usize, ExerciseComposition>,
    ordinals_by_ref: &mut BTreeMap<String, usize>,
    authoritative_exercises: &Option<BTreeSet<(usize, &str)>>,
    exercise_ref: &str,
    ordinal: usize,
) -> Result<&'a mut ExerciseComposition, ApplicationError> {
    if authoritative_exercises
        .as_ref()
        .is_some_and(|exercises| !exercises.contains(&(ordinal, exercise_ref)))
    {
        return invalid("session story evidence references an unknown exercise");
    }
    if ordinals_by_ref
        .get(exercise_ref)
        .is_some_and(|existing| *existing != ordinal)
    {
        return invalid("session story exercise reference changed ordinal");
    }
    ordinals_by_ref.insert(exercise_ref.to_owned(), ordinal);
    let composition = compositions
        .entry(ordinal)
        .or_insert_with(|| ExerciseComposition::new(exercise_ref, ordinal));
    if composition.exercise_ref != exercise_ref {
        return invalid("session story exercise ordinal changed reference");
    }
    Ok(composition)
}

fn add_routes(
    compositions: &mut BTreeMap<usize, ExerciseComposition>,
    ordinals_by_ref: &mut BTreeMap<String, usize>,
    authoritative_exercises: &Option<BTreeSet<(usize, &str)>>,
    exercise: &TrainingExerciseRoutesView,
) -> Result<(), ApplicationError> {
    let composition = register_exercise(
        compositions,
        ordinals_by_ref,
        authoritative_exercises,
        &exercise.exercise_ref,
        exercise.ordinal,
    )?;
    composition.routes.clone_from(&exercise.routes);
    Ok(())
}

fn add_signals(
    compositions: &mut BTreeMap<usize, ExerciseComposition>,
    ordinals_by_ref: &mut BTreeMap<String, usize>,
    authoritative_exercises: &Option<BTreeSet<(usize, &str)>>,
    exercise: &TrainingExerciseSignalsView,
) -> Result<(), ApplicationError> {
    let composition = register_exercise(
        compositions,
        ordinals_by_ref,
        authoritative_exercises,
        &exercise.exercise_ref,
        exercise.ordinal,
    )?;
    composition.signals.clone_from(&exercise.signals);
    Ok(())
}

fn add_zones(
    compositions: &mut BTreeMap<usize, ExerciseComposition>,
    ordinals_by_ref: &mut BTreeMap<String, usize>,
    authoritative_exercises: &Option<BTreeSet<(usize, &str)>>,
    exercise: &TrainingExerciseZonesView,
) -> Result<(), ApplicationError> {
    let composition = register_exercise(
        compositions,
        ordinals_by_ref,
        authoritative_exercises,
        &exercise.exercise_ref,
        exercise.ordinal,
    )?;
    composition.zones.clone_from(&exercise.zones);
    Ok(())
}

fn build_exercise(
    composition: ExerciseComposition,
    single_session_sport: Option<&TrainingSessionSport>,
) -> Result<SessionStoryExercise, ApplicationError> {
    let sport = composition
        .structure
        .as_ref()
        .map(|structure| structure.sport.clone())
        .or_else(|| single_session_sport.cloned());
    let family = sport
        .as_ref()
        .and_then(|sport| sport.classification.as_ref())
        .and_then(|classification| classification.canonical_family.as_deref());
    let primary = build_role(
        composition
            .routes
            .as_ref()
            .and_then(|routes| routes.primary.as_ref()),
        composition
            .signals
            .as_ref()
            .and_then(|signals| signals.primary.as_deref()),
        TrainingRouteKindView::Primary,
        TrainingSignalRoleView::Primary,
        composition
            .signals
            .as_ref()
            .map_or(0, |signals| signals.unsupported_primary_series_count),
        family,
    )?;
    let transition = build_role(
        composition
            .routes
            .as_ref()
            .and_then(|routes| routes.transition.as_ref()),
        composition
            .signals
            .as_ref()
            .and_then(|signals| signals.transition.as_deref()),
        TrainingRouteKindView::Transition,
        TrainingSignalRoleView::Transition,
        composition
            .signals
            .as_ref()
            .map_or(0, |signals| signals.unsupported_transition_series_count),
        family,
    )?;
    let evidence = exercise_evidence(composition.structure.as_ref(), composition.zones.as_ref())?;
    Ok(SessionStoryExercise {
        exercise_ref: composition.exercise_ref,
        ordinal: composition.ordinal,
        sport,
        structure: composition.structure,
        zones: composition.zones,
        evidence,
        primary,
        transition,
    })
}

fn build_role(
    route: Option<&TrainingRouteOverview>,
    signals: Option<&[TrainingSignalSeriesOverview]>,
    expected_route_kind: TrainingRouteKindView,
    expected_signal_role: TrainingSignalRoleView,
    unsupported_signal_series_count: usize,
    family: Option<&str>,
) -> Result<SessionStoryRole, ApplicationError> {
    if route.is_some_and(|route| route.kind != expected_route_kind)
        || signals.is_some_and(|signals| {
            signals
                .iter()
                .any(|signal| signal.role != expected_signal_role)
        })
    {
        return invalid("session story mixed primary and transition evidence");
    }
    let route = route.cloned();
    let signals = signals.unwrap_or_default().to_vec();
    let evidence = role_evidence(&route, &signals, unsupported_signal_series_count)?;
    let exact_route = route.as_ref().map(|route| SessionStoryExactRoute {
        route_ref: route.route_ref.clone(),
        point_count: route.point_count,
    });
    let exact_signals = signals
        .iter()
        .map(|signal| SessionStoryExactSignal {
            signal_ref: signal.signal_ref.clone(),
            kind: signal.kind,
            unit: signal.unit,
            sample_count: signal.sample_count,
        })
        .collect();
    let mut eligible_overlays = signals
        .iter()
        .filter(|signal| signal.available_sample_count > 0)
        .filter_map(|signal| build_overlay(signal, family))
        .collect::<Vec<_>>();
    eligible_overlays.sort_by_key(|overlay| {
        (
            metric_priority(family, overlay.metric),
            signals
                .iter()
                .position(|signal| signal.signal_ref == overlay.signal_ref)
                .unwrap_or(usize::MAX),
        )
    });
    let primary_metric = eligible_overlays.first().map(|overlay| overlay.metric);
    Ok(SessionStoryRole {
        route,
        signals,
        evidence,
        primary_metric,
        eligible_overlays,
        exact_route,
        exact_signals,
    })
}

fn role_evidence(
    route: &Option<TrainingRouteOverview>,
    signals: &[TrainingSignalSeriesOverview],
    unsupported_signal_series_count: usize,
) -> Result<SessionStoryRoleEvidenceView, ApplicationError> {
    let signal_sample_count = checked_signal_sum(signals, |signal| signal.sample_count)?;
    let available_signal_sample_count =
        checked_signal_sum(signals, |signal| signal.available_sample_count)?;
    let unavailable_signal_sample_count = signal_sample_count
        .checked_sub(available_signal_sample_count)
        .ok_or(ApplicationError::InvalidTrainingSessionDetail(
            "session story signal availability is inconsistent",
        ))?;
    Ok(SessionStoryRoleEvidenceView {
        route_point_count: route.as_ref().map_or(0, |route| route.point_count),
        signal_series_count: signals.len(),
        signal_series_with_values_count: signals
            .iter()
            .filter(|signal| signal.available_sample_count > 0)
            .count(),
        partial_signal_series_count: signals
            .iter()
            .filter(|signal| {
                signal.available_sample_count > 0
                    && signal.available_sample_count < signal.sample_count
            })
            .count(),
        unavailable_signal_series_count: signals
            .iter()
            .filter(|signal| signal.sample_count > 0 && signal.available_sample_count == 0)
            .count(),
        empty_signal_series_count: signals
            .iter()
            .filter(|signal| signal.sample_count == 0)
            .count(),
        unsupported_signal_series_count,
        signal_sample_count,
        available_signal_sample_count,
        unavailable_signal_sample_count,
    })
}

fn checked_signal_sum(
    signals: &[TrainingSignalSeriesOverview],
    count: impl Fn(&TrainingSignalSeriesOverview) -> usize,
) -> Result<usize, ApplicationError> {
    signals.iter().try_fold(0usize, |total, signal| {
        total
            .checked_add(count(signal))
            .ok_or(ApplicationError::InvalidTrainingSessionDetail(
                "session story signal evidence count overflowed",
            ))
    })
}

fn exercise_evidence(
    structure: Option<&TrainingExerciseStructure>,
    zones: Option<&TrainingZoneCollectionView>,
) -> Result<SessionStoryExerciseEvidenceView, ApplicationError> {
    let zone_count = checked_zone_sum(zones, |group| group.zones.as_ref().map_or(0, Vec::len))?;
    let timed_zone_count = checked_zone_sum(zones, |group| {
        group.zones.as_ref().map_or(0, |zones| {
            zones
                .iter()
                .filter(|zone| zone.time_in_zone_milliseconds.is_some())
                .count()
        })
    })?;
    Ok(SessionStoryExerciseEvidenceView {
        has_structure: structure.is_some(),
        manual_lap_count: structure
            .and_then(|value| value.manual_laps.as_ref())
            .map_or(0, Vec::len),
        automatic_lap_count: structure
            .and_then(|value| value.automatic_laps.as_ref())
            .map_or(0, Vec::len),
        pause_count: structure
            .and_then(|value| value.pauses.as_ref())
            .map_or(0, Vec::len),
        zone_group_count: zones.map_or(0, |value| value.groups.len()),
        zone_count,
        timed_zone_count,
        unsupported_zone_group_count: zones.map_or(0, |value| value.unsupported_group_count),
    })
}

fn checked_zone_sum(
    zones: Option<&TrainingZoneCollectionView>,
    count: impl Fn(&TrainingZoneGroupView) -> usize,
) -> Result<usize, ApplicationError> {
    zones.map_or(Ok(0), |zones| {
        zones.groups.iter().try_fold(0usize, |total, group| {
            total
                .checked_add(count(group))
                .ok_or(ApplicationError::InvalidTrainingSessionDetail(
                    "session story zone evidence count overflowed",
                ))
        })
    })
}

fn build_overlay(
    signal: &TrainingSignalSeriesOverview,
    family: Option<&str>,
) -> Option<SessionStoryOverlayView> {
    let (metric, value_transform) = metric_for_signal(family, signal.kind)?;
    Some(SessionStoryOverlayView {
        signal_ref: signal.signal_ref.clone(),
        metric,
        source_kind: signal.kind,
        source_unit: signal.unit,
        value_transform,
        alignment_state: SessionStoryAlignmentStateView::Unavailable,
        aligned_samples: Vec::new(),
    })
}

fn metric_for_signal(
    family: Option<&str>,
    kind: TrainingSignalKindView,
) -> Option<(SessionStoryMetricView, SessionStoryValueTransform)> {
    let identity = SessionStoryValueTransform::Identity;
    match kind {
        TrainingSignalKindView::HeartRate => Some((SessionStoryMetricView::HeartRate, identity)),
        TrainingSignalKindView::Speed
            if matches!(family, Some("running" | "walking" | "hiking")) =>
        {
            Some((
                SessionStoryMetricView::Pace,
                SessionStoryValueTransform::KilometersPerHourToMinutesPerKilometer,
            ))
        }
        TrainingSignalKindView::Speed => Some((SessionStoryMetricView::Speed, identity)),
        TrainingSignalKindView::Distance => None,
        TrainingSignalKindView::Altitude => Some((SessionStoryMetricView::Elevation, identity)),
        TrainingSignalKindView::Cadence => Some((SessionStoryMetricView::Cadence, identity)),
        TrainingSignalKindView::Temperature => {
            Some((SessionStoryMetricView::Temperature, identity))
        }
        TrainingSignalKindView::LeftCrankPower => Some((SessionStoryMetricView::Power, identity)),
    }
}

fn metric_priority(family: Option<&str>, metric: SessionStoryMetricView) -> usize {
    match family {
        Some("cycling") => match metric {
            SessionStoryMetricView::Speed => 0,
            SessionStoryMetricView::Power => 1,
            SessionStoryMetricView::HeartRate => 2,
            SessionStoryMetricView::Elevation => 3,
            SessionStoryMetricView::Cadence => 4,
            SessionStoryMetricView::Temperature => 5,
            SessionStoryMetricView::Pace | SessionStoryMetricView::StrokeRate => 6,
        },
        Some("water-sport" | "swimming") => match metric {
            SessionStoryMetricView::Speed => 0,
            SessionStoryMetricView::HeartRate => 1,
            SessionStoryMetricView::StrokeRate => 2,
            SessionStoryMetricView::Cadence => 3,
            SessionStoryMetricView::Temperature => 4,
            SessionStoryMetricView::Elevation => 5,
            SessionStoryMetricView::Power => 6,
            SessionStoryMetricView::Pace => 7,
        },
        _ => match metric {
            SessionStoryMetricView::Pace | SessionStoryMetricView::Speed => 0,
            SessionStoryMetricView::HeartRate => 1,
            SessionStoryMetricView::Elevation => 2,
            SessionStoryMetricView::Cadence | SessionStoryMetricView::StrokeRate => 3,
            SessionStoryMetricView::Temperature => 4,
            SessionStoryMetricView::Power => 5,
        },
    }
}

fn invalid<T>(message: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidTrainingSessionDetail(message))
}
