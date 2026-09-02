use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateRecoveryOutcomeKind {
    Updated,
    Recovered,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateRecoveryOutcome {
    pub recovery_id: String,
    pub kind: UpdateRecoveryOutcomeKind,
    pub source_version: String,
    pub target_version: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateRecoveryPhase {
    Prepared,
    ReplacementStarted,
    ReplacementInstalled,
    Launching,
    Confirmed,
    Recovering,
    Recovered,
    RecoveryFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackagedUpdateRecoveryPhase {
    Prepared,
    ReplacementStarted,
    ReplacementInstalled,
    Launching,
    Confirmed,
    Recovering,
    NativeRecoveryUnavailable,
    Recovered,
    RecoveryFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateRecoveryWatchdogEvent {
    Observe,
    DeadlineExpired,
    ReplacementExited,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateRecoveryWatchdogAction {
    Wait,
    LaunchReplacement,
    BeginRecovery,
    RestorePrevious,
    StopBeforeReplacement,
    FinishConfirmed,
    FinishRecovered,
    FinishFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackagedUpdateRecoveryWatchdogAction {
    Wait,
    LaunchReplacement,
    BeginRecovery,
    RestorePrevious,
    LaunchRunnablePredecessor,
    StopBeforeReplacement,
    FinishConfirmed,
    FinishRecovered,
    FinishFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackagedUpdateRecoveryStartupAction {
    NoAction,
    ResumeWatchdog,
    AwaitExplicitNativeRecoveryRetry,
}

pub const MAX_PACKAGED_UPDATE_RECOVERY_ATTEMPTS: u8 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackagedUpdateRecoveryInterventionKind {
    NativeRecoveryRetryAvailable,
    ManualReinstallRequired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackagedUpdateRecoveryIntervention {
    pub kind: PackagedUpdateRecoveryInterventionKind,
    pub source_version: String,
    pub target_version: String,
    pub attempts_completed: u8,
    pub maximum_attempts: u8,
}

#[derive(Debug, Clone, Copy, Error, PartialEq, Eq)]
pub enum PackagedUpdateRecoveryRetryError {
    #[error("native update recovery retry is unavailable")]
    Unavailable,
    #[error("native update recovery retry attempts are exhausted")]
    Exhausted,
}

pub fn describe_packaged_update_recovery_intervention(
    phase: PackagedUpdateRecoveryPhase,
    source_version: &str,
    target_version: &str,
    attempts_completed: u8,
) -> Option<PackagedUpdateRecoveryIntervention> {
    let kind = match phase {
        PackagedUpdateRecoveryPhase::NativeRecoveryUnavailable
            if (1..MAX_PACKAGED_UPDATE_RECOVERY_ATTEMPTS).contains(&attempts_completed) =>
        {
            PackagedUpdateRecoveryInterventionKind::NativeRecoveryRetryAvailable
        }
        PackagedUpdateRecoveryPhase::RecoveryFailed
            if attempts_completed == MAX_PACKAGED_UPDATE_RECOVERY_ATTEMPTS =>
        {
            PackagedUpdateRecoveryInterventionKind::ManualReinstallRequired
        }
        _ => return None,
    };
    Some(PackagedUpdateRecoveryIntervention {
        kind,
        source_version: source_version.to_owned(),
        target_version: target_version.to_owned(),
        attempts_completed,
        maximum_attempts: MAX_PACKAGED_UPDATE_RECOVERY_ATTEMPTS,
    })
}

pub fn authorize_packaged_update_recovery_retry(
    phase: PackagedUpdateRecoveryPhase,
    attempts_completed: u8,
) -> Result<(), PackagedUpdateRecoveryRetryError> {
    if phase == PackagedUpdateRecoveryPhase::RecoveryFailed
        || attempts_completed >= MAX_PACKAGED_UPDATE_RECOVERY_ATTEMPTS
    {
        return Err(PackagedUpdateRecoveryRetryError::Exhausted);
    }
    if phase != PackagedUpdateRecoveryPhase::NativeRecoveryUnavailable
        || !(1..MAX_PACKAGED_UPDATE_RECOVERY_ATTEMPTS).contains(&attempts_completed)
    {
        return Err(PackagedUpdateRecoveryRetryError::Unavailable);
    }
    Ok(())
}

pub fn decide_packaged_update_recovery_startup_action(
    phase: PackagedUpdateRecoveryPhase,
) -> PackagedUpdateRecoveryStartupAction {
    use PackagedUpdateRecoveryPhase as Phase;
    use PackagedUpdateRecoveryStartupAction as Action;

    match phase {
        Phase::Prepared
        | Phase::ReplacementStarted
        | Phase::ReplacementInstalled
        | Phase::Launching
        | Phase::Recovering => Action::ResumeWatchdog,
        Phase::NativeRecoveryUnavailable => Action::AwaitExplicitNativeRecoveryRetry,
        Phase::Confirmed | Phase::Recovered | Phase::RecoveryFailed => Action::NoAction,
    }
}

pub fn decide_packaged_update_recovery_watchdog_action(
    phase: PackagedUpdateRecoveryPhase,
    event: UpdateRecoveryWatchdogEvent,
) -> PackagedUpdateRecoveryWatchdogAction {
    use PackagedUpdateRecoveryPhase as Phase;
    use PackagedUpdateRecoveryWatchdogAction as Action;
    use UpdateRecoveryWatchdogEvent as Event;

    match (phase, event) {
        (Phase::Prepared, Event::DeadlineExpired) => Action::StopBeforeReplacement,
        (Phase::Prepared, _) => Action::Wait,
        (Phase::ReplacementStarted, Event::Observe) => Action::Wait,
        (Phase::ReplacementStarted, _) => Action::BeginRecovery,
        (Phase::ReplacementInstalled, Event::Observe) => Action::LaunchReplacement,
        (Phase::ReplacementInstalled, _) => Action::BeginRecovery,
        (Phase::Launching, Event::Observe) => Action::Wait,
        (Phase::Launching, _) => Action::BeginRecovery,
        (Phase::Confirmed, _) => Action::FinishConfirmed,
        (Phase::Recovering, _) => Action::RestorePrevious,
        (Phase::NativeRecoveryUnavailable, _) => Action::LaunchRunnablePredecessor,
        (Phase::Recovered, _) => Action::FinishRecovered,
        (Phase::RecoveryFailed, _) => Action::FinishFailed,
    }
}

pub fn decide_update_recovery_watchdog_action(
    phase: UpdateRecoveryPhase,
    event: UpdateRecoveryWatchdogEvent,
) -> UpdateRecoveryWatchdogAction {
    use UpdateRecoveryPhase as Phase;
    use UpdateRecoveryWatchdogAction as Action;
    use UpdateRecoveryWatchdogEvent as Event;

    match (phase, event) {
        (Phase::Prepared, Event::DeadlineExpired) => Action::StopBeforeReplacement,
        (Phase::Prepared, _) => Action::Wait,
        (Phase::ReplacementStarted, Event::Observe) => Action::Wait,
        (Phase::ReplacementStarted, _) => Action::BeginRecovery,
        (Phase::ReplacementInstalled, Event::Observe) => Action::LaunchReplacement,
        (Phase::ReplacementInstalled, _) => Action::BeginRecovery,
        (Phase::Launching, Event::Observe) => Action::Wait,
        (Phase::Launching, _) => Action::BeginRecovery,
        (Phase::Confirmed, _) => Action::FinishConfirmed,
        (Phase::Recovering, _) => Action::RestorePrevious,
        (Phase::Recovered, _) => Action::FinishRecovered,
        (Phase::RecoveryFailed, _) => Action::FinishFailed,
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
#[error("invalid update recovery transition from {current:?} to {next:?}")]
pub struct InvalidUpdateRecoveryTransition {
    pub current: UpdateRecoveryPhase,
    pub next: UpdateRecoveryPhase,
}

#[derive(Debug, Error, PartialEq, Eq)]
#[error("invalid packaged update recovery transition from {current:?} to {next:?}")]
pub struct InvalidPackagedUpdateRecoveryTransition {
    pub current: PackagedUpdateRecoveryPhase,
    pub next: PackagedUpdateRecoveryPhase,
}

pub fn validate_packaged_update_recovery_transition(
    current: PackagedUpdateRecoveryPhase,
    next: PackagedUpdateRecoveryPhase,
) -> Result<(), InvalidPackagedUpdateRecoveryTransition> {
    use PackagedUpdateRecoveryPhase as Phase;

    if matches!(
        (current, next),
        (Phase::Prepared, Phase::ReplacementStarted)
            | (
                Phase::ReplacementStarted,
                Phase::ReplacementInstalled | Phase::Recovering
            )
            | (
                Phase::ReplacementInstalled,
                Phase::Launching | Phase::Recovering
            )
            | (Phase::Launching, Phase::Confirmed | Phase::Recovering)
            | (
                Phase::Recovering,
                Phase::Recovered | Phase::NativeRecoveryUnavailable | Phase::RecoveryFailed
            )
            | (Phase::NativeRecoveryUnavailable, Phase::Recovering)
    ) {
        Ok(())
    } else {
        Err(InvalidPackagedUpdateRecoveryTransition { current, next })
    }
}

pub fn validate_update_recovery_transition(
    current: UpdateRecoveryPhase,
    next: UpdateRecoveryPhase,
) -> Result<(), InvalidUpdateRecoveryTransition> {
    if matches!(
        (current, next),
        (
            UpdateRecoveryPhase::Prepared,
            UpdateRecoveryPhase::ReplacementStarted
        ) | (
            UpdateRecoveryPhase::ReplacementStarted,
            UpdateRecoveryPhase::ReplacementInstalled | UpdateRecoveryPhase::Recovering
        ) | (
            UpdateRecoveryPhase::ReplacementInstalled,
            UpdateRecoveryPhase::Launching | UpdateRecoveryPhase::Recovering
        ) | (
            UpdateRecoveryPhase::Launching,
            UpdateRecoveryPhase::Confirmed | UpdateRecoveryPhase::Recovering
        ) | (
            UpdateRecoveryPhase::Recovering,
            UpdateRecoveryPhase::Recovered | UpdateRecoveryPhase::RecoveryFailed
        )
    ) {
        Ok(())
    } else {
        Err(InvalidUpdateRecoveryTransition { current, next })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PHASES: [UpdateRecoveryPhase; 8] = [
        UpdateRecoveryPhase::Prepared,
        UpdateRecoveryPhase::ReplacementStarted,
        UpdateRecoveryPhase::ReplacementInstalled,
        UpdateRecoveryPhase::Launching,
        UpdateRecoveryPhase::Confirmed,
        UpdateRecoveryPhase::Recovering,
        UpdateRecoveryPhase::Recovered,
        UpdateRecoveryPhase::RecoveryFailed,
    ];

    #[test]
    fn accepts_only_the_documented_recovery_transitions() {
        let allowed = [
            (
                UpdateRecoveryPhase::Prepared,
                UpdateRecoveryPhase::ReplacementStarted,
            ),
            (
                UpdateRecoveryPhase::ReplacementStarted,
                UpdateRecoveryPhase::ReplacementInstalled,
            ),
            (
                UpdateRecoveryPhase::ReplacementStarted,
                UpdateRecoveryPhase::Recovering,
            ),
            (
                UpdateRecoveryPhase::ReplacementInstalled,
                UpdateRecoveryPhase::Launching,
            ),
            (
                UpdateRecoveryPhase::ReplacementInstalled,
                UpdateRecoveryPhase::Recovering,
            ),
            (
                UpdateRecoveryPhase::Launching,
                UpdateRecoveryPhase::Confirmed,
            ),
            (
                UpdateRecoveryPhase::Launching,
                UpdateRecoveryPhase::Recovering,
            ),
            (
                UpdateRecoveryPhase::Recovering,
                UpdateRecoveryPhase::Recovered,
            ),
            (
                UpdateRecoveryPhase::Recovering,
                UpdateRecoveryPhase::RecoveryFailed,
            ),
        ];

        for current in PHASES {
            for next in PHASES {
                let transition = validate_update_recovery_transition(current, next);
                if allowed.contains(&(current, next)) {
                    assert_eq!(transition, Ok(()));
                } else {
                    assert_eq!(
                        transition,
                        Err(InvalidUpdateRecoveryTransition { current, next })
                    );
                }
            }
        }
    }

    #[test]
    fn directs_watchdog_process_work_from_persisted_phase_and_observed_event() {
        use UpdateRecoveryPhase as Phase;
        use UpdateRecoveryWatchdogAction as Action;
        use UpdateRecoveryWatchdogEvent as Event;

        let expectations = [
            (Phase::Prepared, Event::Observe, Action::Wait),
            (
                Phase::Prepared,
                Event::DeadlineExpired,
                Action::StopBeforeReplacement,
            ),
            (Phase::ReplacementStarted, Event::Observe, Action::Wait),
            (
                Phase::ReplacementStarted,
                Event::DeadlineExpired,
                Action::BeginRecovery,
            ),
            (
                Phase::ReplacementInstalled,
                Event::Observe,
                Action::LaunchReplacement,
            ),
            (
                Phase::ReplacementInstalled,
                Event::DeadlineExpired,
                Action::BeginRecovery,
            ),
            (Phase::Launching, Event::Observe, Action::Wait),
            (
                Phase::Launching,
                Event::ReplacementExited,
                Action::BeginRecovery,
            ),
            (
                Phase::Launching,
                Event::DeadlineExpired,
                Action::BeginRecovery,
            ),
            (Phase::Confirmed, Event::Observe, Action::FinishConfirmed),
            (Phase::Recovering, Event::Observe, Action::RestorePrevious),
            (Phase::Recovered, Event::Observe, Action::FinishRecovered),
            (Phase::RecoveryFailed, Event::Observe, Action::FinishFailed),
        ];

        for (phase, event, expected) in expectations {
            assert_eq!(
                decide_update_recovery_watchdog_action(phase, event),
                expected
            );
        }
    }

    #[test]
    fn accepts_only_the_documented_packaged_recovery_transitions() {
        use PackagedUpdateRecoveryPhase as Phase;

        const PHASES: [Phase; 9] = [
            Phase::Prepared,
            Phase::ReplacementStarted,
            Phase::ReplacementInstalled,
            Phase::Launching,
            Phase::Confirmed,
            Phase::Recovering,
            Phase::NativeRecoveryUnavailable,
            Phase::Recovered,
            Phase::RecoveryFailed,
        ];
        let allowed = [
            (Phase::Prepared, Phase::ReplacementStarted),
            (Phase::ReplacementStarted, Phase::ReplacementInstalled),
            (Phase::ReplacementStarted, Phase::Recovering),
            (Phase::ReplacementInstalled, Phase::Launching),
            (Phase::ReplacementInstalled, Phase::Recovering),
            (Phase::Launching, Phase::Confirmed),
            (Phase::Launching, Phase::Recovering),
            (Phase::Recovering, Phase::Recovered),
            (Phase::Recovering, Phase::NativeRecoveryUnavailable),
            (Phase::Recovering, Phase::RecoveryFailed),
            (Phase::NativeRecoveryUnavailable, Phase::Recovering),
        ];

        for current in PHASES {
            for next in PHASES {
                let transition = validate_packaged_update_recovery_transition(current, next);
                assert_eq!(transition.is_ok(), allowed.contains(&(current, next)));
            }
        }
    }

    #[test]
    fn directs_packaged_recovery_without_treating_fallback_as_recovered() {
        use PackagedUpdateRecoveryPhase as Phase;
        use PackagedUpdateRecoveryWatchdogAction as Action;
        use UpdateRecoveryWatchdogEvent as Event;

        let expectations = [
            (Phase::Prepared, Event::Observe, Action::Wait),
            (
                Phase::Prepared,
                Event::DeadlineExpired,
                Action::StopBeforeReplacement,
            ),
            (
                Phase::ReplacementStarted,
                Event::ReplacementExited,
                Action::BeginRecovery,
            ),
            (
                Phase::ReplacementInstalled,
                Event::Observe,
                Action::LaunchReplacement,
            ),
            (
                Phase::Launching,
                Event::ReplacementExited,
                Action::BeginRecovery,
            ),
            (Phase::Confirmed, Event::Observe, Action::FinishConfirmed),
            (Phase::Recovering, Event::Observe, Action::RestorePrevious),
            (
                Phase::NativeRecoveryUnavailable,
                Event::Observe,
                Action::LaunchRunnablePredecessor,
            ),
            (Phase::Recovered, Event::Observe, Action::FinishRecovered),
            (Phase::RecoveryFailed, Event::Observe, Action::FinishFailed),
        ];

        for (phase, event, expected) in expectations {
            assert_eq!(
                decide_packaged_update_recovery_watchdog_action(phase, event),
                expected
            );
        }
    }

    #[test]
    fn resumes_only_interrupted_packaged_recovery_work_on_startup() {
        use PackagedUpdateRecoveryPhase as Phase;
        use PackagedUpdateRecoveryStartupAction as Action;

        let expectations = [
            (Phase::Prepared, Action::ResumeWatchdog),
            (Phase::ReplacementStarted, Action::ResumeWatchdog),
            (Phase::ReplacementInstalled, Action::ResumeWatchdog),
            (Phase::Launching, Action::ResumeWatchdog),
            (Phase::Confirmed, Action::NoAction),
            (Phase::Recovering, Action::ResumeWatchdog),
            (
                Phase::NativeRecoveryUnavailable,
                Action::AwaitExplicitNativeRecoveryRetry,
            ),
            (Phase::Recovered, Action::NoAction),
            (Phase::RecoveryFailed, Action::NoAction),
        ];

        for (phase, expected) in expectations {
            assert_eq!(
                decide_packaged_update_recovery_startup_action(phase),
                expected
            );
        }
    }

    #[test]
    fn exposes_only_actionable_or_terminal_packaged_recovery_interventions() {
        use PackagedUpdateRecoveryInterventionKind as Kind;
        use PackagedUpdateRecoveryPhase as Phase;

        assert_eq!(
            describe_packaged_update_recovery_intervention(
                Phase::NativeRecoveryUnavailable,
                "0.1.0",
                "0.2.0",
                2,
            ),
            Some(PackagedUpdateRecoveryIntervention {
                kind: Kind::NativeRecoveryRetryAvailable,
                source_version: "0.1.0".to_owned(),
                target_version: "0.2.0".to_owned(),
                attempts_completed: 2,
                maximum_attempts: MAX_PACKAGED_UPDATE_RECOVERY_ATTEMPTS,
            })
        );
        assert_eq!(
            describe_packaged_update_recovery_intervention(
                Phase::RecoveryFailed,
                "0.1.0",
                "0.2.0",
                3,
            ),
            Some(PackagedUpdateRecoveryIntervention {
                kind: Kind::ManualReinstallRequired,
                source_version: "0.1.0".to_owned(),
                target_version: "0.2.0".to_owned(),
                attempts_completed: 3,
                maximum_attempts: MAX_PACKAGED_UPDATE_RECOVERY_ATTEMPTS,
            })
        );

        for phase in [
            Phase::Prepared,
            Phase::ReplacementStarted,
            Phase::ReplacementInstalled,
            Phase::Launching,
            Phase::Confirmed,
            Phase::Recovering,
            Phase::Recovered,
        ] {
            assert!(
                describe_packaged_update_recovery_intervention(phase, "0.1.0", "0.2.0", 0,)
                    .is_none()
            );
        }
        assert!(describe_packaged_update_recovery_intervention(
            Phase::NativeRecoveryUnavailable,
            "0.1.0",
            "0.2.0",
            0,
        )
        .is_none());
    }

    #[test]
    fn authorizes_only_a_bounded_explicit_native_recovery_retry() {
        use PackagedUpdateRecoveryPhase as Phase;

        assert_eq!(
            authorize_packaged_update_recovery_retry(Phase::NativeRecoveryUnavailable, 1),
            Ok(())
        );
        assert_eq!(
            authorize_packaged_update_recovery_retry(Phase::NativeRecoveryUnavailable, 2),
            Ok(())
        );
        assert_eq!(
            authorize_packaged_update_recovery_retry(Phase::NativeRecoveryUnavailable, 0),
            Err(PackagedUpdateRecoveryRetryError::Unavailable)
        );
        assert_eq!(
            authorize_packaged_update_recovery_retry(Phase::RecoveryFailed, 3),
            Err(PackagedUpdateRecoveryRetryError::Exhausted)
        );
        assert_eq!(
            authorize_packaged_update_recovery_retry(Phase::Recovering, 1),
            Err(PackagedUpdateRecoveryRetryError::Unavailable)
        );
    }
}
