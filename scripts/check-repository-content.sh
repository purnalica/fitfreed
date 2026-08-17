#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
failure_count=0
candidate_count=0

report_failure() {
  printf 'Repository content check failed for %s: %s\n' "$1" "$2" >&2
  failure_count=$((failure_count + 1))
}

while IFS= read -r -d '' candidate_path; do
  candidate_file="$repository_root/$candidate_path"

  if [[ ! -e "$candidate_file" ]] && [[ ! -L "$candidate_file" ]] &&
    git -C "$repository_root" ls-files --deleted --error-unmatch -- "$candidate_path" >/dev/null 2>&1; then
    continue
  fi
  candidate_count=$((candidate_count + 1))

  case "$candidate_path" in
    .idea/* | .local/* | .tools/* | docs/reports/* | *.zip | *.sqlite | *.sqlite3 | *.db | *.parquet)
      report_failure "$candidate_path" "local-only or generated path"
      continue
      ;;
  esac

  if [[ "$candidate_path" == *$'\n'* ]]; then
    report_failure "$candidate_path" "newline in filename"
    continue
  fi

  if [[ -L "$candidate_file" ]]; then
    report_failure "$candidate_path" "symbolic links require explicit publication review"
    continue
  fi

  if [[ ! -f "$candidate_file" ]]; then
    report_failure "$candidate_path" "not a regular file"
    continue
  fi

  byte_count="$(wc -c < "$candidate_file" | tr -d '[:space:]')"
  if (( byte_count > 2097152 )); then
    report_failure "$candidate_path" "file exceeds the 2 MiB review threshold"
  fi

  if [[ -s "$candidate_file" ]] && ! LC_ALL=C grep -Iq . "$candidate_file"; then
    report_failure "$candidate_path" "binary content requires explicit provenance and publication review"
    continue
  fi

  if LC_ALL=C grep -Eq '/(Users|home)/[[:alnum:]_.-]+/' "$candidate_file"; then
    report_failure "$candidate_path" "machine-local home path"
  fi

  if LC_ALL=C grep -Eq '[A-Za-z]:\\Users\\[[:alnum:]_.-]+\\' "$candidate_file"; then
    report_failure "$candidate_path" "machine-local Windows home path"
  fi

  if [[ "$candidate_path" == *.md ]]; then
    if LC_ALL=C grep -Eiq 'MacBook (Air|Pro)([^[:alpha:]]|$)|Mac (mini|Studio|Pro)([^[:alpha:]]|$)|iMac([^[:alpha:]]|$)|Apple M[0-9]+ (Pro|Max|Ultra)([^[:alpha:]]|$)|[0-9]+ CPU cores|Mac[0-9]+,[0-9]+|(16|24|32|36|48|64|96|128|192) (GB|GiB)( of)? memory|macOS [0-9]+\.[0-9]+\.[0-9]+, (Apple Silicon|Intel)' "$candidate_file" ||
      LC_ALL=C grep -Eq '(^|[^[:alnum:]])[0-9]{2}[A-Z][0-9]{2,}([^[:alnum:]]|$)' "$candidate_file"; then
      report_failure "$candidate_path" "exact workstation details in public documentation"
    fi
  fi

  export_name_pattern='polar-user-data''-export|user-data-export[_-][[:xdigit:]]{8}'
  if [[ "$candidate_path" != ".gitignore" ]] && LC_ALL=C grep -Eiq "$export_name_pattern" "$candidate_file"; then
    report_failure "$candidate_path" "private export name or identifier"
  fi

  if [[ "$candidate_path" != "package-lock.json" ]] &&
    LC_ALL=C grep -Eiq '[[:alnum:]._%+-]+@[[:alpha:]][[:alnum:].-]*\.[[:alpha:]]{2,}' "$candidate_file"; then
    report_failure "$candidate_path" "email address in repository content"
  fi

  if LC_ALL=C grep -Eq -- '-----BEGIN ([A-Z0-9]+ )?PRIVATE KEY-----|github_pat_[[:alnum:]_]{20,}|(ghp|gho|ghu|ghs|ghr)_[[:alnum:]]{20,}|AKIA[[:alnum:]]{16}|xox[baprs]-[[:alnum:]-]{10,}' "$candidate_file"; then
    report_failure "$candidate_path" "credential-shaped content"
  fi

  if LC_ALL=C grep -q $'\r' "$candidate_file"; then
    report_failure "$candidate_path" "carriage-return line endings"
  fi

  if LC_ALL=C grep -Eq '[[:blank:]]+$' "$candidate_file"; then
    report_failure "$candidate_path" "trailing whitespace"
  fi
done < <(git -C "$repository_root" ls-files --cached --others --exclude-standard -z)

if (( candidate_count == 0 )); then
  printf 'Repository content check found no candidate files.\n' >&2
  exit 1
fi

if git -C "$repository_root" rev-parse --verify HEAD >/dev/null 2>&1; then
  while IFS= read -r commit_email; do
    [[ -z "$commit_email" ]] && continue
    if [[ "$commit_email" != *@users.noreply.github.com ]]; then
      report_failure "Git history" "author or committer email is not a GitHub noreply address"
      break
    fi
  done < <(git -C "$repository_root" log --branches --remotes --tags --format='%ae%n%ce')

  while IFS= read -r tagger_identity; do
    [[ -z "$tagger_identity" ]] && continue
    tagger_email="${tagger_identity##*<}"
    tagger_email="${tagger_email%>*}"
    if [[ "$tagger_email" != *@users.noreply.github.com ]]; then
      report_failure "Git tags" "tagger email is not a GitHub noreply address"
      break
    fi
  done < <(git -C "$repository_root" for-each-ref --format='%(taggeremail)' refs/tags)
fi

if (( failure_count > 0 )); then
  printf 'Repository content check found %d problem(s).\n' "$failure_count" >&2
  exit 1
fi

printf 'Repository content check passed for %d candidate file(s).\n' "$candidate_count"
