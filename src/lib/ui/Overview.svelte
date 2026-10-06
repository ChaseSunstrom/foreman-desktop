<script lang="ts">
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { Tween } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { app } from "$lib/app.svelte";
  import { AGENT, base } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  const hour = new Date().getHours();
  const hello = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const projects = $derived(
    app.devices.flatMap((d) => app.st(d.id).projects.map((p) => ({ ...p, device: d.id, deviceName: d.name }))),
  );
  const active = $derived(
    projects.filter((p) => p.active).sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)),
  );
  const online = $derived(app.devices.filter((d) => app.st(d.id).status === "online").length);
  const sessions = $derived(
    [...app.allSessions].sort((a, b) => (b.updated > a.updated ? 1 : -1)).slice(0, 6),
  );

  const stats = $derived([
    { label: "Devices online", value: online, of: app.devices.length, icon: "server" },
    { label: "Projects", value: projects.length, icon: "folder" },
    { label: "Sessions running", value: app.running, icon: "terminal" },
    { label: "Waiting on you", value: app.waiting, icon: "alert", warn: app.waiting > 0 },
  ]);
  const tweens = [0, 1, 2, 3].map(() => new Tween(0, { duration: 900, easing: cubicOut }));
  $effect(() => stats.forEach((s, i) => (tweens[i].target = s.value)));
</script>

<div class="page">
  <header in:fly={{ y: 10, duration: 500 }}>
    <h1>{hello}<span class="grad-text">.</span></h1>
    <p class="dim">Everything Foreman is doing, on every device.</p>
  </header>

  <div class="stats">
    {#each stats as s, i}
      <div class="card stat" class:warn={s.warn} in:fly={{ y: 14, delay: 60 * i, duration: 500 }}>
        <div class="stat-icon"><Icon name={s.icon} size={18} /></div>
        <div class="stat-value">
          {Math.round(tweens[i].current)}{#if s.of !== undefined}<span class="of">/{s.of}</span>{/if}
        </div>
        <div class="stat-label">{s.label}</div>
      </div>
    {/each}
  </div>

  <section>
    <div class="card-title"><Icon name="zap" size={14} /> Active work</div>
    {#if !active.length}
      <div class="empty card">No task is active on any device. Start one from a project's queue or inbox.</div>
    {/if}
    <div class="grid">
      {#each active as p, i (p.device + p.project)}
        <button class="card work" animate:flip={{ duration: 350 }} in:fly={{ y: 16, delay: 40 * i, duration: 450 }}
          onclick={() => (app.view = { kind: "project", device: p.device, slug: p.project })}>
          <div class="work-top">
            <Bits kind="type" type={p.active!.type} tier={p.active!.tier} />
            <span class="faint mono">{p.active!.id}</span>
            <span class="where">{base(p.root)} · {p.deviceName}</span>
          </div>
          <div class="work-title">{p.active!.title}</div>
          <div class="work-foot">
            <span class="stage">{p.active!.stage}</span>
            <span class="faint">{p.active!.steps_done}/{p.active!.steps_total} steps</span>
            {#if p.waits}<span class="needs"><Icon name="alert" size={12} /> needs you</span>{/if}
          </div>
          <Bits kind="bar" value={p.active!.steps_total ? p.active!.steps_done / p.active!.steps_total : 0} height={4} />
        </button>
      {/each}
    </div>
  </section>

  <section>
    <div class="card-title"><Icon name="terminal" size={14} /> Recent sessions</div>
    {#if !sessions.length}
      <div class="empty card">No agent sessions yet. <button class="link" onclick={() => (app.newSession = {})}>Start one</button></div>
    {/if}
    <div class="rows">
      {#each sessions as s, i (s.device + s.id)}
        <button class="card row" class:running-ring={s.status === "running"} in:fly={{ x: -10, delay: 40 * i }}
          onclick={() => (app.view = { kind: "sessions", device: s.device, id: s.id })}>
          <span class="agent" style="--c: {AGENT[s.agent]?.color}">{AGENT[s.agent]?.mark ?? "?"}</span>
          <span class="row-title">{s.title}</span>
          <span class="faint row-last">{s.last?.text ?? ""}</span>
          <Bits kind="dot" status={s.status} />
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .page {
    padding: 34px 40px 40px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    max-width: 1280px;
  }
  h1 {
    margin: 0;
    font-size: 34px;
    letter-spacing: -0.03em;
    font-weight: 750;
  }
  header p {
    margin: 6px 0 0;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
  .stat {
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
  }
  .stat::after {
    content: "";
    position: absolute;
    right: -30px;
    top: -30px;
    width: 110px;
    height: 110px;
    background: radial-gradient(closest-side, rgba(141, 125, 255, 0.18), transparent);
  }
  .stat.warn::after {
    background: radial-gradient(closest-side, rgba(251, 191, 36, 0.22), transparent);
  }
  .stat-icon {
    color: var(--dim);
  }
  .stat-value {
    font-size: 30px;
    font-weight: 750;
    letter-spacing: -0.03em;
    margin-top: 6px;
    font-variant-numeric: tabular-nums;
  }
  .of {
    font-size: 16px;
    color: var(--faint);
    font-weight: 500;
  }
  .stat-label {
    color: var(--dim);
    font-size: 12.5px;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 14px;
  }
  .work {
    text-align: left;
    padding: 16px 18px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: inherit;
    transition: transform 0.25s var(--ease), border-color 0.25s, background 0.25s;
  }
  .work:hover {
    transform: translateY(-3px);
    border-color: var(--line-2);
    background: var(--panel-2);
  }
  .work-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .where {
    margin-left: auto;
    font-size: 12px;
    color: var(--faint);
  }
  .work-title {
    font-weight: 600;
    font-size: 15px;
    line-height: 1.35;
  }
  .work-foot {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 12.5px;
  }
  .stage {
    text-transform: capitalize;
    color: var(--accent-2);
  }
  .needs {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--warn);
    margin-left: auto;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    color: inherit;
    text-align: left;
    transition: background 0.2s, transform 0.2s var(--ease);
  }
  .row:hover {
    background: var(--panel-2);
    transform: translateX(3px);
  }
  .agent {
    width: 26px;
    height: 26px;
    flex: none;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 12px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
  }
  .row-title {
    font-weight: 550;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 40%;
  }
  .row-last {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12.5px;
  }
  .empty {
    padding: 18px;
    color: var(--dim);
  }
  .link {
    background: none;
    border: 0;
    color: var(--accent-2);
    padding: 0;
  }
</style>
