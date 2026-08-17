use std::{env, path::Path, process::ExitCode};

use chrono::{SecondsFormat, Utc};
use fitfreed_application::{
    load_locale_preference, save_locale_preference, LocalePreference, UpdateArtifact,
    UpdateInstallationAuthorization, UpdateRecoveryPhase,
};
use fitfreed_lib::infrastructure::{
    active_update_recovery_phase, current_update_target, library_schema_version,
    prepare_update_recovery, verify_prepared_update_recovery, PlatformApplicationCopier,
    SqliteLocalePreferences, UpdateRecoveryPreparation,
};
use serde_json::json;
use tempfile::tempdir;

fn main() -> ExitCode {
    let arguments = env::args().collect::<Vec<_>>();
    let [_, application_argument] = arguments.as_slice() else {
        println!(
            "{}",
            json!({ "accepted": false, "code": "expected-one-application-argument" })
        );
        return ExitCode::FAILURE;
    };
    let application_path = Path::new(application_argument);
    let Ok(directory) = tempdir() else {
        return report_failure("temporary-directory-unavailable");
    };
    let library_path = directory.path().join("fitfreed.sqlite");
    let preferences = SqliteLocalePreferences::new(library_path.clone());
    if save_locale_preference(&preferences, LocalePreference::EsEs).is_err() {
        return report_failure("synthetic-library-unavailable");
    }
    let Ok(target) = current_update_target() else {
        return report_failure("target-unavailable");
    };
    let authorization = UpdateInstallationAuthorization {
        version: "0.1.1".to_owned(),
        trusted_sequence: 17,
        trusted_payload_sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
            .to_owned(),
        signing_key_id: "synthetic-acceptance-key".to_owned(),
        target_library_schema_version: library_schema_version(),
        artifact: UpdateArtifact {
            target,
            package_url: "https://updates.invalid/fitfreed-0.1.1.app.tar.gz".to_owned(),
            expected_size_bytes: 1024,
            expected_sha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
                .to_owned(),
            package_signature: "synthetic-acceptance-signature".to_owned(),
        },
    };
    let recovery_root = directory.path().join("update-recovery");
    let prepared_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);
    let Ok(prepared) = prepare_update_recovery(
        &PlatformApplicationCopier,
        UpdateRecoveryPreparation {
            recovery_root: &recovery_root,
            current_application_path: application_path,
            library_path: &library_path,
            installed_version: env!("CARGO_PKG_VERSION"),
            prepared_at: &prepared_at,
            authorization: &authorization,
        },
    ) else {
        return report_failure("recovery-preparation-failed");
    };
    if verify_prepared_update_recovery(&recovery_root, prepared.recovery_id()).is_err() {
        return report_failure("recovery-verification-failed");
    }
    let Ok(Some((active_id, UpdateRecoveryPhase::Prepared))) =
        active_update_recovery_phase(&recovery_root)
    else {
        return report_failure("active-recovery-mismatch");
    };
    let Ok(Some(locale)) = load_locale_preference(&preferences) else {
        return report_failure("preserved-locale-unavailable");
    };
    let accepted = active_id == prepared.recovery_id()
        && locale == LocalePreference::EsEs
        && prepared.source_library_schema_version() == library_schema_version();
    println!(
        "{}",
        json!({
            "accepted": accepted,
            "applicationVersion": env!("CARGO_PKG_VERSION"),
            "librarySchemaVersion": prepared.source_library_schema_version(),
            "phase": "prepared",
            "localePreserved": locale == LocalePreference::EsEs,
        })
    );
    if accepted {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}

fn report_failure(code: &str) -> ExitCode {
    println!("{}", json!({ "accepted": false, "code": code }));
    ExitCode::FAILURE
}
