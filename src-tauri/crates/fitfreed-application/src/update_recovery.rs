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
}
