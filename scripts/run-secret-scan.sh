#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
gitleaks_binary="$($script_dir/install-gitleaks.sh)"
candidate_directory="$(mktemp -d "${TMPDIR:-/tmp}/fitfreed-secret-scan.XXXXXX")"
trap 'rm -rf "$candidate_directory"' EXIT

while IFS= read -r -d '' candidate_path; do
  if [[ -L "$repository_root/$candidate_path" ]]; then
    printf 'Secret scan refuses symbolic link: %s\n' "$candidate_path" >&2
    exit 1
  fi

  mkdir -p "$candidate_directory/$(dirname "$candidate_path")"
  cp "$repository_root/$candidate_path" "$candidate_directory/$candidate_path"
done < <(git -C "$repository_root" ls-files --cached --others --exclude-standard -z)

"$gitleaks_binary" dir \
  --no-banner \
  --no-color \
  --redact \
  --max-target-megabytes 10 \
  "$candidate_directory"

if git -C "$repository_root" rev-parse --verify HEAD >/dev/null 2>&1; then
  "$gitleaks_binary" git \
    --no-banner \
    --no-color \
    --redact \
    --log-opts="--all" \
    "$repository_root"
fi
