<script lang="ts">
  // Every session on every device — terminal, Remote Control and headless Claude Code sessions, and the ones
  // Foreman started — filtered and searched on the left, the open one on the right.
  import { app } from "$lib/app.svelte";
  import { ago, base, type SessionItem } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";
  import SessionDetail from "./SessionDetail.svelte";

  let { device, id, source }: { device?: string; id?: string; source?: "fm" | "claude" } = $props();
  let filter = $state<"all" | "live" | "terminal" | "foreman" | "headless">("all");
  let q = $state("");

  const filters = [
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "terminal", label: "Terminal" },
    { id: "foreman", label: "Foreman" },
    { id: "headless", label: "Headless" },
  ] as const;

  const rows = $derived(
    app.sessions.filter((s) => {
      if (filter === "live" && !s.live) return false;
      if (filter === "terminal" && !(s.source === "claude" && (s.kind === "terminal" || s.kind === "remote"))) return false;
      if (filter === "foreman" && s.source !== "fm") return false;
      if (filter === "headless" && s.kind !== "headless") return false;
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      return words.every((w) => `${s.title} ${s.cwd} ${s.last} ${s.agent} ${s.kind}`.toLowerCase().includes(w));
    }),
  );
  const sel = $derived(
    app.sessions.find((s) => s.id === id && s.device === device && (!source || s.source === source)) ?? null,
  );
  const open = (s: SessionItem) => (app.view = { kind: "sessions", device: s.device, id: s.id, source: s.source });
</script>

<div class="wrap">
  <div class="list">
    <div class="lhead">
      <h1>Sessions</h1>
      <span class="grow"></span>
      <button class="btn icon" title="New session (Ctrl N)" onclick={() => (app.newSession = {})}><Icon name="plus" size={14} /></button>
    </div>
    <div class="find">
      <Icon name="search" size={13} />
      <input placeholder="Search sessions" bind:value={q} />
    </div>
    <div class="filters">
      {#each filters as f}
        <button class:on={filter === f.id} onclick={() => (filter = f.id)}>{f.label}</button>
      {/each}
    </div>
    <div class="rows">
      {#each rows as s (s.key)}
        <button class="row" class:on={sel?.key === s.key} onclick={() => open(s)}>
          <Bits kind="agent" agent={s.agent} />
          <div class="main">
            <div class="ellipsis rtitle">{s.title}</div>
            <div class="ellipsis t3 small">{base(s.cwd) || "?"} · {s.kind}{app.devices.length > 1 ? ` · ${app.device(s.device)?.name}` : ""}</div>
          </div>
          <div class="side">
            {#if s.live}<Bits kind="dot" status="live" />{:else}<span class="t3 small">{ago(s.updated)}</span>{/if}
            {#if s.subagents}<span class="t3 small" title="subagents"><Icon name="users" size={11} /> {s.subagents}</span>{/if}
          </div>
        </button>
      {:else}
        <div class="empty">{app.sessions.length ? "Nothing matches." : "No sessions on any device yet."}</div>
      {/each}
    </div>
  </div>

  <div class="pane">
    {#if sel}
      {#key sel.key}<SessionDetail s={sel} />{/key}
    {:else}
      <div class="placeholder">
        <Icon name="message" size={22} />
        <div>Pick a session to read it, browse its files and pictures, or message it.</div>
        <div class="t3 small">Claude Code sessions from every device show up here — terminal, Remote Control and headless — next to the ones Foreman started.</div>
        <button class="btn primary" onclick={() => (app.newSession = {})}><Icon name="plus" size={13} /> New session</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .wrap {
    display: grid;
    grid-template-columns: 330px minmax(0, 1fr);
    height: 100%;
  }
  .list {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--line);
    background: var(--bg-raised);
  }
  .lhead {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 12px 0 16px;
    border-bottom: 1px solid var(--line);
  }
  .lhead h1 {
    font-size: 15px;
  }
  .grow {
    flex: 1;
  }
  .find {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 10px 12px 8px;
    height: 30px;
    padding: 0 9px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line-2);
    background: var(--bg);
    color: var(--text-3);
  }
  .find input {
    flex: 1;
    border: 0;
    outline: none;
    background: none;
  }
  .filters {
    display: flex;
    gap: 2px;
    padding: 0 10px 8px;
    border-bottom: 1px solid var(--line);
  }
  .filters button {
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: 5px;
    background: none;
    color: var(--text-2);
    font-size: 12px;
  }
  .filters button:hover {
    color: var(--text);
  }
  .filters button.on {
    background: var(--surface-2);
    color: var(--text);
  }
  .rows {
    flex: 1;
    overflow: auto;
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    text-align: left;
    color: var(--text);
  }
  .row:hover {
    background: var(--surface);
  }
  .row.on {
    background: var(--surface-2);
    box-shadow: inset 2px 0 0 var(--accent);
  }
  .main {
    flex: 1;
    min-width: 0;
  }
  .rtitle {
    font-weight: 500;
  }
  .small {
    font-size: 11.5px;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }
  .pane {
    min-width: 0;
    min-height: 0;
  }
  .placeholder {
    height: 100%;
    max-width: 440px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
    color: var(--text-2);
  }
</style>
