#!/bin/sh
# Runs as root via osascript. Starts or stops the system tailscaled
# and keeps it from coming back at the next reboot.
set -eu
PLIST=/Library/LaunchDaemons/com.tailscale.tailscaled.plist
LABEL=system/com.tailscale.tailscaled
TS=/usr/local/bin/tailscale

case "${1:-}" in
on)
  # Keep boot from auto-starting it, but do not rewrite the plist when
  # those values are already false: plutil wakes BackgroundTaskManagement
  # and can reload the job out from under a start we just requested.
  run_at_load=$(plutil -extract RunAtLoad raw "$PLIST" 2>/dev/null || echo missing)
  keep_alive=$(plutil -extract KeepAlive raw "$PLIST" 2>/dev/null || echo missing)
  if [ "$run_at_load" != "false" ] || [ "$keep_alive" != "false" ]; then
    plutil -replace RunAtLoad -bool false "$PLIST"
    plutil -replace KeepAlive -bool false "$PLIST"
    launchctl bootout "$LABEL" >/dev/null 2>&1 || true
    launchctl bootstrap system "$PLIST"
  elif ! launchctl print "$LABEL" >/dev/null 2>&1; then
    launchctl bootstrap system "$PLIST"
  fi
  # print succeeding only means the job is loaded. RunAtLoad=false leaves
  # it uninitialized, so tailscale up has no daemon to talk to.
  launchctl kickstart "$LABEL"
  i=0
  while [ "$i" -lt 40 ]; do
    if [ -S /var/run/tailscaled.socket ]; then
      break
    fi
    i=$((i + 1))
    sleep 0.25
  done
  if [ ! -S /var/run/tailscaled.socket ]; then
    echo "tailscaled did not create /var/run/tailscaled.socket" >&2
    exit 1
  fi
  # accept-dns=false is already set on this machine (Clash owns DNS).
  # tailscale up refuses to change prefs unless every non-default flag is repeated.
  "$TS" up --ssh --accept-dns=false --timeout=25s
  ;;
off)
  "$TS" down || true
  launchctl bootout "$LABEL" || true
  plutil -replace RunAtLoad -bool false "$PLIST"
  plutil -replace KeepAlive -bool false "$PLIST"
  ;;
*)
  echo "usage: toggle.sh on|off" >&2
  exit 2
  ;;
esac
