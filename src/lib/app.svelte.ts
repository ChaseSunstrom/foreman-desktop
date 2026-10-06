// The app's state: devices (kept in this webview's storage), and per device its live project and session lists,
// each from one `fm … --follow` stream, plus the installed agents.
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { fm, live, type Device, type Stream } from "./fm";
import type { AgentRow, ProjectRow, SessionRow } from "./types";

export type View =
  | { kind: "home" }
  | { kind: "project"; device: string; slug: string }
  | { kind: "sessions"; device?: string; id?: string }
  | { kind: "agents" }
  | { kind: "devices" };

export type DeviceState = {
  status: "connecting" | "online" | "offline";
  error?: string;
  projects: ProjectRow[];
  sessions: SessionRow[];
  agents: AgentRow[];
};

type Toast = { id: number; kind: "ok" | "bad" | "info"; text: string };

const KEY = "foreman.devices.v1";
const LOCAL: Device = { id: "local", name: "This device", host: null };

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
      .then((v) => {
        if (!v) return;
        const [kind, slug] = v.split(":");
        if (kind === "project" && slug) this.view = { kind: "project", device: "local", slug };
        else if (kind === "session" && slug) this.view = { kind: "sessions", device: "local", id: slug };
        else if (["home", "sessions", "agents", "devices"].includes(kind)) this.view = { kind } as View;
        if (kind === "new") this.newSession = {};
      })
      .catch(() => {});
  }

  device(id: string) {
    return this.devices.find((d) => d.id === id);
  }

  st(id: string): DeviceState {
    return this.state[id] ?? { status: "connecting", projects: [], sessions: [], agents: [] };
  }

  connect(d: Device) {
    this.disconnect(d.id);
    this.state[d.id] = { status: "connecting", projects: [], sessions: [], agents: [] };
    // a device is online while any of its streams is; each stream's own error is kept (an older fm on the device
    // may serve projects but not sessions)
    const health: Record<string, { ok: boolean; error?: string }> = {};
    const set = (name: string) => (s: { ok: boolean; error?: string }) => {
      const cur = this.state[d.id];
      if (!cur) return;
      health[name] = s;
      const all = Object.values(health);
      cur.status = all.some((h) => h.ok) ? "online" : "offline";
      cur.error = Object.entries(health).filter(([, h]) => !h.ok).map(([n, h]) => `${n}: ${h.error}`).join(" · ") || undefined;
    };
    const streams = [
      live(d, ["projects", "--json", "--follow"], (o) => this.state[d.id] && (this.state[d.id].projects = o.projects ?? []), set("projects")),
      live(d, ["session", "list", "--json", "--follow"], (o) => this.sessionsChanged(d, o.sessions ?? []), set("sessions")),
    ];
    this.streams.set(d.id, streams);
    fm<{ agents: AgentRow[] }>(d, ["session", "agents", "--json"])
      .then((o) => this.state[d.id] && (this.state[d.id].agents = o.agents))
      .catch(() => {});
  }

  disconnect(id: string) {
    for (const s of this.streams.get(id) ?? []) s.stop();
    this.streams.delete(id);
  }

  private sessionsChanged(d: Device, rows: SessionRow[]) {
    if (!this.state[d.id]) return;
    const before = new Map(this.state[d.id].sessions.map((s) => [s.id, s.status]));
    this.state[d.id].sessions = rows;
    for (const r of rows) {
      const was = before.get(r.id);
      if (was === "running" && r.status !== "running") {
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

  toast(kind: Toast["kind"], text: string) {
    const id = ++this.seq;
    this.toasts.push({ id, kind, text });
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), kind === "bad" ? 7000 : 3500);
  }

  /** Run an fm action on a device; a toast says how it went. */
  async act(deviceId: string, args: string[], done?: string) {
    const d = this.device(deviceId);
    if (!d) return null;
    try {
      const out = await fm(d, args);
      if (done) this.toast("ok", done);
      return out ?? true;
    } catch (e) {
      this.toast("bad", String(e).split("\n").slice(-3).join(" "));
      return null;
    }
  }

  get allSessions() {
    return this.devices.flatMap((d) => this.st(d.id).sessions.map((s) => ({ ...s, device: d.id })));
  }

  get running() {
    return this.allSessions.filter((s) => s.status === "running" || s.status === "starting").length;
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
