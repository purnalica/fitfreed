#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
version="1.7.12"
shellcheck_version="0.10.0"
tool_root="$repository_root/.tools/workflow"
binary="$tool_root/actionlint"
shellcheck_binary="$tool_root/shellcheck"

if [[ -x "$binary" ]] &&
  [[ -x "$shellcheck_binary" ]] &&
  [[ "$($binary -version | sed -n '1p')" == "$version" ]] &&
  [[ "$($shellcheck_binary --version | sed -n 's/^version: //p')" == "$shellcheck_version" ]]; then
  printf 'Workflow tools are ready: actionlint %s and ShellCheck %s.\n' \
    "$version" "$shellcheck_version"
  exit 0
fi

case "$(uname -s):$(uname -m)" in
  Darwin:arm64)
    platform="darwin_arm64"
    expected_sha256="aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f"
    shellcheck_platform="darwin.aarch64"
    shellcheck_expected_sha256="bbd2f14826328eee7679da7221f2bc3afb011f6a928b848c80c321f6046ddf81"
    ;;
  Darwin:x86_64)
    platform="darwin_amd64"
    expected_sha256="5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644"
    shellcheck_platform="darwin.x86_64"
    shellcheck_expected_sha256="ef27684f23279d112d8ad84e0823642e43f838993bbb8c0963db9b58a90464c2"
    ;;
  Linux:aarch64 | Linux:arm64)
    platform="linux_arm64"
    expected_sha256="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6"
    shellcheck_platform="linux.aarch64"
    shellcheck_expected_sha256="324a7e89de8fa2aed0d0c28f3dab59cf84c6d74264022c00c22af665ed1a09bb"
    ;;
  Linux:x86_64)
    platform="linux_amd64"
    expected_sha256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
    shellcheck_platform="linux.x86_64"
    shellcheck_expected_sha256="6c881ab0698e4e6ea235245f22832860544f17ba386442fe7e9d629f8cbedf87"
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
shellcheck_archive="$staging/shellcheck.tar.xz"
shellcheck_url="https://github.com/koalaman/shellcheck/releases/download/v${shellcheck_version}/shellcheck-v${shellcheck_version}.${shellcheck_platform}.tar.xz"

curl \
  --proto '=https' \
  --tlsv1.2 \
  --fail \
  --silent \
  --show-error \
  --location \
  --output "$archive" \
  "$url"

curl \
  --proto '=https' \
  --tlsv1.2 \
  --fail \
  --silent \
  --show-error \
  --location \
  --output "$shellcheck_archive" \
  "$shellcheck_url"

if command -v sha256sum >/dev/null 2>&1; then
  actual_sha256="$(sha256sum "$archive" | awk '{print $1}')"
else
  actual_sha256="$(shasum -a 256 "$archive" | awk '{print $1}')"
fi
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  printf 'Workflow tool installation failed: actionlint archive digest mismatch.\n' >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  shellcheck_actual_sha256="$(sha256sum "$shellcheck_archive" | awk '{print $1}')"
else
  shellcheck_actual_sha256="$(shasum -a 256 "$shellcheck_archive" | awk '{print $1}')"
fi
if [[ "$shellcheck_actual_sha256" != "$shellcheck_expected_sha256" ]]; then
  printf 'Workflow tool installation failed: ShellCheck archive digest mismatch.\n' >&2
  exit 1
fi

tar -xzf "$archive" -C "$staging" actionlint
chmod 0755 "$staging/actionlint"
tar -xJf "$shellcheck_archive" -C "$staging" \
  "shellcheck-v${shellcheck_version}/shellcheck"
chmod 0755 "$staging/shellcheck-v${shellcheck_version}/shellcheck"

if [[ "$("$staging/actionlint" -version | sed -n '1p')" != "$version" ]]; then
  printf 'Workflow tool installation failed: expected actionlint %s.\n' "$version" >&2
  exit 1
fi
if [[ "$("$staging/shellcheck-v${shellcheck_version}/shellcheck" --version | sed -n 's/^version: //p')" != "$shellcheck_version" ]]; then
  printf 'Workflow tool installation failed: expected ShellCheck %s.\n' \
    "$shellcheck_version" >&2
  exit 1
fi

mv -f "$staging/actionlint" "$binary"
mv -f "$staging/shellcheck-v${shellcheck_version}/shellcheck" "$shellcheck_binary"

printf 'Workflow tools are ready: actionlint %s and ShellCheck %s.\n' \
  "$version" "$shellcheck_version"
