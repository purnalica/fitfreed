#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
failure_count=0

report_failure() {
  printf 'Development environment check failed: %s\n' "$1" >&2
  failure_count=$((failure_count + 1))
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    report_failure "$1 is not installed or is not available on PATH"
    return 1
  fi
}

version_in_range() {
  local actual="$1"
  local supported_range="$2"
  if [[ ! "$actual" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    return 1
  fi

  local actual_major="${BASH_REMATCH[1]}"
  local actual_minor="${BASH_REMATCH[2]}"
  local actual_patch="${BASH_REMATCH[3]}"
  if [[ ! "$supported_range" =~ ^\>=([0-9]+)\.([0-9]+)\.([0-9]+)\ \<([0-9]+)$ ]]; then
    return 1
  fi
  local minimum_major="${BASH_REMATCH[1]}"
  local minimum_minor="${BASH_REMATCH[2]}"
  local minimum_patch="${BASH_REMATCH[3]}"
  local maximum_major="${BASH_REMATCH[4]}"

  (( actual_major < maximum_major )) &&
    (( actual_major > minimum_major ||
      (actual_major == minimum_major && actual_minor > minimum_minor) ||
      (actual_major == minimum_major && actual_minor == minimum_minor && actual_patch >= minimum_patch) ))
}

recommended_node="v$(tr -d '[:space:]' < "$repository_root/.nvmrc")"
node_range="$(sed -n 's/.*"node": "\([^"]*\)".*/\1/p' "$repository_root/package.json")"
npm_range="$(sed -n 's/.*"npm": "\([^"]*\)".*/\1/p' "$repository_root/package.json")"
expected_rust="$(sed -n 's/^channel = "\([^"]*\)"/\1/p' "$repository_root/rust-toolchain.toml")"

if require_command node; then
  actual_node="$(node --version)"
  if ! version_in_range "${actual_node#v}" "$node_range"; then
    report_failure "Node.js $node_range is required; found $actual_node (recommended $recommended_node)"
  fi
fi

if require_command npm; then
  actual_npm="$(npm --version)"
  if ! version_in_range "$actual_npm" "$npm_range"; then
    report_failure "npm $npm_range is required; found $actual_npm"
  fi
fi

if require_command rustup && require_command rustc && require_command cargo; then
  actual_rust="$(rustc --version | awk '{print $2}')"
  if [[ "$actual_rust" != "$expected_rust" ]]; then
    report_failure "Rust $expected_rust is required; found $actual_rust"
  fi

  installed_components="$(rustup component list --toolchain "$expected_rust" --installed)"
  for component in rustfmt clippy; do
    if ! grep -q "^${component}-" <<< "$installed_components"; then
      report_failure "Rust component $component is required for toolchain $expected_rust"
    fi
  done
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  if ! xcode-select -p >/dev/null 2>&1; then
    report_failure "the Xcode command-line tools are required on macOS"
  elif ! xcrun --find clang >/dev/null 2>&1; then
    report_failure "the active Xcode developer directory does not provide clang"
  fi
  for command in ditto hdiutil openssl plutil shasum sqlite3 strings; do
    require_command "$command" || true
  done
fi

if [[ "$(uname -s)" == "Linux" ]]; then
  require_command "dpkg-deb" || true
  if require_command pkg-config; then
    for module in glib-2.0 gio-2.0 gobject-2.0 gtk+-3.0 webkit2gtk-4.1; do
      if ! pkg-config --exists "$module"; then
        report_failure "the Tauri Linux development module $module is required"
      fi
    done
  fi
fi

if (( failure_count > 0 )); then
  printf 'Development environment check found %d problem(s).\n' "$failure_count" >&2
  exit 1
fi

printf 'Development environment check passed for Node.js %s, npm %s, and Rust %s on %s.\n' \
  "$(node --version)" "$(npm --version)" "$expected_rust" "$(uname -s)"
