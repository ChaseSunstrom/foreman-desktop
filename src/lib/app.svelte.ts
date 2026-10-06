// The app's state: devices (kept in this webview's storage) and, per device, three live lists — Foreman projects,
// Foreman-started agent sessions and Claude Code's own sessions — each from one `fm … --follow` stream.
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { fm, live, type Device, type Stream } from "./fm";
import type { AgentRow, ClaudeSession, ProjectRow, SessionItem, SessionRow, Usage } from "./types";

export type View =
  | { kind: "home" }
  | { kind: "project"; device: string; slug: string; tab?: string }
  | { kind: "sessions"; device?: string; id?: string; source?: "fm" | "claude" }
  | { kind: "remote" }
  | { kind: "agents" }
  | { kind: "devices" };

export type DeviceState = {
  status: "connecting" | "online" | "offline";
  error?: string;
  projects: ProjectRow[];
  sessions: SessionRow[];
  claude: ClaudeSession[];
  agents: AgentRow[];
  usage: Usage;
};

type Toast = { id: number; kind: "ok" | "bad" | "info"; text: string; action?: { label: string; run: () => void } };

const KEY = "foreman.devices.v1";
const LOCAL: Device = { id: "local", name: "This device", host: null };
const empty = (): DeviceState => ({ status: "connecting", projects: [], sessions: [], claude: [], agents: [], usage: {} });

function load(): Device[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return [LOCAL];
}

class App {
  devices = $state<Device[]>(load());
  state = $state<Record<string, DeviceState>>({});
  view = $state<View>({ kind: "home" });
  toasts = $state<Toast[]>([]);
  newSession = $state<null | { device?: string; cwd?: string }>(null);
  palette = $state(false);
  private streams = new Map<string, Stream[]>();
  private seq = 0;

  constructor() {
    invoke<string>("this_host")
      .then((h) => {
        const local = this.devices.find((d) => d.id === "local");
        if (local && local.name === "This device") local.name = h;
      })
      .catch(() => {});
    for (const d of this.devices) this.connect(d);
    invoke<string | null>("initial_view")
      .then((v) => v && this.open(v))
      .catch(() => {});
  }

  /** FOREMAN_DESKTOP_VIEW: sessions|remote|agents|devices|new|palette|project:<slug>[:tab]|session:<id>|claude:<id> */
  open(v: string) {
    const [kind, a, b] = v.split(":");
    if (kind === "project" && a) this.view = { kind: "project", device: "local", slug: a, tab: b };
    else if (kind === "session" && a) this.view = { kind: "sessions", device: "local", id: a, source: "fm" };
    else if (kind === "claude" && a) this.view = { kind: "sessions", device: "local", id: a, source: "claude" };
    else if (["home", "sessions", "remote", "agents", "devices"].includes(kind)) this.view = { kind } as View;
    else if (kind === "new") this.newSession = {};
    else if (kind === "palette") this.palette = true;
  }

  device(id: string) {
    return this.devices.find((d) => d.id === id);
  }

  st(id: string): DeviceState {
    return this.state[id] ?? empty();
  }

  connect(d: Device) {
    this.disconnect(d.id);
    this.state[d.id] = empty();
    // online while any stream is; each stream keeps its own error (an older fm may lack a command)
    const health: Record<string, { ok: boolean; error?: string }> = {};
    const set = (name: string) => (s: { ok: boolean; error?: string }) => {
      const cur = this.state[d.id];
      if (!cur) return;
      health[name] = s;
      cur.status = Object.values(health).some((h) => h.ok) ? "online" : "offline";
      cur.error =
        Object.entries(health)
          .filter(([, h]) => !h.ok)
          .map(([n, h]) => `${n}: ${h.error}`)
          .join(" · ") || undefined;
    };
    const put = <K extends keyof DeviceState>(k: K, v: DeviceState[K]) => {
      if (this.state[d.id]) this.state[d.id][k] = v;
    };
    this.streams.set(d.id, [
      live(d, ["projects", "--json", "--follow"], (o) => {
        put("projects", o.projects ?? []);
        put("usage", o.usage ?? {});
      }, set("projects")),
      live(d, ["session", "list", "--json", "--follow"], (o) => this.sessionsChanged(d, o.sessions ?? []), set("sessions")),
      live(d, ["claude", "list", "--all", "--limit", "400", "--json", "--follow"], (o) => put("claude", o.sessions ?? []), set("claude")),
    ]);
    fm<{ agents: AgentRow[] }>(d, ["session", "agents", "--json"])
      .then((o) => put("agents", o.agents))
      .catch(() => {});
  }

  disconnect(id: string) {
    for (const s of this.streams.get(id) ?? []) s.stop();
    this.streams.delete(id);
  }

  private sessionsChanged(d: Device, rows: SessionRow[]) {
    const cur = this.state[d.id];
    if (!cur) return;
    const before = new Map(cur.sessions.map((s) => [s.id, s.status]));
    cur.sessions = rows;
    for (const r of rows) {
      if (before.get(r.id) === "running" && r.status !== "running") {
        const ok = r.last?.kind !== "result" || r.last?.ok !== false;
        notify(`${ok ? "Finished" : "Stopped"}: ${r.title}`, r.last?.text || `${r.agent} on ${d.name}`);
      }
    }
  }

  save() {
    localStorage.setItem(KEY, JSON.stringify(this.devices.map(({ id, name, host }) => ({ id, name, host }))));
  }

  addDevice(name: string, host: string) {
    if (hostProblem(host)) return null;
    const d: Device = { id: `d${Date.now().toString(36)}`, name: name || host, host };
    this.devices.push(d);
    this.save();
    this.connect(d);
    return d;
  }

  removeDevice(id: string) {
    if (id === "local") return;
    this.disconnect(id);
    this.devices = this.devices.filter((d) => d.id !== id);
    delete this.state[id];
    this.save();
  }

  toast(kind: Toast["kind"], text: string, action?: Toast["action"]) {
    const id = ++this.seq;
    this.toasts.push({ id, kind, text, action });
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), kind === "bad" ? 8000 : action ? 6000 : 3500);
  }

  /** Run an fm action on a device; a toast says how it went. */
  async act<T = any>(deviceId: string, args: string[], done?: string): Promise<T | null> {
    const d = this.device(deviceId);
    if (!d) return null;
    try {
      const out = await fm<T>(d, args);
      if (done) this.toast("ok", done);
      return (out ?? (true as T)) as T;
    } catch (e) {
      this.toast("bad", String(e).split("\n").slice(-3).join(" "));
      return null;
    }
  }

  /** Every session on every device, Foreman's and Claude Code's, live first, then newest. */
  get sessions(): SessionItem[] {
    const out: SessionItem[] = [];
    for (const d of this.devices) {
      const st = this.st(d.id);
      for (const s of st.sessions)
        out.push({
          key: `${d.id}/fm/${s.id}`, device: d.id, source: "fm", id: s.id, title: s.title, agent: s.agent, cwd: s.cwd,
          kind: "foreman", live: s.status === "running" || s.status === "starting", status: s.status,
          updated: Date.parse(s.updated) || 0, last: s.last?.text ?? "", subagents: 0,
        });
      for (const s of st.claude)
        out.push({
          key: `${d.id}/claude/${s.id}`, device: d.id, source: "claude", id: s.id, title: s.title, agent: "claude",
          cwd: s.cwd ?? "", kind: s.kind, live: s.live, status: s.live ? "live" : "ended", updated: s.updated * 1000,
          last: s.last ?? s.prompt ?? "", subagents: s.subagents,
        });
    }
    return out.sort((a, b) => Number(b.live) - Number(a.live) || b.updated - a.updated);
  }

  /** Live sessions a person is in or Foreman started (headless SDK runs, like a background review, don't count). */
  get running() {
    return this.sessions.filter((s) => s.live && s.kind !== "headless").length;
  }

  get waiting() {
    return this.devices.reduce((n, d) => n + this.st(d.id).projects.reduce((m, p) => m + (p.waits || 0), 0), 0);
  }
}

/** Why an ssh target can't be used, or null. The Rust side refuses the same (never an ssh option); ports and
 * jump hosts belong in ~/.ssh/config under a Host alias. */
export function hostProblem(h: string): string | null {
  const v = h.trim();
  if (!v) return "Enter an ssh host";
  if (v.startsWith("-") || !/^[A-Za-z0-9._@-]+$/.test(v))
    return "Use user@host or a Host alias from ~/.ssh/config (put ports and options there)";
  return null;
}

// notification servers may render markup: remote text never becomes a link
const plain = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "‹", ">": "›", "&": "+" })[c]!);

let allowed: boolean | null = null;
async function notify(title: string, body: string) {
  if (document.hasFocus()) return;
  try {
    if (allowed === null) allowed = (await isPermissionGranted()) || (await requestPermission()) === "granted";
    if (allowed) sendNotification({ title: plain(title), body: plain(body.slice(0, 160)) });
  } catch {}
}

export const app = new App();
