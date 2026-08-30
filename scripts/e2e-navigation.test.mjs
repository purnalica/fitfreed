import assert from "node:assert/strict";
import test from "node:test";

import {
  goToHome,
  resizeApplication,
} from "../test/e2e/support/application-actions.js";

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

test("waits for a stable viewport after native resize", async () => {
  const observedWidths = [744, 732, 720, 720, 720];
  let widthReads = 0;
  const session = {
    async executeAsync(_operation, width, height) {
      assert.equal(width, 720);
      assert.equal(height, 760);
      return null;
    },
    async execute() {
      const width = observedWidths[Math.min(widthReads, observedWidths.length - 1)];
      widthReads += 1;
      return width;
    },
    async waitUntil(condition, options) {
      assert.equal(options.timeout, 10_000);
      for (let attempt = 0; attempt < observedWidths.length; attempt += 1) {
        if (await condition()) return;
      }
      throw new Error(options.timeoutMsg);
    },
  };

  await resizeApplication(720, 760, session);

  assert.equal(widthReads, observedWidths.length);
});
