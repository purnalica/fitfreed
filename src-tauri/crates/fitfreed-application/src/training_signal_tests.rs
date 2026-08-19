use super::*;

#[derive(Clone)]
struct StubPort {
    signals: Result<PersistedTrainingSessionSignals, TrainingSessionSignalPortError>,
    samples: Result<PersistedTrainingSignalSamples, TrainingSessionSignalPortError>,
}

impl TrainingSessionSignalPort for StubPort {
    fn query_training_session_signals(
        &self,
        _query: &TrainingSessionSignalsQuery,
    ) -> Result<PersistedTrainingSessionSignals, TrainingSessionSignalPortError> {
        self.signals.clone()
    }

    fn query_training_signal_samples(
        &self,
        _query: &TrainingSignalSamplesQuery,
    ) -> Result<PersistedTrainingSignalSamples, TrainingSessionSignalPortError> {
        self.samples.clone()
    }
}

fn opaque(prefix: &str, value: char) -> String {
    format!("{prefix}{}", value.to_string().repeat(64))
}

fn sample(ordinal: usize, value: Option<f64>) -> TrainingSignalSampleView {
    TrainingSignalSampleView {
        ordinal,
        elapsed_milliseconds: i64::try_from(ordinal).unwrap() * 1_000,
        value,
    }
}

fn visual_sample(
    ordinal: usize,
    value: Option<f64>,
    gap_before: bool,
) -> TrainingSignalVisualSampleView {
    TrainingSignalVisualSampleView {
        ordinal,
        elapsed_milliseconds: i64::try_from(ordinal).unwrap() * 1_000,
        value,
        gap_before,
    }
}

fn signal_query(max_visual_samples: usize) -> TrainingSessionSignalsQuery {
    TrainingSessionSignalsQuery {
        session_ref: opaque("session-", 'a'),
        snapshot_ref: Some(opaque("training-snapshot-", 'b')),
        max_visual_samples,
    }
}

fn series() -> TrainingSignalSeriesOverview {
    TrainingSignalSeriesOverview {
        signal_ref: opaque("signal-", 'd'),
        ordinal: 0,
        role: TrainingSignalRoleView::Primary,
        kind: TrainingSignalKindView::HeartRate,
        unit: TrainingSignalUnitView::BeatsPerMinute,
        interval_milliseconds: 1_000,
        sample_count: 5,
        available_sample_count: 4,
        visual_samples: vec![
            visual_sample(0, Some(120.0), false),
            visual_sample(2, None, true),
            visual_sample(4, Some(150.0), false),
        ],
    }
}

fn persisted_signals() -> PersistedTrainingSessionSignals {
    PersistedTrainingSessionSignals {
        snapshot_ref: opaque("training-snapshot-", 'b'),
        session_ref: opaque("session-", 'a'),
        signals: Some(TrainingSessionSignalsView {
            exercises: Some(vec![TrainingExerciseSignalsView {
                exercise_ref: opaque("exercise-", 'c'),
                ordinal: 0,
                signals: Some(TrainingSignalCollectionView {
                    primary: Some(vec![series()]),
                    transition: None,
                    unsupported_primary_series_count: 1,
                    unsupported_transition_series_count: 0,
                }),
            }]),
        }),
    }
}

fn samples_query() -> TrainingSignalSamplesQuery {
    TrainingSignalSamplesQuery {
        session_ref: opaque("session-", 'a'),
        signal_ref: opaque("signal-", 'd'),
        snapshot_ref: Some(opaque("training-snapshot-", 'b')),
        offset: 2,
        limit: 2,
    }
}

fn persisted_samples() -> PersistedTrainingSignalSamples {
    PersistedTrainingSignalSamples {
        snapshot_ref: opaque("training-snapshot-", 'b'),
        session_ref: opaque("session-", 'a'),
        signal_ref: opaque("signal-", 'd'),
        exercise_ref: opaque("exercise-", 'c'),
        ordinal: 0,
        role: TrainingSignalRoleView::Primary,
        kind: TrainingSignalKindView::HeartRate,
        unit: TrainingSignalUnitView::BeatsPerMinute,
        interval_milliseconds: 1_000,
        sample_count: 5,
        offset: 2,
        samples: vec![sample(2, None), sample(3, Some(145.0))],
        next_offset: Some(4),
    }
}

fn port() -> StubPort {
    StubPort {
        signals: Ok(persisted_signals()),
        samples: Ok(persisted_samples()),
    }
}

#[test]
fn returns_a_bounded_endpoint_preserving_signal_projection_with_gaps() {
    let result = query_training_session_signals(&port(), signal_query(3)).unwrap();
    let exercises = result.signals.unwrap().exercises.unwrap();
    let primary = &exercises[0]
        .signals
        .as_ref()
        .unwrap()
        .primary
        .as_ref()
        .unwrap()[0];

    assert_eq!(
        primary
            .visual_samples
            .iter()
            .map(|sample| (sample.ordinal, sample.value, sample.gap_before))
            .collect::<Vec<_>>(),
        vec![
            (0, Some(120.0), false),
            (2, None, true),
            (4, Some(150.0), false)
        ]
    );
    assert_eq!(primary.sample_count, 5);
    assert_eq!(primary.available_sample_count, 4);
}

#[test]
fn preserves_every_signal_assessment_state() {
    for signals in [
        None,
        Some(TrainingSessionSignalsView { exercises: None }),
        Some(TrainingSessionSignalsView {
            exercises: Some(Vec::new()),
        }),
        Some(TrainingSessionSignalsView {
            exercises: Some(vec![TrainingExerciseSignalsView {
                exercise_ref: opaque("exercise-", 'c'),
                ordinal: 0,
                signals: None,
            }]),
        }),
    ] {
        let mut persisted = persisted_signals();
        persisted.signals = signals.clone();
        let mut stub = port();
        stub.signals = Ok(persisted);
        assert_eq!(
            query_training_session_signals(&stub, signal_query(3))
                .unwrap()
                .signals,
            signals
        );
    }
}

#[test]
fn rejects_wrong_units_counts_ordinals_and_projections() {
    let mut wrong_unit = persisted_signals();
    wrong_unit
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()[0]
        .unit = TrainingSignalUnitView::Watts;
    let mut stub = port();
    stub.signals = Ok(wrong_unit);
    assert!(matches!(
        query_training_session_signals(&stub, signal_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut wrong_projection = persisted_signals();
    let primary = &mut wrong_projection
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()[0];
    primary.visual_samples[1].ordinal = 1;
    primary.visual_samples[1].elapsed_milliseconds = 1_000;
    let mut stub = port();
    stub.signals = Ok(wrong_projection);
    assert!(matches!(
        query_training_session_signals(&stub, signal_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut wrong_count = persisted_signals();
    wrong_count
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()[0]
        .available_sample_count = 6;
    let mut stub = port();
    stub.signals = Ok(wrong_count);
    assert!(matches!(
        query_training_session_signals(&stub, signal_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn rejects_impossible_visual_gap_evidence_for_known_intervals() {
    let mut first_gap = persisted_signals();
    first_gap
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()[0]
        .visual_samples[0]
        .gap_before = true;
    let mut stub = port();
    stub.signals = Ok(first_gap);
    assert!(matches!(
        query_training_session_signals(&stub, signal_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut consecutive = persisted_signals();
    let primary = &mut consecutive
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()[0];
    primary.sample_count = 3;
    primary.available_sample_count = 2;
    primary.visual_samples = vec![
        visual_sample(0, Some(120.0), false),
        visual_sample(1, None, false),
        visual_sample(2, Some(150.0), false),
    ];
    let mut stub = port();
    stub.signals = Ok(consecutive);
    assert!(matches!(
        query_training_session_signals(&stub, signal_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn returns_exact_contiguous_pages_with_checked_elapsed_offsets() {
    let result = query_training_signal_samples(&port(), samples_query()).unwrap();
    assert_eq!(
        result
            .samples
            .iter()
            .map(|sample| (sample.ordinal, sample.elapsed_milliseconds, sample.value))
            .collect::<Vec<_>>(),
        vec![(2, 2_000, None), (3, 3_000, Some(145.0))]
    );
    assert_eq!(result.next_offset, Some(4));

    let mut malformed = persisted_samples();
    malformed.samples[1].ordinal = 4;
    malformed.samples[1].elapsed_milliseconds = 4_000;
    let mut stub = port();
    stub.samples = Ok(malformed);
    assert!(matches!(
        query_training_signal_samples(&stub, samples_query()),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn rejects_invalid_bounds_values_elapsed_offsets_and_stale_snapshots() {
    assert!(matches!(
        query_training_session_signals(&port(), signal_query(1)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut negative = persisted_signals();
    negative
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()[0]
        .visual_samples[0]
        .value = Some(-1.0);
    let mut stub = port();
    stub.signals = Ok(negative);
    assert!(matches!(
        query_training_session_signals(&stub, signal_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut elapsed = persisted_samples();
    elapsed.samples[0].elapsed_milliseconds = 2_001;
    let mut stub = port();
    stub.samples = Ok(elapsed);
    assert!(matches!(
        query_training_signal_samples(&stub, samples_query()),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut stub = port();
    stub.signals = Err(TrainingSessionSignalPortError::SnapshotChanged);
    assert!(matches!(
        query_training_session_signals(&stub, signal_query(3)),
        Err(ApplicationError::TrainingSessionDetailChanged)
    ));
}

#[test]
fn rejects_elapsed_multiplication_overflow() {
    let mut overflow = persisted_samples();
    overflow.offset = usize::MAX - 1;
    overflow.sample_count = usize::MAX;
    overflow.interval_milliseconds = i64::MAX;
    overflow.samples = vec![TrainingSignalSampleView {
        ordinal: usize::MAX - 1,
        elapsed_milliseconds: 0,
        value: Some(120.0),
    }];
    overflow.next_offset = None;
    let mut query = samples_query();
    query.offset = usize::MAX - 1;
    let mut stub = port();
    stub.samples = Ok(overflow);

    assert!(matches!(
        query_training_signal_samples(&stub, query),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}
