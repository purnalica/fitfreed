use std::{cell::RefCell, collections::BTreeMap};

use super::*;

#[derive(Clone)]
struct ControlledChannel {
    result: Result<UpdateChannelRead, String>,
}

impl UpdateChannelPort for ControlledChannel {
    fn fetch_update_snapshot(&self) -> Result<UpdateChannelRead, String> {
        self.result.clone()
    }
}

struct ControlledState {
    state: RefCell<PersistedUpdateState>,
    writes: RefCell<Vec<PersistedUpdateState>>,
    fail_load: bool,
    fail_save: bool,
}

impl ControlledState {
    fn new(state: PersistedUpdateState) -> Self {
        Self {
            state: RefCell::new(state),
            writes: RefCell::new(Vec::new()),
            fail_load: false,
            fail_save: false,
        }
    }

    fn failing_load() -> Self {
        Self {
            fail_load: true,
            ..Self::new(PersistedUpdateState::default())
        }
    }

    fn failing_save() -> Self {
        Self {
            fail_save: true,
            ..Self::new(PersistedUpdateState::default())
        }
    }
}

impl UpdateStatePort for ControlledState {
    fn load_update_state(&self) -> Result<PersistedUpdateState, String> {
        if self.fail_load {
            Err("synthetic state read failure".to_owned())
        } else {
            Ok(self.state.borrow().clone())
        }
    }

    fn save_update_state(&self, state: &PersistedUpdateState) -> Result<(), String> {
        if self.fail_save {
            return Err("synthetic state write failure".to_owned());
        }
        self.writes.borrow_mut().push(state.clone());
        *self.state.borrow_mut() = state.clone();
        Ok(())
    }
}

fn localized(en_us: &str, es_es: &str) -> LocalizedUpdateText {
    LocalizedUpdateText {
        values: BTreeMap::from([
            ("en-US".to_owned(), en_us.to_owned()),
            ("es-ES".to_owned(), es_es.to_owned()),
            ("es-419".to_owned(), "Synthetic regional text.".to_owned()),
            (
                "sr-Latn-RS".to_owned(),
                "Synthetic script-aware text.".to_owned(),
            ),
        ]),
    }
}

fn release(version: &str) -> UpdateRelease {
    UpdateRelease {
        version: version.to_owned(),
        published_at: "2026-08-17T00:00:00Z".to_owned(),
        minimum_supported_version: "0.1.0".to_owned(),
        minimum_readable_library_schema_version: 1,
        maximum_readable_library_schema_version: 8,
        target_library_schema_version: 9,
        release_notes: localized(
            "Verified update notes.",
            "Notas de actualización verificadas.",
        ),
        artifact: UpdateArtifact {
            target: "darwin-aarch64".to_owned(),
            package_url: "https://updates.invalid/fitfreed-0.2.0-aarch64.app.tar.gz".to_owned(),
            expected_size_bytes: 26,
            expected_sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                .to_owned(),
            package_signature: "synthetic-package-signature".to_owned(),
        },
    }
}

fn snapshot(sequence: u64, version: &str) -> AuthenticatedUpdateSnapshot {
    AuthenticatedUpdateSnapshot {
        sequence,
        payload_sha256: format!("{sequence:064x}"),
        issued_at: "2026-08-17T00:00:00Z".to_owned(),
        expires_at: "2026-08-24T00:00:00Z".to_owned(),
        release: release(version),
        withdrawn_versions: Vec::new(),
    }
}

fn withdrawal(version: &str, replacement_version: Option<&str>) -> UpdateWithdrawal {
    UpdateWithdrawal {
        version: version.to_owned(),
        reason: UpdateWithdrawalReason::DataIntegrity,
        guidance: localized(
            "Move to the verified replacement.",
            "Cambia a la sustitución verificada.",
        ),
        replacement_version: replacement_version.map(str::to_owned),
    }
}

fn context(locale: LocalePreference) -> UpdateCheckContext {
    UpdateCheckContext {
        installed_version: "0.1.0".to_owned(),
        library_schema_version: 8,
        locale,
        checked_at: "2026-08-17T12:00:00Z".to_owned(),
        trigger: UpdateCheckTrigger::Scheduled,
    }
}

fn channel(read: UpdateChannelRead) -> ControlledChannel {
    ControlledChannel { result: Ok(read) }
}

fn authenticated(snapshot: AuthenticatedUpdateSnapshot) -> UpdateChannelRead {
    UpdateChannelRead::Authenticated(Box::new(snapshot))
}

#[test]
fn authorizes_only_the_exact_fresh_candidate_and_preserves_its_package_expectations() {
    let state = ControlledState::new(PersistedUpdateState::default());
    let mut installation_context = context(LocalePreference::EnUs);
    installation_context.trigger = UpdateCheckTrigger::Scheduled;

    let authorization = authorize_update_installation(
        &channel(authenticated(snapshot(17, "0.2.0"))),
        &state,
        installation_context,
        "0.2.0",
    )
    .expect("installation authorization");

    assert_eq!(authorization.version, "0.2.0");
    assert_eq!(authorization.trusted_sequence, 17);
    assert_eq!(authorization.trusted_payload_sha256, format!("{:064x}", 17));
    assert_eq!(authorization.target_library_schema_version, 9);
    assert_eq!(authorization.artifact.target, "darwin-aarch64");
    assert_eq!(authorization.artifact.expected_size_bytes, 26);
    assert_eq!(
        authorization.artifact.expected_sha256,
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    assert_eq!(
        state
            .state
            .borrow()
            .trusted_snapshot
            .as_ref()
            .map(|trusted| trusted.sequence),
        Some(17)
    );
}

#[test]
fn refuses_changed_unavailable_and_invalid_installation_candidates() {
    let state = ControlledState::new(PersistedUpdateState::default());
    assert_eq!(
        authorize_update_installation(
            &channel(authenticated(snapshot(17, "0.2.0"))),
            &state,
            context(LocalePreference::EnUs),
            "0.3.0",
        ),
        Err(UpdateError::CandidateChanged)
    );

    assert_eq!(
        authorize_update_installation(
            &channel(authenticated(snapshot(18, "0.1.0"))),
            &ControlledState::new(PersistedUpdateState::default()),
            context(LocalePreference::EnUs),
            "0.1.0",
        ),
        Err(UpdateError::InstallationNotAllowed)
    );
    assert_eq!(
        authorize_update_installation(
            &channel(authenticated(snapshot(19, "0.2.0"))),
            &ControlledState::new(PersistedUpdateState::default()),
            context(LocalePreference::EnUs),
            "not-semver",
        ),
        Err(UpdateError::InvalidPreference)
    );
}

#[test]
fn rejects_invalid_authenticated_package_expectations_before_authorization() {
    let invalid_artifacts = [
        {
            let mut artifact = release("0.2.0").artifact;
            artifact.package_url = "http://updates.invalid/update.tar.gz".to_owned();
            artifact
        },
        {
            let mut artifact = release("0.2.0").artifact;
            artifact.expected_size_bytes = 0;
            artifact
        },
        {
            let mut artifact = release("0.2.0").artifact;
            artifact.expected_size_bytes = 1_073_741_825;
            artifact
        },
        {
            let mut artifact = release("0.2.0").artifact;
            artifact.target = "unknown-aarch64".to_owned();
            artifact
        },
        {
            let mut artifact = release("0.2.0").artifact;
            artifact.package_url = format!(
                "https://identity:secret{}updates.invalid/update.tar.gz",
                '@'
            );
            artifact
        },
        {
            let mut artifact = release("0.2.0").artifact;
            artifact.package_url =
                "https://updates.invalid/update.tar.gz#unsigned-location".to_owned();
            artifact
        },
        {
            let mut artifact = release("0.2.0").artifact;
            artifact.expected_sha256 = "invalid".to_owned();
            artifact
        },
        {
            let mut artifact = release("0.2.0").artifact;
            artifact.package_signature.clear();
            artifact
        },
    ];

    for artifact in invalid_artifacts {
        let mut candidate = snapshot(17, "0.2.0");
        candidate.release.artifact = artifact;
        let state = ControlledState::new(PersistedUpdateState::default());
        let outcome = check_for_updates(
            &channel(authenticated(candidate)),
            &state,
            context(LocalePreference::EnUs),
        )
        .expect("invalid package expectation outcome");

        assert_eq!(outcome.status, UpdateCheckStatus::Untrusted);
        assert_eq!(
            outcome.trust_failure,
            Some(UpdateTrustFailure::InvalidPayload)
        );
        assert!(outcome.installation_authorization.is_none());
        assert!(state.writes.borrow().is_empty());
    }
}

#[test]
fn reports_unconfigured_and_offline_without_changing_local_state() {
    for (read, expected) in [
        (
            UpdateChannelRead::Unconfigured,
            UpdateCheckStatus::Unconfigured,
        ),
        (UpdateChannelRead::Offline, UpdateCheckStatus::Offline),
    ] {
        let state = ControlledState::new(PersistedUpdateState::default());
        let outcome = check_for_updates(&channel(read), &state, context(LocalePreference::EnUs))
            .expect("non-blocking update outcome");

        assert_eq!(outcome.status, expected);
        assert_eq!(outcome.installed_version, "0.1.0");
        assert!(outcome.release.is_none());
        assert!(state.writes.borrow().is_empty());
    }
}

#[test]
fn accepts_a_new_snapshot_and_presents_only_the_selected_localized_release_information() {
    let state = ControlledState::new(PersistedUpdateState::default());
    let outcome = check_for_updates(
        &channel(authenticated(snapshot(17, "0.2.0"))),
        &state,
        context(LocalePreference::EsEs),
    )
    .expect("available update");

    assert_eq!(outcome.status, UpdateCheckStatus::Available);
    assert!(outcome.update_action_available);
    assert_eq!(
        outcome.release,
        Some(UpdateReleaseSummary {
            version: "0.2.0".to_owned(),
            published_at: "2026-08-17T00:00:00Z".to_owned(),
            release_notes: "Notas de actualización verificadas.".to_owned(),
            minimum_supported_version: "0.1.0".to_owned(),
            target_library_schema_version: 9,
        })
    );
    assert_eq!(state.writes.borrow().len(), 1);
    assert_eq!(
        state.state.borrow().trusted_snapshot,
        Some(TrustedSnapshotRecord {
            sequence: 17,
            payload_sha256: format!("{:064x}", 17),
            release_version: "0.2.0".to_owned(),
        })
    );
}

#[test]
fn treats_an_identical_snapshot_as_idempotent_and_preserves_its_preference() {
    let accepted = snapshot(17, "0.2.0");
    let state = ControlledState::new(PersistedUpdateState {
        trusted_snapshot: Some(TrustedSnapshotRecord {
            sequence: accepted.sequence,
            payload_sha256: accepted.payload_sha256.clone(),
            release_version: accepted.release.version.clone(),
        }),
        dismissed_version: Some("0.2.0".to_owned()),
        postponed_update: None,
    });

    let outcome = check_for_updates(
        &channel(authenticated(accepted)),
        &state,
        context(LocalePreference::EnUs),
    )
    .expect("idempotent check");

    assert_eq!(outcome.status, UpdateCheckStatus::Dismissed);
    assert!(outcome.update_action_available);
    assert!(state.writes.borrow().is_empty());
}

#[test]
fn a_manual_check_exposes_a_candidate_suppressed_from_scheduled_notifications() {
    let accepted = snapshot(17, "0.2.0");
    let state = ControlledState::new(PersistedUpdateState {
        trusted_snapshot: Some(TrustedSnapshotRecord {
            sequence: accepted.sequence,
            payload_sha256: accepted.payload_sha256.clone(),
            release_version: accepted.release.version.clone(),
        }),
        dismissed_version: Some("0.2.0".to_owned()),
        postponed_update: Some(PostponedUpdate {
            version: "0.2.0".to_owned(),
            until: "2026-08-18T12:00:00Z".to_owned(),
        }),
    });
    let mut manual_context = context(LocalePreference::EnUs);
    manual_context.trigger = UpdateCheckTrigger::Manual;

    let outcome = check_for_updates(&channel(authenticated(accepted)), &state, manual_context)
        .expect("manual update check");

    assert_eq!(outcome.status, UpdateCheckStatus::Available);
    assert!(outcome.update_action_available);
    assert!(outcome.postponed_until.is_none());
    assert!(state.writes.borrow().is_empty());
}

#[test]
fn a_newer_snapshot_supersedes_dismissal_and_postponement() {
    let state = ControlledState::new(PersistedUpdateState {
        trusted_snapshot: Some(TrustedSnapshotRecord {
            sequence: 17,
            payload_sha256: format!("{:064x}", 17),
            release_version: "0.2.0".to_owned(),
        }),
        dismissed_version: Some("0.2.0".to_owned()),
        postponed_update: Some(PostponedUpdate {
            version: "0.2.0".to_owned(),
            until: "2026-08-18T12:00:00Z".to_owned(),
        }),
    });

    let outcome = check_for_updates(
        &channel(authenticated(snapshot(18, "0.2.0"))),
        &state,
        context(LocalePreference::EnUs),
    )
    .expect("new channel snapshot");

    assert_eq!(outcome.status, UpdateCheckStatus::Available);
    assert_eq!(state.state.borrow().dismissed_version, None);
    assert_eq!(state.state.borrow().postponed_update, None);
}

#[test]
fn rejects_replay_and_equivocation_without_mutating_the_high_water_mark() {
    let state = ControlledState::new(PersistedUpdateState {
        trusted_snapshot: Some(TrustedSnapshotRecord {
            sequence: 17,
            payload_sha256: format!("{:064x}", 17),
            release_version: "0.2.0".to_owned(),
        }),
        ..PersistedUpdateState::default()
    });

    let replay = check_for_updates(
        &channel(authenticated(snapshot(16, "0.2.0"))),
        &state,
        context(LocalePreference::EnUs),
    )
    .expect("replay outcome");
    assert_eq!(replay.status, UpdateCheckStatus::Untrusted);
    assert_eq!(replay.trust_failure, Some(UpdateTrustFailure::Replay));

    let mut equivocation = snapshot(17, "0.2.0");
    equivocation.payload_sha256 = "f".repeat(64);
    let equivocation = check_for_updates(
        &channel(authenticated(equivocation)),
        &state,
        context(LocalePreference::EnUs),
    )
    .expect("equivocation outcome");
    assert_eq!(
        equivocation.trust_failure,
        Some(UpdateTrustFailure::Equivocation)
    );
    assert!(state.writes.borrow().is_empty());
}

#[test]
fn rejects_invalid_signed_policy_before_advancing_replay_state() {
    let invalid_cases = [
        {
            let mut value = snapshot(17, "0.2.0");
            value.expires_at = "2026-08-17T10:00:00Z".to_owned();
            (value, UpdateTrustFailure::Expired)
        },
        {
            let mut value = snapshot(17, "0.2.0");
            value.expires_at = "2026-09-01T00:00:00Z".to_owned();
            (value, UpdateTrustFailure::InvalidValidityWindow)
        },
        {
            let mut value = snapshot(17, "0.2.0");
            value.payload_sha256 = "A".repeat(64);
            (value, UpdateTrustFailure::InvalidPayload)
        },
        {
            let mut value = snapshot(17, "0.2.0");
            value.release.minimum_supported_version = "0.3.0".to_owned();
            (value, UpdateTrustFailure::InvalidPayload)
        },
        {
            let mut value = snapshot(17, "0.2.0");
            value.release.target_library_schema_version = 7;
            (value, UpdateTrustFailure::InvalidPayload)
        },
        {
            let mut value = snapshot(17, "0.2.0");
            value.withdrawn_versions = vec![
                withdrawal("0.1.1", None),
                withdrawal("0.1.1", Some("0.2.0")),
            ];
            (value, UpdateTrustFailure::InvalidPayload)
        },
    ];

    for (snapshot, expected_failure) in invalid_cases {
        let state = ControlledState::new(PersistedUpdateState::default());
        let outcome = check_for_updates(
            &channel(authenticated(snapshot)),
            &state,
            context(LocalePreference::EnUs),
        )
        .expect("invalid signed policy outcome");

        assert_eq!(outcome.status, UpdateCheckStatus::Untrusted);
        assert_eq!(outcome.trust_failure, Some(expected_failure));
        assert!(state.writes.borrow().is_empty());
    }
}

#[test]
fn rejects_a_signed_semver_downgrade_without_recording_the_channel_sequence() {
    let state = ControlledState::new(PersistedUpdateState::default());
    let mut installed = context(LocalePreference::EnUs);
    installed.installed_version = "0.3.0".to_owned();

    let outcome = check_for_updates(
        &channel(authenticated(snapshot(18, "0.2.0"))),
        &state,
        installed,
    )
    .expect("downgrade outcome");

    assert_eq!(outcome.status, UpdateCheckStatus::Untrusted);
    assert_eq!(outcome.trust_failure, Some(UpdateTrustFailure::Downgrade));
    assert!(state.writes.borrow().is_empty());
}

#[test]
fn gives_manual_guidance_for_unsupported_application_and_library_baselines() {
    let mut unsupported_application = snapshot(17, "0.3.0");
    unsupported_application.release.minimum_supported_version = "0.2.0".to_owned();
    let state = ControlledState::new(PersistedUpdateState::default());
    let outcome = check_for_updates(
        &channel(authenticated(unsupported_application)),
        &state,
        context(LocalePreference::EnUs),
    )
    .expect("unsupported application baseline");
    assert_eq!(outcome.status, UpdateCheckStatus::ManualRecoveryRequired);
    assert_eq!(
        outcome.manual_recovery_reason,
        Some(ManualUpdateReason::InstalledVersionUnsupported)
    );

    let mut unsupported_library = context(LocalePreference::EnUs);
    unsupported_library.library_schema_version = 9;
    let outcome = check_for_updates(
        &channel(authenticated(snapshot(18, "0.3.0"))),
        &state,
        unsupported_library,
    )
    .expect("unsupported library baseline");
    assert_eq!(
        outcome.manual_recovery_reason,
        Some(ManualUpdateReason::LibrarySchemaUnsupported)
    );
}

#[test]
fn withdrawal_guidance_is_persistent_and_a_withdrawn_candidate_is_never_available() {
    let mut safe_replacement = snapshot(17, "0.2.0");
    safe_replacement.withdrawn_versions = vec![withdrawal("0.1.0", Some("0.2.0"))];
    let state = ControlledState::new(PersistedUpdateState {
        dismissed_version: Some("0.2.0".to_owned()),
        ..PersistedUpdateState::default()
    });
    let outcome = check_for_updates(
        &channel(authenticated(safe_replacement)),
        &state,
        context(LocalePreference::EsEs),
    )
    .expect("withdrawn installed version");

    assert_eq!(outcome.status, UpdateCheckStatus::WithdrawnInstalled);
    assert!(outcome.update_action_available);
    assert_eq!(
        outcome
            .installed_withdrawal
            .expect("withdrawal guidance")
            .guidance,
        "Cambia a la sustitución verificada."
    );
    assert_eq!(outcome.manual_recovery_reason, None);

    let mut withdrawn_candidate = snapshot(18, "0.2.0");
    withdrawn_candidate.withdrawn_versions = vec![withdrawal("0.2.0", None)];
    let state = ControlledState::new(PersistedUpdateState::default());
    let outcome = check_for_updates(
        &channel(authenticated(withdrawn_candidate)),
        &state,
        context(LocalePreference::EnUs),
    )
    .expect("withdrawn candidate");
    assert_eq!(outcome.status, UpdateCheckStatus::UpToDate);
    assert!(!outcome.update_action_available);
}

#[test]
fn dismisses_and_postpones_only_the_current_trusted_candidate() {
    let state = ControlledState::new(PersistedUpdateState {
        trusted_snapshot: Some(TrustedSnapshotRecord {
            sequence: 17,
            payload_sha256: format!("{:064x}", 17),
            release_version: "0.2.0".to_owned(),
        }),
        ..PersistedUpdateState::default()
    });

    dismiss_update(&state, "0.2.0").expect("dismiss current candidate");
    assert_eq!(
        state.state.borrow().dismissed_version.as_deref(),
        Some("0.2.0")
    );

    let until = postpone_update(&state, "0.2.0", "2026-08-17T12:00:00Z")
        .expect("postpone current candidate");
    assert_eq!(until, "2026-08-18T12:00:00+00:00");
    assert_eq!(state.state.borrow().dismissed_version, None);

    let outcome = check_for_updates(
        &channel(authenticated(snapshot(17, "0.2.0"))),
        &state,
        context(LocalePreference::EnUs),
    )
    .expect("postponed candidate");
    assert_eq!(outcome.status, UpdateCheckStatus::Postponed);
    assert_eq!(outcome.postponed_until, Some(until));

    assert_eq!(
        dismiss_update(&state, "0.3.0"),
        Err(UpdateError::CandidateChanged)
    );
    assert_eq!(
        postpone_update(&state, "invalid", "2026-08-17T12:00:00Z"),
        Err(UpdateError::InvalidPreference)
    );
}

#[test]
fn reports_adapter_and_state_failures_without_inventing_channel_outcomes() {
    let channel_failure = ControlledChannel {
        result: Err("synthetic channel failure".to_owned()),
    };
    assert_eq!(
        check_for_updates(
            &channel_failure,
            &ControlledState::new(PersistedUpdateState::default()),
            context(LocalePreference::EnUs),
        ),
        Err(UpdateError::Channel)
    );
    let unconfigured = check_for_updates(
        &channel(UpdateChannelRead::Unconfigured),
        &ControlledState::failing_load(),
        context(LocalePreference::EnUs),
    )
    .expect("unconfigured channel must not need update state");
    assert_eq!(unconfigured.status, UpdateCheckStatus::Unconfigured);
    assert!(!unconfigured.update_action_available);
    assert_eq!(
        check_for_updates(
            &channel(authenticated(snapshot(17, "0.2.0"))),
            &ControlledState::failing_load(),
            context(LocalePreference::EnUs),
        ),
        Err(UpdateError::State)
    );
    assert_eq!(
        check_for_updates(
            &channel(authenticated(snapshot(17, "0.2.0"))),
            &ControlledState::failing_save(),
            context(LocalePreference::EnUs),
        ),
        Err(UpdateError::State)
    );
}

#[test]
fn preserves_stable_untrusted_reasons_from_the_cryptographic_adapter() {
    for reason in [
        UpdateTrustFailure::ResponseTooLarge,
        UpdateTrustFailure::InvalidEnvelope,
        UpdateTrustFailure::UnknownKey,
        UpdateTrustFailure::InvalidSignature,
        UpdateTrustFailure::InvalidPayload,
        UpdateTrustFailure::MirrorMismatch,
        UpdateTrustFailure::MissingTarget,
        UpdateTrustFailure::UnsupportedChannel,
    ] {
        let state = ControlledState::new(PersistedUpdateState::default());
        let outcome = check_for_updates(
            &channel(UpdateChannelRead::Untrusted(reason)),
            &state,
            context(LocalePreference::EnUs),
        )
        .expect("untrusted adapter outcome");
        assert_eq!(outcome.status, UpdateCheckStatus::Untrusted);
        assert_eq!(outcome.trust_failure, Some(reason));
        assert!(state.writes.borrow().is_empty());
    }
}
