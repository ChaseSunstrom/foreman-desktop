// What fm prints (--json): the shapes the app reads. The view model's full contract is foreman-ui's
// types/index.d.ts in the Foreman repo; only the fields drawn here are listed.
export type Step = { n: number; text: string; done: boolean; current: boolean };
export type Criterion = { n: number; text: string; verify: string | null; checked: boolean };
export type Plan = { interpretation: string; approach: string; steps: Step[]; criteria: Criterion[] };
/** One decisions.md row (fm decide --list --json, T-0341). */
export type Decision = { date: string; kind: "costly" | "outward" | null; text: string; why: string; reversed: boolean };

export type Item = {
  id: string;
  type: string;
  tier: string;
  title: string;
  status: string;
  waits?: string | null;
  plan?: Plan;
  steps_done?: number;
  steps_total?: number;
  age_days?: number;
};
export type Active = Item & {
  stage: string;
  stages: string[];
  steps: Step[];
  criteria: Criterion[];
  audits: { done: number; need: number };
  blockers: string[];
  on_task_s?: number | null;
};
export type Check = { cmd: string; exit: number; s: number; note?: string | null };
export type ProjectView = {
  v: number;
  project: string | null;
  root?: string;
  mode?: { autonomy: string; drive: boolean; sensitive: boolean };
  active?: Active | null;
  next?: string | null;
  queue?: Item[];
  inbox?: Item[];
  inbox_total?: number;
  approvals?: { task: string; allow: string[]; why: string }[];
  recent?: string[];
  today_done?: number;
  checks?: { at: string; results: Check[] } | null;
  budget?: { today_usd: number; subagent_tokens: number; subagents_paused?: string | null } | null;
  typical?: Record<string, number>;
};
/** This device's plan usage (fm projects --json, T-0346): percents, and the share of the week gone by (0–1). */
export type Usage = { five_hour?: number; seven_day?: number; week_gone?: number };

export type ProjectRow = {
  project: string;
  root: string;
  exists?: boolean;
  error?: string;
  active: null | {
    id: string;
    type: string;
    tier: string;
    title: string;
    stage: string;
    steps_done: number;
    steps_total: number;
  };
  queue: number;
  inbox: number;
  blocked: number;
  waits: number;
  drive: boolean;
  autonomy: string;
  sensitive: boolean;
  updated: number | null;
};
export type SessionRow = {
  id: string;
  agent: string;
  cwd: string;
  project: string | null;
  title: string;
  model: string | null;
  status: "starting" | "running" | "idle" | "stopped" | "died";
  turns: number;
  agent_session: string | null;
  created: string;
  updated: string;
  last?: { ts: string; kind: string; tool?: string; ok?: boolean; text: string };
};
export type AgentRow = { agent: string; installed: boolean; path: string | null; version: string | null };
export type SessionEvent = {
  ts: string;
  turn: number;
  kind: "user" | "init" | "text" | "tool" | "tool_result" | "result" | "error" | "status" | "raw" | "image";
  text?: string;
  tool?: string;
  detail?: string;
  id?: string;
  ok?: boolean;
  cost_usd?: number;
  agent_session?: string;
  model?: string;
};

export const TYPE_COLOR: Record<string, string> = {
  FIX: "var(--t-fix)",
  FEATURE: "var(--t-feature)",
  CLEAN: "var(--t-clean)",
  PERF: "var(--t-perf)",
  PERFORMANCE: "var(--t-perf)",
  SECURITY: "var(--t-security)",
  RESEARCH: "var(--t-research)",
};
export const TIER_WORD: Record<string, string> = { S: "small", M: "medium", L: "large" };
export const AGENT: Record<string, { name: string; color: string; mark: string }> = {
  claude: { name: "Claude Code", color: "#d97757", mark: "C" },
  codex: { name: "Codex", color: "#8fbf9f", mark: "X" },
  gemini: { name: "Gemini CLI", color: "#7c9cdc", mark: "G" },
  opencode: { name: "opencode", color: "#c9b46a", mark: "O" },
};
export const base = (p: string) => p.replace(/\/+$/, "").split("/").pop() || p;

// fm claude (Claude Code's own sessions on a device) and fm serve status
export type ClaudeSession = {
  id: string;
  dir: string;
  cwd: string | null;
  entrypoint: string | null;
  branch: string | null;
  version: string | null;
  prompt: string | null;
  title: string;
  model: string | null;
  last: string | null;
  kind: string;
  size: number;
  updated: number;
  live: boolean;
  subagents: number;
};
export type Ev = SessionEvent & { n?: number; ref?: string; media_type?: string; queued?: boolean; tool_use_id?: string };
export type SubAgent = { id: string; type: string | null; description: string | null; updated: number; live: boolean };
export type ScratchFile = { path: string; size: number; mtime: number; kind: "image" | "file" | "link" };
export type ServeUnit = {
  project: string;
  unit: string;
  state: string;
  root: string | null;
  active: string | null;
  queue: number;
  serve_mode: boolean;
  log: string[];
};
export type StateItem = {
  id: string;
  type: string;
  tier: string;
  status: string;
  title: string;
  priority?: string;
  steps_done: number;
  steps_total: number;
  created?: string;
  updated?: string;
  explore?: boolean;
  source?: string;
  reason?: string;
};
export type ProjectState = {
  project: string;
  root: string;
  queue: StateItem[];
  inbox: StateItem[];
  blocked: StateItem[];
  deferred: string[];
  pending: string[];
};
/** One row of the Sessions list: a Foreman-started session or a Claude Code session, on some device. */
export type SessionItem = {
  key: string;
  device: string;
  source: "fm" | "claude";
  id: string;
  title: string;
  agent: string;
  cwd: string;
  kind: string;
  live: boolean;
  status: string;
  updated: number;
  last: string;
  subagents: number;
};

export function ago(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
export function bytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}
