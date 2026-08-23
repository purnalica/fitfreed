import path from "node:path";

export function packagedE2eScenarioPlan(runDirectory) {
  const journeyDatabasePath = path.join(runDirectory, "journey.sqlite");
  const restartIdentityPath = path.join(runDirectory, "restart-process.json");
  const adaptiveDatabasePath = path.join(runDirectory, "adaptive-sessions.sqlite");
  const adaptiveRestartIdentityPath = path.join(
    runDirectory,
    "adaptive-restart-process.json",
  );

  return [
    {
      name: "journey",
      configuration: "wdio.conf.js",
      spec: "test/e2e/import-journey.spec.js",
      databasePath: journeyDatabasePath,
      restartIdentityPath,
    },
    {
      name: "restart",
      configuration: "wdio.conf.js",
      spec: "test/e2e/restart-evidence.e2e.js",
      databasePath: journeyDatabasePath,
      restartIdentityPath,
    },
    {
      name: "adaptive-sessions",
      configuration: "wdio.conf.js",
      spec: "test/e2e/adaptive-session-composition.spec.js",
      databasePath: adaptiveDatabasePath,
      restartIdentityPath: adaptiveRestartIdentityPath,
    },
    {
      name: "adaptive-sessions-restart",
      configuration: "wdio.conf.js",
      spec: "test/e2e/adaptive-session-restart.e2e.js",
      databasePath: adaptiveDatabasePath,
      restartIdentityPath: adaptiveRestartIdentityPath,
    },
    {
      name: "performance",
      configuration: "wdio.performance.conf.js",
      spec: "test/e2e/insights-performance.spec.js",
      databasePath: path.join(runDirectory, "performance.sqlite"),
      restartIdentityPath: null,
    },
  ];
}
