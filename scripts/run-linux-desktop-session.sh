#!/usr/bin/env bash

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: scripts/run-linux-desktop-session.sh <command> [arguments...]" >&2
  exit 64
fi
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "The bounded desktop-session wrapper requires Linux" >&2
  exit 1
fi
if [[ -z "${DISPLAY:-}" || -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
  echo "The bounded desktop-session wrapper requires X11 and D-Bus session addresses" >&2
  exit 1
fi
for required_command in fluxbox xprop; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "The bounded desktop-session wrapper is missing a required tool" >&2
    exit 1
  fi
done

fluxbox -display "$DISPLAY" >/dev/null 2>&1 &
window_manager_pid=$!

cleanup_window_manager() {
  kill "$window_manager_pid" >/dev/null 2>&1 || true
  wait "$window_manager_pid" 2>/dev/null || true
}
trap cleanup_window_manager EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

window_manager_ready=false
for _ in {1..100}; do
  if xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -Eq ': window id # 0x[[:xdigit:]]+$'; then
    window_manager_ready=true
    break
  fi
  if ! kill -0 "$window_manager_pid" >/dev/null 2>&1; then
    break
  fi
  sleep 0.05
done
if [[ "$window_manager_ready" != true ]]; then
  if kill -0 "$window_manager_pid" >/dev/null 2>&1; then
    echo "The bounded desktop-session window manager did not become ready within five seconds" >&2
  else
    echo "The bounded desktop-session window manager exited before becoming ready" >&2
  fi
  exit 1
fi

"$@"
