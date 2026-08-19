import { config as baseConfig } from "./wdio.conf.js";

export const config = {
  ...baseConfig,
  specs: ["./test/e2e/insights-performance.spec.js"],
  mochaOpts: {
    ...baseConfig.mochaOpts,
    timeout: 420_000,
  },
};
