#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
application_bundle="$repository_root/src-tauri/target/release/bundle/macos/FitFreed.app"

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'Update recovery preparation verification requires macOS.\n' >&2
  exit 1
fi

if [[ ! -d "$application_bundle" ]]; then
  printf 'Update recovery preparation verification requires the production FitFreed.app package.\n' >&2
  exit 1
fi

cargo run \
  --quiet \
  --manifest-path "$repository_root/src-tauri/Cargo.toml" \
  --example update_recovery_preparation_acceptance \
  -- "$application_bundle"
