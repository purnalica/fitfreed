function errorDescription(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function isWebDriverSessionLoss(error) {
  const description = errorDescription(error);
  return /invalid session id/iu.test(description)
    || /Session [^\s]+ not found when running "?execute\/sync/iu.test(description)
    || /ECONNREFUSED when running "?execute\/sync/iu.test(description)
    || /A sessionId is required for this command/iu.test(description);
}

export async function runProcessReplacingAction({
  runAction,
  verifyExactProcessReplacement,
}) {
  let actionFailure;
  try {
    await runAction();
  } catch (error) {
    actionFailure = error;
  }

  await verifyExactProcessReplacement();
  if (actionFailure && !isWebDriverSessionLoss(actionFailure)) throw actionFailure;
}
