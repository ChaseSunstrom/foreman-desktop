<script lang="ts">
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { app } from "$lib/app.svelte";
  import { ago, base } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  const projects = $derived(
    app.devices.flatMap((d) => app.st(d.id).projects.map((p) => ({ ...p, device: d.id, deviceName: d.name }))),
  );
  const active = $derived(projects.filter((p) => p.active).sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)));
  const waiting = $derived(projects.filter((p) => p.waits > 0));
  const liveSessions = $derived(app.sessions.filter((s) => s.live));
  const recent = $derived(app.sessions.filter((s) => !s.live).slice(0, 8));
  const open = (device: string, slug: string, tab?: string) => (app.view = { kind: "project", device, slug, tab });
</script>

<div class="page">
  <div class="pagehead">
    <h1>Home</h1>
    <span class="t3 summary">
      {active.length} in progress · {liveSessions.length} live session{liveSessions.length === 1 ? "" : "s"}
      {#if waiting.length}· <span class="warn">{app.waiting} waiting on you</span>{/if}
    </span>
  </div>

  <div class="body">
    <div class="col">
      {#if waiting.length}
        <section in:fade>
          <div class="label">Waiting on you</div>
          <div class="panel rows">
            {#each waiting as p (p.device + p.project)}
              <button class="row" onclick={() => open(p.device, p.project, "inbox")}>
                <Icon name="alert" size={14} />
                <span class="strong">{base(p.root)}</span>
                <span class="t3">{p.waits} item{p.waits === 1 ? "" : "s"} need a yes</span>
                <span class="t3 right">{p.deviceName}</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <section>
        <div class="label">In progress</div>
        <div class="panel rows">
          {#each active as p (p.device + p.project)}
            {@const a = p.active!}
            <button class="row task" animate:flip={{ duration: 200 }} onclick={() => open(p.device, p.project)}>
              <div class="tmain">
                <div class="tline">
                  <Bits kind="type" type={a.type} tier={a.tier} />
                  <span class="mono t3">{a.id}</span>
                  <span class="ellipsis strong">{a.title}</span>
                </div>
                <div class="tline t3 small">
                  <span>{base(p.root)} · {p.deviceName}</span>
                  <span class="stage">{a.stage}</span>
                  <span>{a.steps_done}/{a.steps_total} steps</span>
                  {#if p.inbox}<span>{p.inbox} in inbox</span>{/if}
                </div>
              </div>
              <div class="tbar"><Bits kind="bar" value={a.steps_total ? a.steps_done / a.steps_total : 0} /></div>
            </button>
          {:else}
            <div class="empty">No task is active on any device.</div>
          {/each}
        </div>
      </section>
    </div>

    <div class="col">
      <section>
        <div class="label">Live sessions</div>
        <div class="panel rows">
          {#each liveSessions as s (s.key)}
            {@render sessionRow(s)}
          {:else}
            <div class="empty">Nothing running. <button class="btn ghost" onclick={() => (app.newSession = {})}>Start a session</button></div>
          {/each}
        </div>
      </section>
      <section>
        <div class="label">Recent sessions</div>
        <div class="panel rows">
          {#each recent as s (s.key)}
            {@render sessionRow(s)}
          {:else}
            <div class="empty">No sessions yet.</div>
          {/each}
        </div>
      </section>
      <section>
        <div class="label">Devices</div>
        <div class="panel rows">
          {#each app.devices as d (d.id)}
            {@const st = app.st(d.id)}
            <button class="row" onclick={() => (app.view = { kind: "devices" })}>
              <Bits kind="dot" status={st.status} />
              <span class="strong">{d.name}</span>
              <span class="t3">{st.projects.length} projects · {st.claude.filter((c) => c.live).length + st.sessions.filter((x) => x.status === "running").length} live</span>
              <span class="t3 right">{st.status === "offline" ? "unreachable" : d.host ?? "this machine"}</span>
            </button>
          {/each}
        </div>
      </section>
    </div>
  </div>
</div>

{#snippet sessionRow(s: (typeof app.sessions)[number])}
  <button class="row" onclick={() => (app.view = { kind: "sessions", device: s.device, id: s.id, source: s.source })}>
    <Bits kind="agent" agent={s.agent} />
    <div class="smain">
      <div class="ellipsis strong">{s.title}</div>
      <div class="ellipsis t3 small">{base(s.cwd)} · {s.kind}{s.subagents ? ` · ${s.subagents} subagents` : ""}</div>
    </div>
    {#if s.live}<Bits kind="dot" status="live" />{:else}<span class="t3 small">{ago(s.updated)}</span>{/if}
  </button>
{/snippet}

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .summary {
    font-size: 12.5px;
  }
  .warn {
    color: var(--warn);
  }
  .body {
    flex: 1;
    overflow: auto;
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 20px;
    padding: 20px;
    align-content: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rows {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 8px 12px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    text-align: left;
    color: var(--text-2);
  }
  .row:last-child {
    border-bottom: 0;
  }
  .row:hover {
    background: var(--surface);
  }
  .strong {
    color: var(--text);
    font-weight: 500;
  }
  .right {
    margin-left: auto;
    font-size: 12px;
  }
  .small {
    font-size: 11.5px;
  }
  .task {
    align-items: stretch;
  }
  .tmain,
  .smain {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .tline {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .tline .mono {
    flex: none;
    white-space: nowrap;
  }
  .stage {
    color: var(--accent);
  }
  .tbar {
    width: 90px;
    flex: none;
    align-self: center;
  }
</style>
