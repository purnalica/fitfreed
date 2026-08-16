#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'Development release installation verification requires macOS.\n' >&2
  exit 1
fi

if [[ $# -ne 2 ]]; then
  printf 'Usage: %s <release-directory> <isolated-application-destination>\n' "$0" >&2
  exit 1
fi

for command in ditto node plutil strings; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Installation verification requires command: %s\n' "$command" >&2
    exit 1
  fi
done

repository_root="$(git rev-parse --show-toplevel)"
release_directory="$(cd "$1" && pwd -P)"
destination="$2"
verification_root="${FITFREED_INSTALL_VERIFICATION_ROOT:-}"

if [[ -z "$verification_root" ]]; then
  printf 'FITFREED_INSTALL_VERIFICATION_ROOT is required.\n' >&2
  exit 1
fi
verification_root="$(cd "$verification_root" && pwd -P)"
destination_parent="$(cd "$(dirname "$destination")" && pwd -P)"
case "$destination_parent/" in
  "$verification_root"/*) ;;
  *)
    printf 'Installation destination must remain inside FITFREED_INSTALL_VERIFICATION_ROOT.\n' >&2
    exit 1
    ;;
esac

metadata_file="$(mktemp "$verification_root/integrity.XXXXXX.json")"
mount_point="$(mktemp -d "$verification_root/mount.XXXXXX")"
candidate="$destination_parent/.FitFreed.app.installing.$$"
mounted=false
hdiutil_command="${FITFREED_HDIUTIL:-hdiutil}"
if [[ "$hdiutil_command" == "hdiutil" ]]; then
  if ! command -v hdiutil >/dev/null 2>&1; then
    printf 'Installation verification requires command: hdiutil\n' >&2
    exit 1
  fi
elif [[ ! -x "$hdiutil_command" ]]; then
  printf 'Configured hdiutil command is not executable: %s\n' "$hdiutil_command" >&2
  exit 1
fi

cleanup() {
  if [[ "$mounted" == true ]]; then
    "$hdiutil_command" detach "$mount_point" -quiet >/dev/null 2>&1 || true
  fi
  rm -rf "$candidate"
  rmdir "$mount_point" >/dev/null 2>&1 || true
  rm -f "$metadata_file"
}
trap cleanup EXIT

# Integrity is deliberately the first operation that can inspect the candidate package.
node "$repository_root/scripts/verify-release-integrity.mjs" "$release_directory" >"$metadata_file"

if [[ -e "$destination" ]]; then
  printf 'Installation destination already exists: %s\n' "$destination" >&2
  exit 1
fi

disk_image="$(node -e 'const fs = require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).diskImage)' "$metadata_file")"
version="$(node -e 'const fs = require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version)' "$metadata_file")"

"$hdiutil_command" attach "$disk_image" -readonly -nobrowse -mountpoint "$mount_point" -quiet
mounted=true

source_application="$mount_point/FitFreed.app"
if [[ ! -d "$source_application" ]]; then
  printf 'Mounted disk image does not contain FitFreed.app.\n' >&2
  exit 1
fi

ditto "$source_application" "$candidate"
information_plist="$candidate/Contents/Info.plist"
application_binary="$candidate/Contents/MacOS/fitfreed"

bundle_identifier="$(plutil -extract CFBundleIdentifier raw -o - "$information_plist")"
bundle_executable="$(plutil -extract CFBundleExecutable raw -o - "$information_plist")"
bundle_version="$(plutil -extract CFBundleShortVersionString raw -o - "$information_plist")"
if [[ "$bundle_identifier" != "org.fitfreed.desktop" || "$bundle_executable" != "fitfreed" ]]; then
  printf 'Installed application identity does not match FitFreed.\n' >&2
  exit 1
fi
if [[ "$bundle_version" != "$version" ]]; then
  printf 'Installed application version %s does not match release %s.\n' "$bundle_version" "$version" >&2
  exit 1
fi
if [[ ! -x "$application_binary" ]]; then
  printf 'Installed application executable is missing.\n' >&2
  exit 1
fi
if strings "$application_binary" | grep -Eiq 'tauri-plugin-wdio|TAURI_WEBDRIVER_PORT|wdio-webdriver|__wdio_mocks__|instrumented archive picker'; then
  printf 'Installed application contains test-only WebDriver capability.\n' >&2
  exit 1
fi

mv "$candidate" "$destination"
"$hdiutil_command" detach "$mount_point" -quiet
mounted=false

printf 'Installed FitFreed %s into isolated destination %s.\n' "$version" "$destination"
