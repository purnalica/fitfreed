import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(
  new URL("./verify-linux-filesystem-reliability.sh", import.meta.url),
  "utf8",
);

test("uses a bounded isolated Linux filesystem and always unmounts it", () => {
  assert.match(script, /\[ "\$\(uname -s\)" = "Linux" \]/);
  assert.match(script, /mount -t tmpfs -o size=32M,nodev,nosuid,noexec/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /umount "\$filesystem_root"/);
  assert.doesNotMatch(script, /rm -rf|rm -r|\/tmp\//);
});

test("runs only the exact ignored disk-exhaustion acceptance test", () => {
  assert.match(script, /FITFREED_LINUX_FILESYSTEM_TEST_ROOT="\$filesystem_root"/);
  assert.match(script, /cargo test/);
  assert.match(script, /--release/);
  assert.match(script, /--lib/);
  assert.match(
    script,
    /infrastructure::tests::recovers_from_linux_disk_exhaustion_without_losing_committed_history/,
  );
  assert.match(script, /--ignored --exact/);
});
