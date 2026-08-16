use std::{env, path::Path, process::ExitCode};

use fitfreed_domain::ImportOperationState;
use fitfreed_lib::infrastructure::{
    profile_polar_import_archive, query_activity, query_latest_import_outcome, query_sleep_periods,
    query_training_sessions,
};
use serde_json::json;
use tempfile::tempdir;

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
    let Ok(repeated) = profile_polar_import_archive(&database_path, Path::new(archive)) else {
        return report_failure(&database_path);
    };
    let first_origin = history
        .first()
        .map(|item| item.origin_id.as_str())
        .or_else(|| training_history.first().map(|item| item.origin_id.as_str()))
        .or_else(|| sleep_history.first().map(|item| item.origin_id.as_str()));
    let one_origin = first_origin.is_some_and(|origin| {
        history.iter().all(|item| item.origin_id == origin)
            && training_history.iter().all(|item| item.origin_id == origin)
            && sleep_history.iter().all(|item| item.origin_id == origin)
    });
    let activity_history_available = !history.is_empty();
    let training_history_available = !training_history.is_empty();
    let sleep_history_available = !sleep_history.is_empty();
    let accepted = first_outcome.state == ImportOperationState::Completed
        && first_outcome.coverage_complete
        && repeated.report.exact_repeat
        && activity_history_available
        && training_history_available
        && sleep_history_available
        && one_origin;

    println!(
        "{}",
        json!({
            "accepted": accepted,
            "state": first_outcome.state.code(),
            "coverageComplete": first_outcome.coverage_complete,
            "activityHistoryAvailable": activity_history_available,
            "trainingHistoryAvailable": training_history_available,
            "sleepHistoryAvailable": sleep_history_available,
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
