use std::{env, path::Path, process::ExitCode};

use fitfreed_domain::{ArtifactCoverageSummary, ImportOperationState};
use fitfreed_lib::infrastructure::{
    profile_polar_import_archive, query_activity, query_latest_import_outcome,
};
use serde_json::{json, Value};
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

    let Ok(first) = profile_polar_import_archive(&database_path, Path::new(archive)) else {
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
    let Ok(repeated) = profile_polar_import_archive(&database_path, Path::new(archive)) else {
        return report_failure(&database_path);
    };
    let one_origin = history
        .first()
        .is_none_or(|first| history.iter().all(|item| item.origin_id == first.origin_id));
    let accepted = first_outcome.state == ImportOperationState::Completed
        && first_outcome.coverage_complete
        && repeated.report.exact_repeat
        && one_origin;

    println!(
        "{}",
        json!({
            "accepted": accepted,
            "state": first_outcome.state.code(),
            "coverageComplete": first_outcome.coverage_complete,
            "coverage": coverage_json(&first_outcome.coverage),
            "recognizedArtifacts": first.report.recognized_artifacts,
            "newObservations": first.report.new_observations,
            "conflicts": first.report.conflicts,
            "historyObservations": history.len(),
            "oneOpaqueOrigin": one_origin,
            "exactRepeat": repeated.report.exact_repeat,
            "firstImportMilliseconds": first.timings.total_milliseconds,
            "exactRepeatMilliseconds": repeated.timings.total_milliseconds,
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
            "coverage": outcome.as_ref().map(|value| coverage_json(&value.coverage)),
        })
    );
    ExitCode::FAILURE
}

fn coverage_json(coverage: &ArtifactCoverageSummary) -> Value {
    json!({
        "total": coverage.total,
        "supported": coverage.supported,
        "unsupported": coverage.unsupported,
        "deliberatelyIgnored": coverage.deliberately_ignored,
        "unrecognized": coverage.unrecognized,
        "invalid": coverage.invalid,
    })
}
