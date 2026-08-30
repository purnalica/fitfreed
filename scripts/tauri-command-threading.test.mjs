import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const commandPattern = /#\[tauri::command(?<dispatch>\(async\))?\]\n(?<functionAsync>async )?fn (?<name>\w+)\((?<body>.*?)(?=\n#\[tauri::command|\nfn current_utc_datetime|\nfn application_update_channel|\n#\[cfg)/gs;

test("dispatches synchronous SQLite desktop commands away from the main thread", () => {
  const source = readFileSync(
    new URL("../src-tauri/src/lib.rs", import.meta.url),
    "utf8",
  );
  const sqliteCommands = [];
  const incorrectlyDispatched = [];
  for (const match of source.matchAll(commandPattern)) {
    if (!match.groups.body.includes("database_path(&app)")) continue;
    sqliteCommands.push(match.groups.name);
    if (match.groups.functionAsync === undefined && match.groups.dispatch !== "(async)") {
      incorrectlyDispatched.push(match.groups.name);
    }
  }

  assert.ok(sqliteCommands.length >= 60, "expected the complete SQLite command surface");
  assert.deepEqual(incorrectlyDispatched, []);
});
