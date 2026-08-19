use super::*;

#[derive(Clone)]
struct StubPort {
    result: Result<PersistedTrainingSessionProvenance, TrainingSessionProvenancePortError>,
}

impl TrainingSessionProvenancePort for StubPort {
    fn query_training_session_provenance(
        &self,
        _query: &TrainingSessionProvenanceQuery,
    ) -> Result<PersistedTrainingSessionProvenance, TrainingSessionProvenancePortError> {
        self.result.clone()
    }
}

fn opaque(prefix: &str, value: char) -> String {
    format!("{prefix}{}", value.to_string().repeat(64))
}

fn query() -> TrainingSessionProvenanceQuery {
    TrainingSessionProvenanceQuery {
        session_ref: opaque("session-", 'a'),
        snapshot_ref: Some(opaque("training-snapshot-", 'b')),
        offset: 0,
        limit: 2,
    }
}

fn provider(code: &str) -> TrainingSourceProviderView {
    TrainingSourceProviderView::restore(code.to_owned()).expect("valid provider code")
}

fn event(ordinal: usize, decision: TrainingProvenanceDecisionView) -> TrainingProvenanceEventView {
    TrainingProvenanceEventView {
        ordinal,
        observed_at_utc: format!("2026-08-{:02}T10:00:00Z", ordinal + 18),
        source_modified_at_utc: "2026-08-17T18:30:00Z".to_owned(),
        provider: provider("source-provider"),
        source_adapter_version: "source-adapter@10".to_owned(),
        mapping_version: "training-mapping@5".to_owned(),
        decision,
        contributes_to_visible_state: !matches!(
            decision,
            TrainingProvenanceDecisionView::Preserve | TrainingProvenanceDecisionView::Conflict
        ),
    }
}

fn persisted() -> PersistedTrainingSessionProvenance {
    PersistedTrainingSessionProvenance {
        snapshot_ref: opaque("training-snapshot-", 'b'),
        session_ref: opaque("session-", 'a'),
        total_event_count: 3,
        current: TrainingProvenanceCurrentView {
            provider: provider("source-provider"),
            source_modified_at_utc: "2026-08-17T18:30:00Z".to_owned(),
            source_adapter_version: "source-adapter@10".to_owned(),
            mapping_version: "training-mapping@5".to_owned(),
            contributing_event_count: 2,
            non_contributing_event_count: 1,
        },
        events: vec![
            event(0, TrainingProvenanceDecisionView::Create),
            event(1, TrainingProvenanceDecisionView::Enrich),
        ],
    }
}

#[test]
fn returns_a_stable_page_and_derives_its_next_offset() {
    let result = query_training_session_provenance(
        &StubPort {
            result: Ok(persisted()),
        },
        query(),
    )
    .unwrap();

    assert_eq!(result.offset, 0);
    assert_eq!(result.limit, 2);
    assert_eq!(result.next_offset, Some(2));
    assert_eq!(result.current.contributing_event_count, 2);
    assert_eq!(
        result.events[1].decision,
        TrainingProvenanceDecisionView::Enrich
    );
}

#[test]
fn accepts_the_exact_last_page() {
    let mut request = query();
    request.offset = 2;
    let mut response = persisted();
    response.events = vec![event(2, TrainingProvenanceDecisionView::Conflict)];

    let result = query_training_session_provenance(
        &StubPort {
            result: Ok(response),
        },
        request,
    )
    .unwrap();

    assert_eq!(result.next_offset, None);
    assert!(!result.events[0].contributes_to_visible_state);
}

#[test]
fn rejects_invalid_requests_before_querying_the_port() {
    for invalid in [
        TrainingSessionProvenanceQuery {
            limit: 0,
            ..query()
        },
        TrainingSessionProvenanceQuery {
            limit: 26,
            ..query()
        },
        TrainingSessionProvenanceQuery {
            offset: 1_000_000,
            ..query()
        },
        TrainingSessionProvenanceQuery {
            session_ref: "session-private".to_owned(),
            ..query()
        },
    ] {
        assert!(matches!(
            query_training_session_provenance(
                &StubPort {
                    result: Err(TrainingSessionProvenancePortError::Failure(
                        "port must not run".to_owned()
                    )),
                },
                invalid,
            ),
            Err(ApplicationError::InvalidTrainingSessionDetail(_))
        ));
    }
}

#[test]
fn rejects_inconsistent_counts_pages_and_decision_effects() {
    let mut bad_count = persisted();
    bad_count.current.non_contributing_event_count = 2;
    assert_invalid(bad_count, query());

    let mut bad_ordinal = persisted();
    bad_ordinal.events[1].ordinal = 3;
    assert_invalid(bad_ordinal, query());

    let mut wrong_effect = persisted();
    wrong_effect.events[0].contributes_to_visible_state = false;
    assert_invalid(wrong_effect, query());

    let mut short_middle_page = persisted();
    short_middle_page.events.pop();
    assert_invalid(short_middle_page, query());
}

#[test]
fn rejects_invalid_times_versions_and_provider_mismatch() {
    let mut invalid_time = persisted();
    invalid_time.events[0].observed_at_utc = "2026-08-18T10:00:00+02:00".to_owned();
    assert_invalid(invalid_time, query());

    let mut unsafe_version = persisted();
    unsafe_version.events[0].mapping_version = "private path@5".to_owned();
    assert_invalid(unsafe_version, query());

    let mut mismatched_current = persisted();
    mismatched_current.current.mapping_version = "training-mapping@4".to_owned();
    assert_invalid(mismatched_current, query());

    let mut mismatched_provider = persisted();
    mismatched_provider.events[0].provider = provider("different-source");
    assert_invalid(mismatched_provider, query());
}

#[test]
fn maps_snapshot_and_storage_failures_without_partial_results() {
    assert!(matches!(
        query_training_session_provenance(
            &StubPort {
                result: Err(TrainingSessionProvenancePortError::SnapshotChanged),
            },
            query(),
        ),
        Err(ApplicationError::TrainingSessionDetailChanged)
    ));
    assert!(matches!(
        query_training_session_provenance(
            &StubPort {
                result: Err(TrainingSessionProvenancePortError::NotFound),
            },
            query(),
        ),
        Err(ApplicationError::TrainingSessionDetail(_))
    ));
}

fn assert_invalid(
    result: PersistedTrainingSessionProvenance,
    request: TrainingSessionProvenanceQuery,
) {
    assert!(matches!(
        query_training_session_provenance(&StubPort { result: Ok(result) }, request),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}
