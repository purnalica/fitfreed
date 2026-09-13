import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const wrapper = fileURLToPath(new URL("./run-linux-desktop-session.sh", import.meta.url));

function executable(directory, name, source) {
  const target = path.join(directory, name);
  writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${source}\n`, { mode: 0o700 });
  chmodSync(target, 0o700);
  return target;
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "fitfreed-desktop-session-"));
  const fluxboxPid = path.join(root, "fluxbox.pid");
  const payloadResult = path.join(root, "payload.txt");
  executable(root, "uname", 'printf "Linux\\n"');
  executable(
    root,
    "fluxbox",
    'printf "%s" "$$" >"$FITFREED_TEST_FLUXBOX_PID"\n'
      + "trap 'exit 0' TERM INT\n"
      + "while true; do sleep 0.05; done",
  );
  executable(root, "xprop", 'printf "_NET_SUPPORTING_WM_CHECK(WINDOW) = window id # 0x1\\n"');
  const payload = executable(
    root,
    "payload",
    'printf "%s\\n" "$*" >"$FITFREED_TEST_PAYLOAD_RESULT"',
  );
  return { fluxboxPid, payload, payloadResult, root };
}

test("runs one command after the bounded desktop session becomes ready and stops Fluxbox", () => {
  const state = fixture();
  try {
    const result = spawnSync("bash", [wrapper, state.payload, "first", "second value"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DBUS_SESSION_BUS_ADDRESS: "unix:path=/tmp/fitfreed-test-bus",
        DISPLAY: ":99",
        FITFREED_TEST_FLUXBOX_PID: state.fluxboxPid,
        FITFREED_TEST_PAYLOAD_RESULT: state.payloadResult,
        PATH: `${state.root}:${process.env.PATH}`,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(state.payloadResult, "utf8"), "first second value\n");
    const pid = Number.parseInt(readFileSync(state.fluxboxPid, "utf8"), 10);
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  } finally {
    rmSync(state.root, { force: true, recursive: true });
  }
});

test("rejects an incomplete graphical session before starting the command", () => {
  const state = fixture();
  try {
    const result = spawnSync("bash", [wrapper, state.payload], {
      encoding: "utf8",
      env: {
        ...process.env,
        DBUS_SESSION_BUS_ADDRESS: "unix:path=/tmp/fitfreed-test-bus",
        FITFREED_TEST_FLUXBOX_PID: state.fluxboxPid,
        FITFREED_TEST_PAYLOAD_RESULT: state.payloadResult,
        PATH: `${state.root}:${process.env.PATH}`,
      },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires X11 and D-Bus session addresses/);
  } finally {
    rmSync(state.root, { force: true, recursive: true });
  }
});
