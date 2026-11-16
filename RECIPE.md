# Tailscale switch

![Tailscale switch](preview.png)

A macOS-only Herdr panel with one Tailscale toggle. On starts the system `tailscaled` and runs `tailscale up`. Off runs `tailscale down` and unloads the daemon so it does not return at the next boot. The panel asks for an administrator password on every click.

## What you see

One full-width row on the window chrome: the word "Tailscale" (12px) and a 36×20 pill. The knob is a 14px circle. On: pill uses the accent color, knob on the right, label in the foreground color. Off: pill uses the border color, knob on the left, label dim. A failed click adds a 10px line under the row, in the blocked color: "已取消" when the password dialog is cancelled, otherwise "启动失败". Top border is 1px `border`, background is `chrome`, horizontal padding 14.

`mod.json` is `{ "place": "none" }`. Nothing shows until a layout block sets `content.mod` to `"tailscale"`.

## How it behaves

- Every 4 seconds, and once at start: `launchctl print system/com.tailscale.tailscaled`. If that is not running, the switch is off. If it is running, `tailscale status --json`; the switch is on only when `BackendState` is `Running` or `Starting`.
- Click does nothing while a toggle is in flight. Otherwise the pill flips immediately, then `osascript` runs `toggle.sh on` or `toggle.sh off` with administrator privileges (timeout 120s). Failure flips the pill back and shows the error line. Success polls again.
- `on`: if `RunAtLoad` or `KeepAlive` is not already false, set both false, `bootout`, then `bootstrap`. If the job is not loaded, `bootstrap`. Then `launchctl kickstart`. Wait up to 10s for `/var/run/tailscaled.socket`. Then `tailscale up --ssh --accept-dns=false --timeout=25s`.
- `off`: `tailscale down`, `launchctl bootout`, then set `RunAtLoad` and `KeepAlive` to false.

## Built from

- `mods/tailscale/main.js`: a gpui-kit `View`. Calls `exec`, `home`, `theme` from `herdr`. No layout props. No keys.
- `mods/tailscale/toggle.sh`: root shell. Plist `/Library/LaunchDaemons/com.tailscale.tailscaled.plist`. Binary `/usr/local/bin/tailscale`.
- `mods/tailscale/mod.json`: `{ "place": "none" }`.
- Does not install Tailscale. Does not change DNS, routes, or exit-node settings except by repeating `--accept-dns=false` on `up`.

## Watch out

- macOS only. The script uses `launchctl`, `plutil`, and `/var/run/tailscaled.socket`.
- `--accept-dns=false` is required on a machine whose Tailscale prefs already have that flag (here, because Clash owns DNS). `tailscale up` exits 1 if a non-default pref is omitted. A machine that wants MagicDNS must drop that flag before the first `up`.
- Do not rewrite the plist when both flags are already false. `plutil` wakes BackgroundTaskManagement and can reload the job out from under a start.
- `launchctl print` succeeding is not "the daemon is running". With `RunAtLoad` false the job stays uninitialized until `kickstart`.
- The password dialog is modal and can sit for the whole 120s timeout. Cancelling it is not a start failure.
- Copying this over an existing `mods/tailscale` replaces that person's script. Rename instead.
- The status-bar switch in a shipped `workspace-status` mod is a separate edit. This recipe does not touch it. That edit, if present, calls this same `toggle.sh`.
- `gpui-kit.d.ts` is written by Herdr. Do not ship it.

## Done when

- `herdr-app check mods/tailscale` exits 0.
- A layout block with `"content": { "mod": "tailscale" }` draws the row. Off: dim label, knob left. On: accent pill, knob right.
- After a confirmed Off: no `tailscaled` process, `launchctl print system/com.tailscale.tailscaled` fails, `/var/run/tailscaled.socket` is gone, and both plist flags are false.
- After a confirmed On: `tailscale status --json` reports `BackendState` `Running` and the local machine `Online` true. Cancelling the password dialog leaves the daemon stopped and shows "已取消".
