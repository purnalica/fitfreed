use thiserror::Error;

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
}
