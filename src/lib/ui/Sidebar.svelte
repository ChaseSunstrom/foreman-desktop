<script lang="ts">
  import { flip } from "svelte/animate";
  import { fade, slide } from "svelte/transition";
  import { app, type View } from "$lib/app.svelte";
  import { base, TYPE_COLOR } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  const nav: { kind: View["kind"]; label: string; icon: string }[] = [
    { kind: "home", label: "Overview", icon: "home" },
    { kind: "sessions", label: "Sessions", icon: "terminal" },
    { kind: "agents", label: "Agents", icon: "cpu" },
    { kind: "devices", label: "Devices", icon: "server" },
  ];
  let collapsed = $state<Record<string, boolean>>({});
  const isProject = (d: string, slug: string) =>
    app.view.kind === "project" && app.view.device === d && app.view.slug === slug;
</script>

<aside>
  <div class="brand">
    <div class="mark"><span>F</span></div>
    <div>
      <div class="name">Foreman</div>
      <div class="sub">{app.devices.length} device{app.devices.length === 1 ? "" : "s"} · {app.running} running</div>
    </div>
  </div>

  <nav>
    {#each nav as n}
      <button class="nav" class:active={app.view.kind === n.kind} onclick={() => (app.view = { kind: n.kind } as View)}>
        <Icon name={n.icon} />
        <span>{n.label}</span>
        {#if n.kind === "sessions" && app.running}
          <span class="badge live" transition:fade>{app.running}</span>
        {:else if n.kind === "home" && app.waiting}
          <span class="badge warn" transition:fade>{app.waiting}</span>
        {/if}
      </button>
    {/each}
  </nav>

  <div class="scroll">
    {#each app.devices as d (d.id)}
      {@const st = app.st(d.id)}
      <div class="dev">
        <button class="dev-head" onclick={() => (collapsed[d.id] = !collapsed[d.id])}>
          <Bits kind="dot" status={st.status} />
          <span class="dev-name">{d.name}</span>
          <span class="count">{st.projects.length}</span>
          <span class="chev" class:open={!collapsed[d.id]}><Icon name="chevron" size={13} /></span>
        </button>
        {#if !collapsed[d.id]}
          <div transition:slide={{ duration: 220 }}>
            {#if st.status === "connecting" && !st.projects.length}
              {#each [0, 1, 2] as i}
                <div class="sk shimmer" style="width: {70 - i * 12}%"></div>
              {/each}
            {:else if st.status === "offline" && !st.projects.length}
              <div class="err" title={st.error}>Can't reach it · {st.error?.slice(0, 60)}</div>
            {/if}
            {#each st.projects as p (p.project)}
              <button class="proj" class:active={isProject(d.id, p.project)} animate:flip={{ duration: 300 }}
                onclick={() => (app.view = { kind: "project", device: d.id, slug: p.project })}>
                <span class="pdot" style="background: {p.active ? TYPE_COLOR[p.active.type] ?? 'var(--accent)' : 'var(--faint)'}"></span>
                <span class="pname">{base(p.root)}</span>
                {#if p.waits}<span class="badge warn small">!</span>{/if}
                {#if p.inbox}<span class="mini">{p.inbox}</span>{/if}
                {#if p.active}
                  <Bits kind="ring" size={16} value={p.active.steps_total ? p.active.steps_done / p.active.steps_total : 0}
                    running={p.active.stage === "executing"} />
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <button class="new" onclick={() => (app.newSession = {})}>
    <Icon name="sparkles" />
    New session
  </button>
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 12px 14px;
    border-right: 1px solid var(--line);
    background: linear-gradient(180deg, rgba(13, 13, 24, 0.85), rgba(7, 7, 13, 0.6));
    min-height: 0;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 6px 4px;
  }
  .mark {
    width: 34px;
    height: 34px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    position: relative;
    background: #11111d;
    font-weight: 800;
    font-size: 17px;
    isolation: isolate;
  }
  .mark::before {
    content: "";
    position: absolute;
    inset: -1.5px;
    border-radius: 12px;
    background: conic-gradient(from var(--angle), #8d7dff, #40d8f6, #ec4899, #8d7dff);
    animation: spin-angle 6s linear infinite;
    z-index: -1;
  }
  .mark::after {
    content: "";
    position: absolute;
    inset: 1px;
    border-radius: 10px;
    background: #10101b;
    z-index: -1;
  }
  .mark span {
    background: var(--grad);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .name {
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.01em;
  }
  .sub {
    font-size: 11.5px;
    color: var(--faint);
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 0;
    background: none;
    color: var(--dim);
    text-align: left;
    transition: background 0.2s, color 0.2s;
  }
  .nav:hover {
    background: var(--panel);
    color: var(--text);
  }
  .nav.active {
    background: var(--grad-soft);
    color: var(--text);
    box-shadow: inset 0 0 0 1px rgba(141, 125, 255, 0.25);
  }
  .badge {
    margin-left: auto;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 99px;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
  }
  .badge.live {
    background: rgba(64, 216, 246, 0.16);
    color: var(--accent-2);
  }
  .badge.warn {
    background: rgba(251, 191, 36, 0.16);
    color: var(--warn);
  }
  .badge.small {
    margin-left: 0;
    min-width: 16px;
    height: 16px;
    font-size: 10px;
  }
  .scroll {
    flex: 1;
    overflow: auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 -4px;
    padding: 0 4px;
  }
  .dev-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 8px;
    border: 0;
    background: none;
    color: var(--dim);
    font-size: 11.5px;
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .dev-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    color: var(--faint);
    font-weight: 500;
  }
  .chev {
    margin-left: auto;
    transition: transform 0.25s var(--ease);
  }
  .chev.open {
    transform: rotate(90deg);
  }
  .proj {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 10px 6px 14px;
    border: 0;
    border-radius: 9px;
    background: none;
    color: var(--dim);
    text-align: left;
    transition: background 0.18s, color 0.18s, transform 0.18s var(--ease);
  }
  .proj:hover {
    background: var(--panel);
    color: var(--text);
    transform: translateX(2px);
  }
  .proj.active {
    background: var(--panel-2);
    color: var(--text);
  }
  .pdot {
    width: 7px;
    height: 7px;
    border-radius: 2px;
    flex: none;
  }
  .pname {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mini {
    font-size: 11px;
    color: var(--faint);
  }
  .sk {
    height: 12px;
    margin: 9px 14px;
  }
  .err {
    font-size: 12px;
    color: var(--bad);
    padding: 4px 14px;
    opacity: 0.85;
  }
  .new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px;
    border: 0;
    border-radius: 12px;
    background: var(--grad);
    color: #0b0b14;
    font-weight: 700;
    box-shadow: 0 10px 30px -10px rgba(141, 125, 255, 0.7);
    transition: transform 0.2s var(--spring), box-shadow 0.2s;
  }
  .new:hover {
    transform: translateY(-1px) scale(1.01);
    box-shadow: 0 14px 34px -10px rgba(64, 216, 246, 0.7);
  }
  .new:active {
    transform: scale(0.98);
  }
</style>
