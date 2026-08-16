#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  printf 'Development release installation verification requires macOS.\n' >&2
  exit 1
fi

if [[ $# -gt 1 ]]; then
  printf 'Usage: %s [release-directory]\n' "$0" >&2
  exit 1
fi

for command in dd ditto hdiutil node shasum sqlite3; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Development release verification requires command: %s\n' "$command" >&2
    exit 1
  fi
done

repository_root="$(git rev-parse --show-toplevel)"
if [[ $# -eq 1 ]]; then
  release_directory="$(cd "$1" && pwd -P)"
else
  version="$(node -p 'require("./package.json").version')"
  release_directory="$(cd "$repository_root/.artifacts/releases/$version" && pwd -P)"
fi
verification_root="$(mktemp -d "${TMPDIR:-/tmp}/fitfreed-install-verification.XXXXXX")"
install_root="$verification_root/install"
destination="$install_root/FitFreed.app"
isolated_home="$verification_root/home"
library_path="$isolated_home/Library/Application Support/org.fitfreed.desktop/fitfreed.sqlite"
launch_log="$verification_root/launch.log"
application_pid=""

cleanup() {
  if [[ -n "$application_pid" ]] && kill -0 "$application_pid" >/dev/null 2>&1; then
    kill -TERM "$application_pid" >/dev/null 2>&1 || true
    wait "$application_pid" >/dev/null 2>&1 || true
  fi
  rm -rf "$verification_root"
}
trap cleanup EXIT

mkdir -p "$install_root" "$isolated_home"

launch_application() {
  HOME="$isolated_home" \
    "$destination/Contents/MacOS/fitfreed" >"$launch_log" 2>&1 &
  application_pid=$!

  schema_version=""
  for _ in {1..200}; do
    if [[ -f "$library_path" ]]; then
      schema_version="$(sqlite3 "$library_path" 'PRAGMA user_version;' 2>/dev/null || true)"
      if [[ "$schema_version" == "3" ]]; then
        break
      fi
    fi
    if ! kill -0 "$application_pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  if kill -0 "$application_pid" >/dev/null 2>&1; then
    kill -TERM "$application_pid" >/dev/null 2>&1 || true
    wait "$application_pid" >/dev/null 2>&1 || true
  fi
  application_pid=""
  if [[ "$schema_version" != "3" ]]; then
    printf 'Installed application did not initialize storage schema 3.\n' >&2
    sed -n '1,80p' "$launch_log" >&2
    exit 1
  fi
}

FITFREED_INSTALL_VERIFICATION_ROOT="$verification_root" \
  "$repository_root/scripts/install-macos-development-release.sh" \
  "$release_directory" "$destination"
launch_application

application_digest_before="$(shasum -a 256 "$destination/Contents/MacOS/fitfreed" | awk '{print $1}')"
library_digest_before="$(shasum -a 256 "$library_path" | awk '{print $1}')"

corrupt_release="$verification_root/corrupt-release"
ditto "$release_directory" "$corrupt_release"
disk_image="$(node "$repository_root/scripts/verify-release-integrity.mjs" "$release_directory" | node -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => process.stdout.write(JSON.parse(input).diskImage))')"
corrupt_disk_image="$corrupt_release/$(basename "$disk_image")"
printf 'X' | dd of="$corrupt_disk_image" bs=1 seek=0 conv=notrunc status=none

hdiutil_marker="$verification_root/hdiutil-called"
hdiutil_wrapper="$verification_root/hdiutil-wrapper"
printf '#!/usr/bin/env bash\nprintf called >"$FITFREED_HDIUTIL_MARKER"\nexit 99\n' >"$hdiutil_wrapper"
chmod +x "$hdiutil_wrapper"

failed_destination="$install_root/Corrupt.app"
if FITFREED_INSTALL_VERIFICATION_ROOT="$verification_root" \
  FITFREED_HDIUTIL="$hdiutil_wrapper" \
  FITFREED_HDIUTIL_MARKER="$hdiutil_marker" \
  "$repository_root/scripts/install-macos-development-release.sh" \
  "$corrupt_release" "$failed_destination" >"$verification_root/corrupt-install.log" 2>&1; then
  printf 'Corrupted release unexpectedly passed installation verification.\n' >&2
  exit 1
fi

if [[ -e "$hdiutil_marker" || -e "$failed_destination" ]]; then
  printf 'Corrupted release reached the mount or destination mutation boundary.\n' >&2
  exit 1
fi
if ! grep -q 'Release integrity verification failed' "$verification_root/corrupt-install.log"; then
  printf 'Corrupted release failed outside the integrity boundary.\n' >&2
  sed -n '1,80p' "$verification_root/corrupt-install.log" >&2
  exit 1
fi

application_digest_after="$(shasum -a 256 "$destination/Contents/MacOS/fitfreed" | awk '{print $1}')"
library_digest_after="$(shasum -a 256 "$library_path" | awk '{print $1}')"
if [[ "$application_digest_before" != "$application_digest_after" ]]; then
  printf 'Failed installation modified the existing application.\n' >&2
  exit 1
fi
if [[ "$library_digest_before" != "$library_digest_after" ]]; then
  printf 'Failed installation modified the existing library.\n' >&2
  exit 1
fi

launch_application

removed_application="$verification_root/removed/FitFreed.app"
mkdir -p "$(dirname "$removed_application")"
mv "$destination" "$removed_application"
if [[ ! -f "$library_path" || "$(sqlite3 "$library_path" 'PRAGMA user_version;')" != "3" ]]; then
  printf 'Removing the isolated application removed or damaged its separate library.\n' >&2
  exit 1
fi

printf 'macOS release verification passed clean install, first launch, integrity failure, retained state, relaunch, and removal boundaries.\n'
