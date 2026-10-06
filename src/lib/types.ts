// What fm prints (--json): the shapes the app reads. The view model's full contract is foreman-ui's
// types/index.d.ts in the Foreman repo; only the fields drawn here are listed.
export type Step = { n: number; text: string; done: boolean; current: boolean };
export type Criterion = { n: number; text: string; verify: string | null; checked: boolean };
export type Plan = { interpretation: string; approach: string; steps: Step[]; criteria: Criterion[] };
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
  kind: "user" | "init" | "text" | "tool" | "tool_result" | "result" | "error" | "status" | "raw";
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
  claude: { name: "Claude Code", color: "#e8875b", mark: "C" },
  codex: { name: "Codex", color: "#9ae6b4", mark: "X" },
  gemini: { name: "Gemini CLI", color: "#7aa2ff", mark: "G" },
  opencode: { name: "opencode", color: "#f5d76e", mark: "O" },
};
export const base = (p: string) => p.replace(/\/+$/, "").split("/").pop() || p;
