use std::{env, path::Path, process::ExitCode};

use fitfreed_domain::ImportOperationState;
use fitfreed_lib::infrastructure::{
    profile_polar_import_archive, query_activity, query_latest_import_outcome,
    query_nightly_recoveries, query_sleep_periods, query_training_sessions,
};
use serde_json::json;
use tempfile::tempdir;

struct AcceptancePredicates {
    import_completed: bool,
    coverage_complete: bool,
    exact_repeat: bool,
    activity_history_available: bool,
    training_history_available: bool,
    sleep_history_available: bool,
    recovery_history_available: bool,
    one_opaque_origin: bool,
}

impl AcceptancePredicates {
    fn accepted(&self) -> bool {
        self.import_completed
            && self.coverage_complete
            && self.exact_repeat
            && self.activity_history_available
            && self.training_history_available
            && self.sleep_history_available
            && self.recovery_history_available
            && self.one_opaque_origin
    }
}

fn main() -> ExitCode {
    let arguments = env::args().collect::<Vec<_>>();
    let Some(archive) = arguments.get(1) else {
        println!(
            "{}",
            json!({ "accepted": false, "code": "missing-archive-argument" })
        );
        return ExitCode::FAILURE;
    };
    if arguments.len() != 2 {
        println!(
            "{}",
            json!({ "accepted": false, "code": "invalid-argument-count" })
        );
        return ExitCode::FAILURE;
    }
    let Ok(directory) = tempdir() else {
        println!(
            "{}",
            json!({ "accepted": false, "code": "temporary-library-unavailable" })
        );
        return ExitCode::FAILURE;
    };
    let database_path = directory.path().join("private-acceptance.sqlite");

    let Ok(_) = profile_polar_import_archive(&database_path, Path::new(archive)) else {
        return report_failure(&database_path);
    };
    let Ok(Some(first_outcome)) = query_latest_import_outcome(&database_path) else {
        println!(
            "{}",
            json!({ "accepted": false, "code": "outcome-unavailable" })
        );
        return ExitCode::FAILURE;
    };
    let Ok(history) = query_activity(&database_path) else {
        println!(
            "{}",
            json!({ "accepted": false, "code": "history-unavailable" })
        );
        return ExitCode::FAILURE;
    };
    let Ok(training_history) = query_training_sessions(&database_path) else {
        println!(
            "{}",
            json!({ "accepted": false, "code": "training-history-unavailable" })
        );
        return ExitCode::FAILURE;
    };
    let Ok(sleep_history) = query_sleep_periods(&database_path) else {
        println!(
            "{}",
            json!({ "accepted": false, "code": "sleep-history-unavailable" })
        );
        return ExitCode::FAILURE;
    };
    let Ok(recovery_history) = query_nightly_recoveries(&database_path) else {
        println!(
            "{}",
            json!({ "accepted": false, "code": "recovery-history-unavailable" })
        );
        return ExitCode::FAILURE;
    };
    let Ok(repeated) = profile_polar_import_archive(&database_path, Path::new(archive)) else {
        return report_failure(&database_path);
    };
    let one_origin = one_opaque_origin(
        history.iter().map(|item| item.origin_id.as_str()),
        training_history.iter().map(|item| item.origin_id.as_str()),
        sleep_history.iter().map(|item| item.origin_id.as_str()),
        recovery_history.iter().map(|item| item.origin_id.as_str()),
    );
    let activity_history_available = !history.is_empty();
    let training_history_available = !training_history.is_empty();
    let sleep_history_available = !sleep_history.is_empty();
    let recovery_history_available = !recovery_history.is_empty();
    let accepted = AcceptancePredicates {
        import_completed: first_outcome.state == ImportOperationState::Completed,
        coverage_complete: first_outcome.coverage_complete,
        exact_repeat: repeated.report.exact_repeat,
        activity_history_available,
        training_history_available,
        sleep_history_available,
        recovery_history_available,
        one_opaque_origin: one_origin,
    }
    .accepted();

    println!(
        "{}",
        json!({
            "accepted": accepted,
            "state": first_outcome.state.code(),
            "coverageComplete": first_outcome.coverage_complete,
            "activityHistoryAvailable": activity_history_available,
            "trainingHistoryAvailable": training_history_available,
            "sleepHistoryAvailable": sleep_history_available,
            "recoveryHistoryAvailable": recovery_history_available,
            "oneOpaqueOrigin": one_origin,
            "exactRepeat": repeated.report.exact_repeat,
        })
    );
    if accepted {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}

fn one_opaque_origin<'a>(
    activity_origins: impl IntoIterator<Item = &'a str>,
    training_origins: impl IntoIterator<Item = &'a str>,
    sleep_origins: impl IntoIterator<Item = &'a str>,
    recovery_origins: impl IntoIterator<Item = &'a str>,
) -> bool {
    let mut origins = activity_origins
        .into_iter()
        .chain(training_origins)
        .chain(sleep_origins)
        .chain(recovery_origins);
    let Some(expected) = origins.next() else {
        return false;
    };
    origins.all(|origin| origin == expected)
}

fn report_failure(database_path: &Path) -> ExitCode {
    let outcome = query_latest_import_outcome(database_path).ok().flatten();
    println!(
        "{}",
        json!({
            "accepted": false,
            "state": outcome.as_ref().map(|value| value.state.code()),
            "terminalCode": outcome.as_ref().and_then(|value| value.terminal_code.as_deref()),
            "coverageComplete": outcome.as_ref().is_some_and(|value| value.coverage_complete),
        })
    );
    ExitCode::FAILURE
}

#[cfg(test)]
mod tests {
    use super::{one_opaque_origin, AcceptancePredicates};

    fn complete_predicates() -> AcceptancePredicates {
        AcceptancePredicates {
            import_completed: true,
            coverage_complete: true,
            exact_repeat: true,
            activity_history_available: true,
            training_history_available: true,
            sleep_history_available: true,
            recovery_history_available: true,
            one_opaque_origin: true,
        }
    }

    #[test]
    fn accepts_only_complete_four_domain_evidence() {
        assert!(complete_predicates().accepted());

        let incomplete_cases = [
            AcceptancePredicates {
                import_completed: false,
                ..complete_predicates()
            },
            AcceptancePredicates {
                coverage_complete: false,
                ..complete_predicates()
            },
            AcceptancePredicates {
                exact_repeat: false,
                ..complete_predicates()
            },
            AcceptancePredicates {
                activity_history_available: false,
                ..complete_predicates()
            },
            AcceptancePredicates {
                training_history_available: false,
                ..complete_predicates()
            },
            AcceptancePredicates {
                sleep_history_available: false,
                ..complete_predicates()
            },
            AcceptancePredicates {
                recovery_history_available: false,
                ..complete_predicates()
            },
            AcceptancePredicates {
                one_opaque_origin: false,
                ..complete_predicates()
            },
        ];

        assert!(incomplete_cases
            .into_iter()
            .all(|predicates| !predicates.accepted()));
    }

    #[test]
    fn requires_one_nonempty_opaque_origin_across_every_domain() {
        assert!(one_opaque_origin(
            ["origin"],
            ["origin"],
            ["origin"],
            ["origin"]
        ));
        assert!(!one_opaque_origin([], [], [], []));
        assert!(!one_opaque_origin(
            ["origin"],
            ["origin"],
            ["origin"],
            ["different"]
        ));
        assert!(!one_opaque_origin(
            ["origin", "different"],
            ["origin"],
            ["origin"],
            ["origin"]
        ));
    }
}
