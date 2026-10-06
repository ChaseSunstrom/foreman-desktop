# Foreman Desktop

A desktop app for [Foreman](https://github.com/ChaseSunstrom/foreman): every project, agent session and device in one animated window. It runs on Tauri 2 (Rust) with Svelte 5.

- **Home**: what's waiting on you (a yes to give, or tasks blocked on something only you can do), the tasks in progress on every device, and live and recent sessions.
- **Projects**: the active task with its stage, steps, criteria and audits. Every queue, inbox and blocked item is listed, with search, type filters and the full brief, and you can start, drop, approve a plan or capture an idea. Drive and autonomy switches, the last gate run and recent activity are here too, all updating live. A Decisions tab lists what was decided along the way, newest first. Costly and outward decisions made without asking are flagged for your review.
- **Sessions**: every Claude Code session on every device (terminal, Remote Control, headless) next to the ones Foreman started. Each one has:
  - its conversation (Markdown, tool calls with their output, pasted and tool-returned images);
  - its subagents and their transcripts;
  - its scratchpad files and a picture gallery.

  Message any session: Foreman sessions take the next turn; a Claude session is continued headlessly by its own id, as a fork while its terminal is still open.
- **Remote control**: the `claude remote-control` units on each device (`fm serve`). Serve a project, stop a unit, or see why one died.
- **Agents** and **Devices**: which agents each device has, whether Foreman's guard, MCP server and rules are wired into them (`fm agents`, with Wire in and Remove), your tailnet's machines, and an explicit fingerprint check before any device is trusted.
- **Ctrl+K** jumps to any project, session, page or action; **Ctrl+N** starts a session.

## How it works

The app is a client of Foreman's own CLI. It never talks to a daemon:

- On this machine it runs `~/.claude/foreman/plugin/bin/fm … --json` directly. On other devices it runs the same command over `ssh`, with one shared connection per host.
- It keeps three live streams per device (`fm projects --follow`, `fm session list --follow`, `fm claude list --follow`), plus one for the project or session you have open.
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
- `FOREMAN_DESKTOP_VIEW=sessions|remote|agents|devices|new|palette|project:<slug>[:tab]|session:<id>|claude:<id>`: the page to open first.

On Wayland with NVIDIA, the app sets `__NV_DISABLE_EXPLICIT_SYNC=1` itself, which is the fix Tauri recommends for WebKitGTK's "Error 71".
