#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
allowlist_path="$repository_root/.initial-publication-allowlist"
temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/fitfreed-publication.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

if [[ ! -f "$allowlist_path" ]]; then
  printf 'Missing .initial-publication-allowlist.\n' >&2
  exit 1
fi

LC_ALL=C sort -u "$allowlist_path" > "$temporary_directory/expected"
git -C "$repository_root" ls-files --cached --others --exclude-standard > "$temporary_directory/candidates"
LC_ALL=C sort -u "$temporary_directory/candidates" > "$temporary_directory/candidates-sorted"
git -C "$repository_root" diff --cached --name-only > "$temporary_directory/staged"
LC_ALL=C sort -u "$temporary_directory/staged" > "$temporary_directory/staged-sorted"

if ! cmp -s "$allowlist_path" "$temporary_directory/expected"; then
  printf 'Initial publication allowlist must be sorted and contain no duplicates.\n' >&2
  exit 1
fi

if ! cmp -s "$temporary_directory/expected" "$temporary_directory/candidates-sorted"; then
  printf 'Candidate files do not match the initial publication allowlist.\n' >&2
  diff -u "$temporary_directory/expected" "$temporary_directory/candidates-sorted" || true
  exit 1
fi

if ! cmp -s "$temporary_directory/expected" "$temporary_directory/staged-sorted"; then
  printf 'Staged files do not match the initial publication allowlist.\n' >&2
  diff -u "$temporary_directory/expected" "$temporary_directory/staged-sorted" || true
  exit 1
fi

configured_email="$(git -C "$repository_root" config --local user.email || true)"
if [[ "$configured_email" != *@users.noreply.github.com ]]; then
  printf 'Repository-local Git email is missing or is not a GitHub noreply address.\n' >&2
  exit 1
fi

origin_url="$(git -C "$repository_root" remote get-url origin)"
expected_ssh_origin='git''@''github.com:purnalica/fitfreed.git'
expected_https_origin='https://github.com/purnalica/fitfreed.git'
if [[ "$origin_url" != "$expected_ssh_origin" && "$origin_url" != "$expected_https_origin" ]]; then
  printf 'Unexpected origin URL for initial publication.\n' >&2
  exit 1
fi

"$script_dir/check-repository-content.sh"
"$script_dir/run-secret-scan.sh"

git -C "$repository_root" diff --cached --check
printf 'Initial publication gate passed.\n'
