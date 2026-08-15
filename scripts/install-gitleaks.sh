#!/usr/bin/env bash

set -euo pipefail

readonly GITLEAKS_VERSION="8.30.1"
readonly RELEASE_BASE_URL="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
tool_directory="${FITFREED_TOOL_DIRECTORY:-$repository_root/.tools}"
binary_path="$tool_directory/gitleaks-$GITLEAKS_VERSION"

if [[ -x "$binary_path" ]] && "$binary_path" version | grep -Fq "$GITLEAKS_VERSION"; then
  printf '%s\n' "$binary_path"
  exit 0
fi

operating_system="$(uname -s)"
architecture="$(uname -m)"

case "$operating_system/$architecture" in
  Darwin/arm64)
    archive_name="gitleaks_${GITLEAKS_VERSION}_darwin_arm64.tar.gz"
    expected_sha256="b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5"
    ;;
  Darwin/x86_64)
    archive_name="gitleaks_${GITLEAKS_VERSION}_darwin_x64.tar.gz"
    expected_sha256="dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709"
    ;;
  Linux/aarch64 | Linux/arm64)
    archive_name="gitleaks_${GITLEAKS_VERSION}_linux_arm64.tar.gz"
    expected_sha256="e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"
    ;;
  Linux/x86_64)
    archive_name="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
    expected_sha256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
    ;;
  *)
    printf 'Unsupported Gitleaks bootstrap platform: %s/%s\n' "$operating_system" "$architecture" >&2
    exit 1
    ;;
esac

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/fitfreed-gitleaks.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

archive_path="$temporary_directory/$archive_name"
curl --fail --location --silent --show-error "$RELEASE_BASE_URL/$archive_name" --output "$archive_path"

if command -v sha256sum >/dev/null 2>&1; then
  actual_sha256="$(sha256sum "$archive_path" | awk '{print $1}')"
else
  actual_sha256="$(shasum -a 256 "$archive_path" | awk '{print $1}')"
fi

if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  printf 'Gitleaks archive checksum verification failed.\n' >&2
  exit 1
fi

tar -xzf "$archive_path" -C "$temporary_directory" gitleaks
mkdir -p "$tool_directory"
install -m 0755 "$temporary_directory/gitleaks" "$binary_path"

printf '%s\n' "$binary_path"
