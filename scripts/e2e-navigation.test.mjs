import assert from "node:assert/strict";
import test from "node:test";

import { goToHome } from "../test/e2e/support/application-actions.js";

function navigationSession(currentAfterClick) {
  let clicks = 0;
  const destination = {
    async waitForEnabled() {},
    async click() {
      clicks += 1;
    },
    async getAttribute(name) {
      assert.equal(name, "aria-current");
      return clicks >= currentAfterClick ? "page" : null;
    },
  };
  return {
    session: {
      async $(selector) {
        assert.equal(selector, ".app-sidebar nav button[data-home='settings']");
        return destination;
      },
      async waitUntil(condition, options) {
        assert.equal(options.timeout, 1_000);
        if (!(await condition())) throw new Error(options.timeoutMsg);
      },
    },
    clicks: () => clicks,
  };
}

test("accepts home navigation only after the requested action becomes current", async () => {
  const harness = navigationSession(1);

  await goToHome("settings", harness.session);

  assert.equal(harness.clicks(), 1);
});

test("repeats one activation click and then requires completed home navigation", async () => {
  const harness = navigationSession(2);

  await goToHome("settings", harness.session);

  assert.equal(harness.clicks(), 2);
});

test("fails after the bounded activation retry when navigation never completes", async () => {
  const harness = navigationSession(Number.POSITIVE_INFINITY);

  await assert.rejects(
    goToHome("settings", harness.session),
    /settings did not become the current application section/,
  );
  assert.equal(harness.clicks(), 2);
});
