#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
version="1.7.12"
tool_root="$repository_root/.tools/actionlint"
binary="$tool_root/actionlint"

if [[ -x "$binary" ]] && [[ "$($binary -version | sed -n '1p')" == "$version" ]]; then
  printf 'Workflow tools are ready: actionlint %s.\n' "$version"
  exit 0
fi

case "$(uname -s):$(uname -m)" in
  Darwin:arm64)
    platform="darwin_arm64"
    expected_sha256="aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f"
    ;;
  Darwin:x86_64)
    platform="darwin_amd64"
    expected_sha256="5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644"
    ;;
  Linux:aarch64 | Linux:arm64)
    platform="linux_arm64"
    expected_sha256="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6"
    ;;
  Linux:x86_64)
    platform="linux_amd64"
    expected_sha256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
    ;;
  *)
    printf 'Workflow tool installation failed: unsupported platform %s %s.\n' \
      "$(uname -s)" "$(uname -m)" >&2
    exit 1
    ;;
esac

mkdir -p "$tool_root"
staging="$(mktemp -d "$tool_root/.install.XXXXXX")"
trap 'rm -rf "$staging"' EXIT
archive="$staging/actionlint.tar.gz"
url="https://github.com/rhysd/actionlint/releases/download/v${version}/actionlint_${version}_${platform}.tar.gz"

curl \
  --proto '=https' \
  --tlsv1.2 \
  --fail \
  --silent \
  --show-error \
  --location \
  --output "$archive" \
  "$url"

if command -v sha256sum >/dev/null 2>&1; then
  actual_sha256="$(sha256sum "$archive" | awk '{print $1}')"
else
  actual_sha256="$(shasum -a 256 "$archive" | awk '{print $1}')"
fi
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  printf 'Workflow tool installation failed: actionlint archive digest mismatch.\n' >&2
  exit 1
fi

tar -xzf "$archive" -C "$staging" actionlint
chmod 0755 "$staging/actionlint"
mv -f "$staging/actionlint" "$binary"

if [[ "$($binary -version | sed -n '1p')" != "$version" ]]; then
  printf 'Workflow tool installation failed: expected actionlint %s.\n' "$version" >&2
  exit 1
fi

printf 'Workflow tools are ready: actionlint %s.\n' "$version"
