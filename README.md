# Foreman Desktop

A desktop app for [Foreman](https://github.com/ChaseSunstrom/foreman): every project, agent session and device in one animated window. It runs on Tauri 2 (Rust) with Svelte 5.

- **Overview**: active work across all devices, how many sessions are running, and what's waiting on you.
- **Projects**: the active task with its stage, steps, criteria and audits; the queue and inbox (start, drop, approve a plan, capture an idea); drive and autonomy switches; the last gate run; and recent activity. All of it updates live.
- **Sessions**: start, watch, message and stop sessions for Claude Code, Codex, Gemini CLI or opencode, on any device. Tool calls stream in as they run, each paired with its result. Sessions run detached, so they keep going when you close the app.
- **Agents**: which agent CLIs each device has, and whether Foreman's rules are wired into them.
- **Devices**: this machine plus any you add over ssh. Your tailnet's machines are suggested automatically.

## How it works

The app is a client of Foreman's own CLI. It never talks to a daemon:

- On this machine it runs `~/.claude/foreman/plugin/bin/fm … --json` directly. On other devices it runs the same command over `ssh`, with one shared connection per host.
- It keeps one live stream per device (`fm projects --follow`, `fm session list --follow`), plus one for the project or session you have open.
- Nothing listens on a new port. Who can reach a device is decided by your ssh keys or Tailscale ACLs.
- An unknown host key stops the connection. The Devices page shows the device's fingerprints, and they're trusted only when you click; a key that changes later is refused.
- Shared-connection sockets live in `$XDG_RUNTIME_DIR` or `~/.ssh`, never a shared `/tmp`. The Rust side runs only the `fm` commands the app uses.

## Requirements

- Every device needs Foreman installed with its `install.sh`; the app needs `fm projects`, `fm session` and `--follow`, from Foreman's T-0322 and T-0323 onwards.
- Every other device needs key-based ssh from this machine. Tailscale SSH (`tailscale up --ssh` on that device) is the easiest way to get it.
- To build: Rust (rustup), bun, and on Linux `webkit2gtk-4.1`.

## Run and build

```bash
bun install
bun run tauri dev                         # live-reloading window
bun run tauri build                       # release bundles (AppImage, deb, rpm)
cd src-tauri && cargo test                # the transport: quoting, host checks, local + ssh
```

Optional environment variables:

- `FOREMAN_HOME`: where Foreman lives, if not `~/.claude/foreman`.
- `FOREMAN_DESKTOP_VIEW=sessions|agents|devices|new|project:<slug>|session:<id>`: the page to open first.

On Wayland with NVIDIA, the app sets `__NV_DISABLE_EXPLICIT_SYNC=1` itself, which is the fix Tauri recommends for WebKitGTK's "Error 71".
