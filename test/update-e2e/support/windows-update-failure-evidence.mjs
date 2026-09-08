const scenarios = new Set([
  "success",
  "installer-failure",
  "candidate-failure",
  "recovery-retry",
  "recovery-exhaustion",
  "restart-resumption",
]);

const journeyStages = new Set([
  "application-start",
  "update-request",
  "recovery-published",
  "terminal-outcome",
  "terminal-cleanup",
  "notice-verification",
  "evidence-write",
]);

const observationStates = new Set(["present", "absent", "unreadable"]);

const recoveryPhases = new Set([
  "prepared",
  "replacement-started",
  "replacement-installed",
  "launching",
  "confirmed",
  "recovering",
  "native-recovery-unavailable",
  "recovered",
  "recovery-failed",
]);

const nativeRecoveryFailures = new Set([
  "installer-failed",
  "installed-state-invalid",
]);

const recoveryOutcomes = new Set([
  "updated",
  "recovered",
  "manual-reinstall-required",
]);

const semanticVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireExactFields(value, expectedFields, description) {
  if (!isRecord(value)) throw new Error(`${description} is invalid`);
  const actualFields = Object.keys(value);
  if (
    actualFields.length !== expectedFields.length
    || actualFields.some((field) => !expectedFields.includes(field))
  ) {
    throw new Error(`${description} contains unexpected fields`);
  }
}

function requireClosedValue(value, allowedValues, description) {
  if (!allowedValues.has(value)) throw new Error(`${description} is invalid`);
  return value;
}

function requireObservation(observation, description) {
  if (!isRecord(observation)) throw new Error(`${description} is invalid`);
  const allowedFields = ["state", "value"];
  if (
    !Object.keys(observation).every((field) => allowedFields.includes(field))
    || !("state" in observation)
  ) {
    throw new Error(`${description} contains unexpected fields`);
  }
  requireClosedValue(observation.state, observationStates, `${description} state`);
  if (observation.state === "present" && !("value" in observation)) {
    throw new Error(`${description} value is missing`);
  }
  return observation;
}

function projectAttemptManifest(observation) {
  requireObservation(observation, "attempt manifest observation");
  if (observation.state !== "present") {
    return {
      attemptManifestState: observation.state,
      phase: null,
      nativeRecoveryAttempts: null,
      nativeRecoveryLastFailure: null,
      replacementProcessRecorded: null,
    };
  }

  const manifest = observation.value;
  const nativeRecovery = isRecord(manifest?.nativeRecovery)
    ? manifest.nativeRecovery
    : undefined;
  const valid = isRecord(manifest)
    && recoveryPhases.has(manifest.phase)
    && Number.isSafeInteger(nativeRecovery?.attempts)
    && nativeRecovery.attempts >= 0
    && nativeRecovery.attempts <= 3
    && (
      nativeRecovery.lastFailure === null
      || nativeRecoveryFailures.has(nativeRecovery.lastFailure)
    )
    && (
      manifest.replacementProcess === null
      || isRecord(manifest.replacementProcess)
    );
  if (!valid) {
    return {
      attemptManifestState: "unreadable",
      phase: null,
      nativeRecoveryAttempts: null,
      nativeRecoveryLastFailure: null,
      replacementProcessRecorded: null,
    };
  }

  return {
    attemptManifestState: "present",
    phase: manifest.phase,
    nativeRecoveryAttempts: nativeRecovery.attempts,
    nativeRecoveryLastFailure: nativeRecovery.lastFailure,
    replacementProcessRecorded: manifest.replacementProcess !== null,
  };
}

function projectRetainedOutcome(observation) {
  requireObservation(observation, "retained outcome observation");
  if (observation.state !== "present") {
    return {
      retainedOutcomeState: observation.state,
      retainedOutcome: null,
    };
  }
  const outcome = observation.value;
  if (!isRecord(outcome) || !recoveryOutcomes.has(outcome.outcome)) {
    return {
      retainedOutcomeState: "unreadable",
      retainedOutcome: null,
    };
  }
  return {
    retainedOutcomeState: "present",
    retainedOutcome: outcome.outcome,
  };
}

function requireOptionalVersion(value) {
  if (value === undefined) return null;
  if (typeof value !== "string" || !semanticVersion.test(value)) {
    throw new Error("installed version is invalid");
  }
  return value;
}

function requireOptionalProcessCount(value) {
  if (value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 10) {
    throw new Error("process count is invalid");
  }
  return value;
}

export function createWindowsUpdateFailureEvidence(input) {
  requireExactFields(
    input,
    [
      "scenario",
      "journeyStage",
      "activePointerState",
      "attemptManifest",
      "retainedOutcome",
      "installedVersion",
      "installedApplicationProcessCount",
      "runnablePredecessorProcessCount",
    ],
    "Windows update failure evidence",
  );
  const manifest = projectAttemptManifest(input.attemptManifest);
  const outcome = projectRetainedOutcome(input.retainedOutcome);
  return {
    check: "packaged-windows-update-failure",
    schemaVersion: 1,
    scenario: requireClosedValue(input.scenario, scenarios, "scenario"),
    journeyStage: requireClosedValue(
      input.journeyStage,
      journeyStages,
      "journey stage",
    ),
    activePointerState: requireClosedValue(
      input.activePointerState,
      observationStates,
      "active pointer state",
    ),
    ...manifest,
    ...outcome,
    installedVersion: requireOptionalVersion(input.installedVersion),
    installedApplicationProcessCount: requireOptionalProcessCount(
      input.installedApplicationProcessCount,
    ),
    runnablePredecessorProcessCount: requireOptionalProcessCount(
      input.runnablePredecessorProcessCount,
    ),
  };
}
