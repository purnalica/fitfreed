#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
tool_root="$repository_root/.tools/cargo-cyclonedx"
binary="$tool_root/bin/cargo-cyclonedx"
expected_version="0.5.9"

if [[ -x "$binary" ]]; then
  installed_version="$($binary cyclonedx --version | awk '{print $2}')"
  if [[ "$installed_version" == "$expected_version" ]]; then
    printf 'Release tools are ready: cargo-cyclonedx %s.\n' "$installed_version"
    exit 0
  fi
fi

cargo install \
  --root "$tool_root" \
  --version "$expected_version" \
  --locked \
  cargo-cyclonedx

installed_version="$($binary cyclonedx --version | awk '{print $2}')"
if [[ "$installed_version" != "$expected_version" ]]; then
  printf 'Release tool installation failed: expected cargo-cyclonedx %s, found %s.\n' \
    "$expected_version" "$installed_version" >&2
  exit 1
fi

printf 'Release tools are ready: cargo-cyclonedx %s.\n' "$installed_version"
