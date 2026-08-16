#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
application_bundle="$repository_root/src-tauri/target/release/bundle/macos/FitFreed.app"
application_binary="$application_bundle/Contents/MacOS/fitfreed"
information_plist="$application_bundle/Contents/Info.plist"

if [[ ! -x "$application_binary" ]]; then
  printf 'Production bundle check failed: expected executable is missing: %s\n' "$application_binary" >&2
  exit 1
fi

bundle_executable="$(plutil -extract CFBundleExecutable raw -o - "$information_plist")"
bundle_identifier="$(plutil -extract CFBundleIdentifier raw -o - "$information_plist")"

if [[ "$bundle_executable" != "fitfreed" ]]; then
  printf 'Production bundle check failed: CFBundleExecutable is %s\n' "$bundle_executable" >&2
  exit 1
fi

if [[ "$bundle_identifier" != "org.fitfreed.desktop" ]]; then
  printf 'Production bundle check failed: CFBundleIdentifier is %s\n' "$bundle_identifier" >&2
  exit 1
fi

if strings "$application_binary" | grep -Eiq 'tauri-plugin-wdio|TAURI_WEBDRIVER_PORT|wdio-webdriver|__wdio_mocks__|instrumented archive picker'; then
  printf 'Production bundle check failed: test-only WebDriver capability is present.\n' >&2
  exit 1
fi

printf 'Production bundle check passed for %s (%s).\n' "$bundle_executable" "$bundle_identifier"
