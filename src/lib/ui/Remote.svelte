<script lang="ts">
  // Claude Code Remote Control, per device: the fm serve units (claude remote-control under systemd) that let you
  // drive a project from claude.ai/code or the Claude app. Start one for any project, stop it, see why one died.
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import { fm } from "$lib/fm";
  import { base, type ServeUnit } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  let units = $state<Record<string, ServeUnit[] | string | null>>({});
  let picking = $state<string | null>(null);
  let choice = $state("");
  let busy = $state(false);

  async function load() {
    for (const d of app.devices) {
      units[d.id] = null;
      fm<{ units: ServeUnit[] }>(d, ["serve", "status", "--json"])
        .then((o) => (units[d.id] = o.units))
        .catch((e) => (units[d.id] = String(e)));
    }
  }
  onMount(load);

  async function start(device: string) {
    if (!choice) return;
    busy = true;
    const ok = await app.act(device, ["serve", "start", choice], `Remote Control is starting for ${base(choice)}`);
    busy = false;
    if (ok) {
      picking = null;
      load();
    }
  }
  async function stop(device: string, u: ServeUnit) {
    if (await app.act(device, ["-p", u.project, "serve", "stop"], `Stopped Remote Control for ${base(u.root ?? u.project)}`)) load();
  }
</script>

<div class="page">
  <div class="pagehead">
    <Icon name="radio" size={15} />
    <h1>Remote control</h1>
    <span class="t3 small">Claude Code Remote Control units, reachable from claude.ai/code and the Claude app</span>
    <span class="grow"></span>
    <button class="btn" onclick={load}><Icon name="refresh" size={13} /> Refresh</button>
  </div>
  <div class="body">
    <p class="t2 intro">Each unit runs <span class="mono">claude remote-control</span> in a project as a systemd user service, survives
      logout and reboot, and switches that project to full autonomy with drive on until it's stopped. Its sessions also
      appear under Sessions. Open them from claude.ai/code or the Claude app.</p>
    {#each app.devices as d (d.id)}
      {@const u = units[d.id]}
      {@const st = app.st(d.id)}
      <section class="panel">
        <div class="dhead">
          <Bits kind="dot" status={st.status} />
          <span class="strong">{d.name}</span>
          <span class="grow"></span>
          <button class="btn" onclick={() => ((picking = picking === d.id ? null : d.id), (choice = st.projects[0]?.root ?? ""))}>
            <Icon name="plus" size={13} /> Serve a project</button>
        </div>
        {#if picking === d.id}
          <div class="pick" transition:slide={{ duration: 140 }}>
            <select class="input" bind:value={choice}>
              {#each st.projects as p}<option value={p.root}>{base(p.root)} — {p.root}</option>{/each}
            </select>
            <button class="btn primary" disabled={!choice || busy} onclick={() => start(d.id)}>Start</button>
            <span class="t3 small">The project switches to full autonomy with drive on while it's served.</span>
          </div>
        {/if}
        {#if u === null || u === undefined}
          <div class="empty">Loading…</div>
        {:else if typeof u === "string"}
          <div class="empty bad">{u}</div>
        {:else if !u.length}
          <div class="empty">No Remote Control units on {d.name}.</div>
        {:else}
          {#each u as unit (unit.unit)}
            <div class="unit">
              <Bits kind="dot" status={unit.state === "active" ? "live" : unit.state} />
              <div class="umain">
                <div class="strong">{base(unit.root ?? unit.project)}</div>
                <div class="t3 small mono ellipsis">{unit.root} · {unit.unit}</div>
                {#each unit.log as l}<div class="log mono small">{l}</div>{/each}
              </div>
              <span class="t3 small">{unit.state}{unit.active ? ` · ${unit.active}` : ""} · queue {unit.queue}</span>
              <button class="btn" onclick={() => stop(d.id, unit)}><Icon name="stop" size={12} /> Stop</button>
            </div>
          {/each}
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .grow {
    flex: 1;
  }
  .small {
    font-size: 12px;
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 16px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 1000px;
  }
  .intro {
    margin: 0;
    line-height: 1.6;
  }
  .dhead {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  .strong {
    font-weight: 500;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  .pick select {
    min-width: 260px;
  }
  .unit {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  .unit:last-child {
    border-bottom: 0;
  }
  .umain {
    flex: 1;
    min-width: 0;
  }
  .log {
    color: var(--warn);
  }
  .bad {
    color: var(--bad);
  }
</style>
