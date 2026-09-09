const applicationStartupClaim = Symbol.for("org.fitfreed.application-startup-claimed");

export function claimApplicationStartup(rendererGlobal: object) {
  const claims = rendererGlobal as Record<symbol, unknown>;
  if (claims[applicationStartupClaim] === true) return false;
  claims[applicationStartupClaim] = true;
  return true;
}
