use std::cell::{Cell, RefCell};

use fitfreed_domain::{
    reconcile_training_session_range as reconcile_range, RemovedTrainingSessionRange,
    TrainingSessionRange, TrainingSessionRangeAuthorship, TrainingSessionRangeCoordinate,
    TrainingSessionRangeEvidenceCompatibility, TrainingSessionRangeState,
};

use super::{
    adjust_training_session_range, create_training_session_range, query_training_session_ranges,
    remove_training_session_range, rename_training_session_range,
    AdjustTrainingSessionRangeRequest, ApplicationError, CreateTrainingSessionRangeRequest,
    PersistedTrainingSessionRanges, RemoveTrainingSessionRangeRequest,
    RenameTrainingSessionRangeRequest, TrainingSessionRangeCoordinateContext,
    TrainingSessionRangeExerciseContext, TrainingSessionRangePort, TrainingSessionRangePortError,
    TrainingSessionRangesQuery,
};

const SNAPSHOT_REF: &str = concat!(
    "training-snapshot-",
    "1111111111111111111111111111111111111111111111111111111111111111"
);
const SESSION_REF: &str =
    "session-2222222222222222222222222222222222222222222222222222222222222222";
const EXERCISE_REF: &str =
    "exercise-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_EXERCISE_REF: &str =
    "exercise-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ROUTE_REF: &str = "route-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const SIGNAL_REF: &str = "signal-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const EVIDENCE_REVISION: &str = concat!(
    "range-evidence-",
    "3333333333333333333333333333333333333333333333333333333333333333"
);

fn range_id(index: usize) -> String {
    format!("range-{index:064x}")
}

fn range(index: usize, title: &str, started: i64, ended: i64) -> TrainingSessionRange {
    range_on_coordinate(
        index,
        title,
        started,
        ended,
        TrainingSessionRangeCoordinate::exercise_elapsed(),
        600_000,
    )
}

fn range_on_coordinate(
    index: usize,
    title: &str,
    started: i64,
    ended: i64,
    coordinate: TrainingSessionRangeCoordinate,
    maximum_elapsed_milliseconds: i64,
) -> TrainingSessionRange {
    TrainingSessionRange::create(
        range_id(index),
        SESSION_REF,
        EXERCISE_REF,
        coordinate,
        title,
        started,
        ended,
        maximum_elapsed_milliseconds,
        EVIDENCE_REVISION,
    )
    .expect("valid range")
}

struct ControlledPort {
    persisted: RefCell<PersistedTrainingSessionRanges>,
    next_range_id: String,
    force_conflict: Cell<bool>,
    force_error: RefCell<Option<TrainingSessionRangePortError>>,
}

impl ControlledPort {
    fn new(ranges: Vec<TrainingSessionRange>) -> Self {
        Self {
            persisted: RefCell::new(PersistedTrainingSessionRanges {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                session_ref: SESSION_REF.to_owned(),
                session_duration_milliseconds: 600_000,
                evidence_revision: EVIDENCE_REVISION.to_owned(),
                exercises: vec![TrainingSessionRangeExerciseContext {
                    exercise_ref: EXERCISE_REF.to_owned(),
                    ordinal: 0,
                    coordinates: vec![
                        TrainingSessionRangeCoordinateContext {
                            coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
                            maximum_elapsed_milliseconds: 600_000,
                        },
                        TrainingSessionRangeCoordinateContext {
                            coordinate: TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF)
                                .expect("route coordinate"),
                            maximum_elapsed_milliseconds: 450_000,
                        },
                        TrainingSessionRangeCoordinateContext {
                            coordinate: TrainingSessionRangeCoordinate::signal_elapsed(SIGNAL_REF)
                                .expect("signal coordinate"),
                            maximum_elapsed_milliseconds: 599_000,
                        },
                    ],
                }],
                ranges,
            }),
            next_range_id: range_id(99),
            force_conflict: Cell::new(false),
            force_error: RefCell::new(None),
        }
    }

    fn take_error(&self) -> Result<(), TrainingSessionRangePortError> {
        self.force_error.borrow_mut().take().map_or(Ok(()), Err)
    }
}

impl TrainingSessionRangePort for ControlledPort {
    fn query_training_session_ranges(
        &self,
        _query: &TrainingSessionRangesQuery,
    ) -> Result<PersistedTrainingSessionRanges, TrainingSessionRangePortError> {
        self.take_error()?;
        Ok(self.persisted.borrow().clone())
    }

    fn new_training_session_range_id(&self) -> Result<String, TrainingSessionRangePortError> {
        self.take_error()?;
        Ok(self.next_range_id.clone())
    }

    fn create_training_session_range(
        &self,
        _snapshot_ref: &str,
        range: &TrainingSessionRange,
    ) -> Result<PersistedTrainingSessionRanges, TrainingSessionRangePortError> {
        self.take_error()?;
        if self
            .persisted
            .borrow()
            .ranges
            .iter()
            .any(|existing| existing.range_id() == range.range_id())
        {
            return Err(TrainingSessionRangePortError::AlreadyExists);
        }
        self.persisted.borrow_mut().ranges.push(range.clone());
        Ok(self.persisted.borrow().clone())
    }

    fn compare_and_save_training_session_range(
        &self,
        _snapshot_ref: &str,
        expected_revision: u64,
        range: &TrainingSessionRange,
    ) -> Result<Option<PersistedTrainingSessionRanges>, TrainingSessionRangePortError> {
        self.take_error()?;
        if self.force_conflict.get() {
            return Ok(None);
        }
        let mut persisted = self.persisted.borrow_mut();
        let existing = persisted
            .ranges
            .iter_mut()
            .find(|existing| existing.range_id() == range.range_id())
            .ok_or(TrainingSessionRangePortError::NotFound)?;
        if existing.revision() != expected_revision {
            return Ok(None);
        }
        *existing = range.clone();
        drop(persisted);
        Ok(Some(self.persisted.borrow().clone()))
    }

    fn compare_and_remove_training_session_range(
        &self,
        _snapshot_ref: &str,
        removal: &RemovedTrainingSessionRange,
    ) -> Result<Option<PersistedTrainingSessionRanges>, TrainingSessionRangePortError> {
        self.take_error()?;
        if self.force_conflict.get() {
            return Ok(None);
        }
        let mut persisted = self.persisted.borrow_mut();
        let index = persisted
            .ranges
            .iter()
            .position(|range| range.range_id() == removal.range_id())
            .ok_or(TrainingSessionRangePortError::NotFound)?;
        if persisted.ranges[index].revision() != removal.expected_revision() {
            return Ok(None);
        }
        persisted.ranges.remove(index);
        drop(persisted);
        Ok(Some(self.persisted.borrow().clone()))
    }
}

fn query() -> TrainingSessionRangesQuery {
    TrainingSessionRangesQuery {
        session_ref: SESSION_REF.to_owned(),
        snapshot_ref: Some(SNAPSHOT_REF.to_owned()),
    }
}

#[test]
fn lists_bounded_ranges_by_exercise_coordinate_and_elapsed_position() {
    let port = ControlledPort::new(vec![
        range_on_coordinate(
            3,
            "Recorded route",
            10_000,
            20_000,
            TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
            450_000,
        ),
        range(2, "Finish", 400_000, 500_000),
        range(1, "Opening", 0, 120_000),
    ]);

    let result = query_training_session_ranges(&port, query()).expect("range list");

    assert_eq!(result.snapshot_ref, SNAPSHOT_REF);
    assert_eq!(result.session_ref, SESSION_REF);
    assert_eq!(result.session_duration_milliseconds, 600_000);
    assert_eq!(result.evidence_revision, EVIDENCE_REVISION);
    assert_eq!(result.exercises.len(), 1);
    assert_eq!(result.exercises[0].exercise_ref, EXERCISE_REF);
    assert_eq!(
        result
            .ranges
            .iter()
            .map(|range| range.title())
            .collect::<Vec<_>>(),
        vec!["Opening", "Finish", "Recorded route"]
    );
}

#[test]
fn creates_and_returns_a_named_range_against_the_current_session_revision() {
    let port = ControlledPort::new(Vec::new());

    let result = create_training_session_range(
        &port,
        CreateTrainingSessionRangeRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            exercise_ref: EXERCISE_REF.to_owned(),
            coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
            title: "  Riverside effort  ".to_owned(),
            started_at_elapsed_milliseconds: 60_000,
            ended_at_elapsed_milliseconds: 180_000,
        },
    )
    .expect("created range");

    assert_eq!(result.ranges.len(), 1);
    assert_eq!(result.ranges[0].range_id(), range_id(99));
    assert_eq!(result.ranges[0].exercise_ref(), Some(EXERCISE_REF));
    assert_eq!(result.ranges[0].title(), "Riverside effort");
    assert_eq!(result.ranges[0].evidence_revision(), EVIDENCE_REVISION);
}

#[test]
fn keeps_duplicate_titles_and_overlapping_boundaries_as_distinct_authored_ranges() {
    let existing = range(1, "Riverside effort", 60_000, 180_000);
    let port = ControlledPort::new(vec![existing.clone()]);

    let result = create_training_session_range(
        &port,
        CreateTrainingSessionRangeRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            exercise_ref: EXERCISE_REF.to_owned(),
            coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
            title: "Riverside effort".to_owned(),
            started_at_elapsed_milliseconds: 120_000,
            ended_at_elapsed_milliseconds: 240_000,
        },
    )
    .expect("overlapping range with a duplicate title");

    assert_eq!(result.ranges.len(), 2);
    assert_eq!(result.ranges[0], existing);
    assert_eq!(result.ranges[1].range_id(), range_id(99));
    assert_eq!(result.ranges[1].title(), "Riverside effort");
    assert_eq!(result.ranges[1].started_at_elapsed_milliseconds(), 120_000);
    assert_eq!(result.ranges[1].ended_at_elapsed_milliseconds(), 240_000);
}

#[test]
fn validates_boundaries_against_the_selected_coordinate_not_exercise_duration() {
    let port = ControlledPort::new(Vec::new());
    let route_coordinate =
        TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate");

    assert!(matches!(
        create_training_session_range(
            &port,
            CreateTrainingSessionRangeRequest {
                session_ref: SESSION_REF.to_owned(),
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                exercise_ref: EXERCISE_REF.to_owned(),
                coordinate: route_coordinate.clone(),
                title: "Outside recorded route".to_owned(),
                started_at_elapsed_milliseconds: 400_000,
                ended_at_elapsed_milliseconds: 500_000,
            },
        ),
        Err(ApplicationError::InvalidTrainingSessionRange(_))
    ));
    assert!(port.persisted.borrow().ranges.is_empty());

    let result = create_training_session_range(
        &port,
        CreateTrainingSessionRangeRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            exercise_ref: EXERCISE_REF.to_owned(),
            coordinate: route_coordinate,
            title: "Recorded route finish".to_owned(),
            started_at_elapsed_milliseconds: 300_000,
            ended_at_elapsed_milliseconds: 450_000,
        },
    )
    .expect("route-relative range");

    assert_eq!(result.ranges[0].coordinate().reference(), Some(ROUTE_REF));
}

#[test]
fn renames_idempotently_and_rejects_a_stale_revision() {
    let port = ControlledPort::new(vec![range(1, "Opening", 0, 120_000)]);
    let unchanged = rename_training_session_range(
        &port,
        RenameTrainingSessionRangeRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            range_ref: range_id(1),
            expected_revision: 1,
            title: "Opening".to_owned(),
        },
    )
    .expect("unchanged rename");
    assert_eq!(unchanged.ranges[0].revision(), 1);

    let renamed = rename_training_session_range(
        &port,
        RenameTrainingSessionRangeRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            range_ref: range_id(1),
            expected_revision: 1,
            title: "First climb".to_owned(),
        },
    )
    .expect("renamed range");
    assert_eq!(renamed.ranges[0].title(), "First climb");
    assert_eq!(renamed.ranges[0].revision(), 2);

    assert!(matches!(
        rename_training_session_range(
            &port,
            RenameTrainingSessionRangeRequest {
                session_ref: SESSION_REF.to_owned(),
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                range_ref: range_id(1),
                expected_revision: 1,
                title: "Stale overwrite".to_owned(),
            },
        ),
        Err(ApplicationError::TrainingSessionRangeConflict)
    ));
}

#[test]
fn adjusts_current_boundaries_and_completes_review_against_current_evidence() {
    let original = range(1, "Opening", 0, 120_000);
    let review_required = reconcile_range(
        &original,
        Some(600_000),
        EVIDENCE_REVISION,
        TrainingSessionRangeEvidenceCompatibility::Incompatible,
    )
    .expect("review-required range");
    let port = ControlledPort::new(vec![review_required]);

    let result = adjust_training_session_range(
        &port,
        AdjustTrainingSessionRangeRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            range_ref: range_id(1),
            expected_revision: 2,
            exercise_ref: EXERCISE_REF.to_owned(),
            coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
            started_at_elapsed_milliseconds: 30_000,
            ended_at_elapsed_milliseconds: 150_000,
        },
    )
    .expect("reviewed range");

    assert_eq!(result.ranges[0].state(), TrainingSessionRangeState::Current);
    assert_eq!(result.ranges[0].started_at_elapsed_milliseconds(), 30_000);
    assert_eq!(result.ranges[0].revision(), 3);
}

#[test]
fn anchors_a_preserved_legacy_range_only_through_explicit_review() {
    let legacy = TrainingSessionRange::restore(
        range_id(1),
        SESSION_REF,
        None,
        TrainingSessionRangeCoordinate::legacy_session_elapsed(),
        "Legacy selection",
        60_000,
        180_000,
        EVIDENCE_REVISION,
        TrainingSessionRangeAuthorship::User,
        TrainingSessionRangeState::ReviewRequired,
        2,
    )
    .expect("legacy range");
    let port = ControlledPort::new(vec![legacy]);

    let result = adjust_training_session_range(
        &port,
        AdjustTrainingSessionRangeRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            range_ref: range_id(1),
            expected_revision: 2,
            exercise_ref: EXERCISE_REF.to_owned(),
            coordinate: TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF)
                .expect("route coordinate"),
            started_at_elapsed_milliseconds: 30_000,
            ended_at_elapsed_milliseconds: 150_000,
        },
    )
    .expect("anchored range");

    assert_eq!(result.ranges[0].exercise_ref(), Some(EXERCISE_REF));
    assert_eq!(result.ranges[0].state(), TrainingSessionRangeState::Current);
    assert_eq!(result.ranges[0].revision(), 3);
}

#[test]
fn rejects_an_unknown_or_changed_exercise_owner_without_mutation() {
    let port = ControlledPort::new(vec![range(1, "Opening", 0, 120_000)]);
    port.persisted
        .borrow_mut()
        .exercises
        .push(TrainingSessionRangeExerciseContext {
            exercise_ref: OTHER_EXERCISE_REF.to_owned(),
            ordinal: 1,
            coordinates: vec![TrainingSessionRangeCoordinateContext {
                coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
                maximum_elapsed_milliseconds: 600_000,
            }],
        });

    for exercise_ref in [
        OTHER_EXERCISE_REF.to_owned(),
        format!("exercise-{}", "c".repeat(64)),
    ] {
        assert!(matches!(
            adjust_training_session_range(
                &port,
                AdjustTrainingSessionRangeRequest {
                    session_ref: SESSION_REF.to_owned(),
                    snapshot_ref: SNAPSHOT_REF.to_owned(),
                    range_ref: range_id(1),
                    expected_revision: 1,
                    exercise_ref,
                    coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
                    started_at_elapsed_milliseconds: 30_000,
                    ended_at_elapsed_milliseconds: 150_000,
                },
            ),
            Err(ApplicationError::InvalidTrainingSessionRange(_))
                | Err(ApplicationError::TrainingSessionRangeNotFound)
        ));
    }
    assert_eq!(
        port.persisted.borrow().ranges[0],
        range(1, "Opening", 0, 120_000)
    );
}

#[test]
fn removes_only_the_exact_revision_bound_range() {
    let port = ControlledPort::new(vec![
        range(1, "Opening", 0, 120_000),
        range(2, "Finish", 400_000, 500_000),
    ]);

    let result = remove_training_session_range(
        &port,
        RemoveTrainingSessionRangeRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            range_ref: range_id(1),
            expected_revision: 1,
        },
    )
    .expect("removed range");

    assert_eq!(result.ranges.len(), 1);
    assert_eq!(result.ranges[0].range_id(), range_id(2));
}

#[test]
fn rejects_malformed_stale_foreign_and_unbounded_results() {
    let port = ControlledPort::new(vec![range(1, "Opening", 0, 120_000)]);
    port.persisted.borrow_mut().session_ref = range_id(8);
    assert!(matches!(
        query_training_session_ranges(&port, query()),
        Err(ApplicationError::TrainingSessionRangesChanged)
    ));

    port.persisted.borrow_mut().session_ref = SESSION_REF.to_owned();
    port.persisted.borrow_mut().snapshot_ref = format!("training-snapshot-{}", "f".repeat(64));
    assert!(matches!(
        query_training_session_ranges(&port, query()),
        Err(ApplicationError::TrainingSessionRangesChanged)
    ));

    port.persisted.borrow_mut().snapshot_ref = SNAPSHOT_REF.to_owned();
    port.persisted.borrow_mut().ranges = (0..1_001)
        .map(|index| range(index + 1, "Overlap", 0, 1))
        .collect();
    assert!(matches!(
        query_training_session_ranges(&port, query()),
        Err(ApplicationError::TrainingSessionRangeQuery(_))
    ));
}

#[test]
fn rejects_duplicate_or_missing_exercise_context_for_current_ranges() {
    let port = ControlledPort::new(vec![range(1, "Opening", 0, 120_000)]);
    port.persisted
        .borrow_mut()
        .exercises
        .push(TrainingSessionRangeExerciseContext {
            exercise_ref: OTHER_EXERCISE_REF.to_owned(),
            ordinal: 0,
            coordinates: vec![TrainingSessionRangeCoordinateContext {
                coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
                maximum_elapsed_milliseconds: 600_000,
            }],
        });
    assert!(matches!(
        query_training_session_ranges(&port, query()),
        Err(ApplicationError::TrainingSessionRangeQuery(_))
    ));

    port.persisted.borrow_mut().exercises.clear();
    assert!(matches!(
        query_training_session_ranges(&port, query()),
        Err(ApplicationError::TrainingSessionRangeQuery(_))
    ));
}

#[test]
fn rejects_duplicate_or_invalid_coordinate_authority() {
    let port = ControlledPort::new(vec![range(1, "Opening", 0, 120_000)]);
    port.persisted.borrow_mut().exercises[0].coordinates.push(
        TrainingSessionRangeCoordinateContext {
            coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
            maximum_elapsed_milliseconds: 600_000,
        },
    );
    assert!(matches!(
        query_training_session_ranges(&port, query()),
        Err(ApplicationError::TrainingSessionRangeQuery(_))
    ));

    port.persisted.borrow_mut().exercises[0].coordinates.pop();
    port.persisted.borrow_mut().exercises[0].coordinates[0].maximum_elapsed_milliseconds = -1;
    assert!(matches!(
        query_training_session_ranges(&port, query()),
        Err(ApplicationError::TrainingSessionRangeQuery(_))
    ));

    let missing_exercise_coordinate = ControlledPort::new(Vec::new());
    missing_exercise_coordinate.persisted.borrow_mut().exercises[0]
        .coordinates
        .retain(|context| context.coordinate != TrainingSessionRangeCoordinate::exercise_elapsed());
    assert!(matches!(
        query_training_session_ranges(&missing_exercise_coordinate, query()),
        Err(ApplicationError::TrainingSessionRangeQuery(_))
    ));

    let empty_coordinates = ControlledPort::new(Vec::new());
    empty_coordinates.persisted.borrow_mut().exercises[0]
        .coordinates
        .clear();
    assert!(matches!(
        query_training_session_ranges(&empty_coordinates, query()),
        Err(ApplicationError::TrainingSessionRangeQuery(_))
    ));
}

#[test]
fn maps_snapshot_conflict_not_found_and_storage_failures_without_partial_success() {
    let port = ControlledPort::new(vec![range(1, "Opening", 0, 120_000)]);
    for (failure, expected) in [
        (
            TrainingSessionRangePortError::SnapshotChanged,
            "snapshot-changed",
        ),
        (TrainingSessionRangePortError::NotFound, "not-found"),
        (
            TrainingSessionRangePortError::Failure("disk unavailable".to_owned()),
            "failure",
        ),
    ] {
        *port.force_error.borrow_mut() = Some(failure);
        let result = query_training_session_ranges(&port, query());
        match expected {
            "snapshot-changed" => assert!(matches!(
                result,
                Err(ApplicationError::TrainingSessionRangesChanged)
            )),
            "not-found" => assert!(matches!(
                result,
                Err(ApplicationError::TrainingSessionRangeNotFound)
            )),
            _ => assert!(matches!(
                result,
                Err(ApplicationError::TrainingSessionRangeQuery(_))
            )),
        }
    }

    port.force_conflict.set(true);
    assert!(matches!(
        rename_training_session_range(
            &port,
            RenameTrainingSessionRangeRequest {
                session_ref: SESSION_REF.to_owned(),
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                range_ref: range_id(1),
                expected_revision: 1,
                title: "Concurrent".to_owned(),
            },
        ),
        Err(ApplicationError::TrainingSessionRangeConflict)
    ));
    assert_eq!(port.persisted.borrow().ranges[0].title(), "Opening");
}

#[test]
fn rejects_invalid_capabilities_revisions_titles_and_boundaries_before_mutation() {
    let port = ControlledPort::new(vec![range(1, "Opening", 0, 120_000)]);

    assert!(matches!(
        create_training_session_range(
            &port,
            CreateTrainingSessionRangeRequest {
                session_ref: "invalid".to_owned(),
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                exercise_ref: EXERCISE_REF.to_owned(),
                coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
                title: "Selection".to_owned(),
                started_at_elapsed_milliseconds: 0,
                ended_at_elapsed_milliseconds: 1,
            },
        ),
        Err(ApplicationError::InvalidTrainingSessionRange(_))
    ));
    assert!(matches!(
        rename_training_session_range(
            &port,
            RenameTrainingSessionRangeRequest {
                session_ref: SESSION_REF.to_owned(),
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                range_ref: range_id(1),
                expected_revision: 0,
                title: "Selection".to_owned(),
            },
        ),
        Err(ApplicationError::InvalidTrainingSessionRange(_))
    ));
    assert!(matches!(
        adjust_training_session_range(
            &port,
            AdjustTrainingSessionRangeRequest {
                session_ref: SESSION_REF.to_owned(),
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                range_ref: range_id(1),
                expected_revision: 1,
                exercise_ref: EXERCISE_REF.to_owned(),
                coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
                started_at_elapsed_milliseconds: 200_000,
                ended_at_elapsed_milliseconds: 100_000,
            },
        ),
        Err(ApplicationError::InvalidTrainingSessionRange(_))
    ));
    assert_eq!(port.persisted.borrow().ranges.len(), 1);
    assert_eq!(port.persisted.borrow().ranges[0].title(), "Opening");
}
