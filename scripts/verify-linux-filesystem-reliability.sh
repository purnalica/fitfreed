#!/usr/bin/env bash
set -euo pipefail

[ "$(uname -s)" = "Linux" ] || {
  echo "Linux filesystem reliability verification requires Linux." >&2
  exit 1
}

filesystem_root="$(mktemp -d)"
mounted=false

cleanup() {
  set +e
  if [ "$mounted" = true ]; then
    sudo umount "$filesystem_root"
  fi
  rmdir "$filesystem_root"
}
trap cleanup EXIT

sudo mount -t tmpfs -o size=32M,nodev,nosuid,noexec \
  fitfreed-filesystem-admission "$filesystem_root"
mounted=true
sudo chown "$(id -u):$(id -g)" "$filesystem_root"
touch "$filesystem_root/.fitfreed-isolated-filesystem"

FITFREED_LINUX_FILESYSTEM_TEST_ROOT="$filesystem_root" \
  CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-8}" \
  cargo test \
    --manifest-path src-tauri/Cargo.toml \
    --release \
    --lib \
    infrastructure::tests::recovers_from_linux_disk_exhaustion_without_losing_committed_history \
    -- \
    --ignored --exact
