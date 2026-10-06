<script lang="ts">
  import { slide } from "svelte/transition";
  import { app, type View } from "$lib/app.svelte";
  import { base } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";
  import Logo from "./Logo.svelte";

  const nav: { kind: View["kind"]; label: string; icon: string }[] = [
    { kind: "home", label: "Home", icon: "home" },
    { kind: "sessions", label: "Sessions", icon: "message" },
    { kind: "remote", label: "Remote control", icon: "radio" },
    { kind: "agents", label: "Agents", icon: "cpu" },
    { kind: "devices", label: "Devices", icon: "server" },
  ];
  let closed = $state<Record<string, boolean>>({});
  const here = (d: string, slug: string) => app.view.kind === "project" && app.view.device === d && app.view.slug === slug;
  const online = $derived(app.devices.filter((d) => app.st(d.id).status === "online").length);
</script>

<aside>
  <div class="brand">
    <Logo size={24} />
    <div class="ellipsis">
      <div class="name">Foreman</div>
      <div class="sub">{online}/{app.devices.length} devices online</div>
    </div>
  </div>

  <button class="search" onclick={() => (app.palette = true)}>
    <Icon name="search" size={14} />
    <span>Search</span>
    <span class="kbd">Ctrl K</span>
  </button>

  <nav>
    {#each nav as n}
      <button class="item" class:on={app.view.kind === n.kind} onclick={() => (app.view = { kind: n.kind } as View)}>
        <Icon name={n.icon} size={15} />
        <span>{n.label}</span>
        {#if n.kind === "sessions" && app.running}<span class="count live">{app.running}</span>
        {:else if n.kind === "home" && app.waiting}<span class="count warn">{app.waiting}</span>{/if}
      </button>
    {/each}
  </nav>

  <div class="label head">Projects</div>
  <div class="projects">
    {#each app.devices as d (d.id)}
      {@const st = app.st(d.id)}
      <button class="dev" onclick={() => (closed[d.id] = !closed[d.id])} title={st.error ?? st.status}>
        <span class="caret" class:open={!closed[d.id]}><Icon name="chevron" size={11} stroke={2.2} /></span>
        <Bits kind="dot" status={st.status} />
        <span class="ellipsis">{d.name}</span>
        <span class="t3 n">{st.projects.length || ""}</span>
      </button>
      {#if !closed[d.id]}
        <div transition:slide={{ duration: 150 }}>
          {#if st.status === "offline" && !st.projects.length}
            <div class="note bad ellipsis" title={st.error}>Unreachable</div>
          {:else if st.status === "connecting" && !st.projects.length}
            <div class="note t3">Connecting…</div>
          {/if}
          {#each st.projects as p (p.project)}
            <button class="item proj" class:on={here(d.id, p.project)}
              onclick={() => (app.view = { kind: "project", device: d.id, slug: p.project })}>
              <span class="ellipsis">{base(p.root)}</span>
              {#if p.waits}<span class="count warn" title="waiting on you">{p.waits}</span>{/if}
              {#if p.active}<span class="mono t3 tid" title={p.active.title}>{p.active.id}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
    {/each}
  </div>

  <button class="btn new" onclick={() => (app.newSession = {})}>
    <Icon name="plus" size={14} /> New session <span class="kbd">Ctrl N</span>
  </button>
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 8px 10px;
    background: var(--bg-raised);
    border-right: 1px solid var(--line);
    min-height: 0;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px 12px;
  }
  .name {
    font-weight: 600;
    font-size: 13.5px;
  }
  .sub {
    font-size: 11.5px;
    color: var(--text-3);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    margin: 0 4px 8px;
    padding: 0 8px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line-2);
    background: var(--bg);
    color: var(--text-3);
    font-size: 12.5px;
  }
  .search:hover {
    border-color: #3c3c44;
    color: var(--text-2);
  }
  .search span:nth-child(2) {
    flex: 1;
    text-align: left;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-bottom: 14px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: var(--text-2);
    text-align: left;
    font-size: 13px;
  }
  .item:hover {
    background: var(--hover);
    color: var(--text);
  }
  .item.on {
    background: var(--surface-2);
    color: var(--text);
  }
  .count {
    margin-left: auto;
    min-width: 18px;
    height: 17px;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    display: grid;
    place-items: center;
  }
  .count.live {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .count.warn {
    color: var(--warn);
    background: rgba(217, 164, 65, 0.12);
  }
  .head {
    padding: 0 8px 6px;
  }
  .projects {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .dev {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 26px;
    padding: 0 6px;
    border: 0;
    background: none;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
    text-align: left;
  }
  .dev:hover {
    color: var(--text);
  }
  .caret {
    display: grid;
    transition: transform 0.15s var(--ease);
    color: var(--text-3);
  }
  .caret.open {
    transform: rotate(90deg);
  }
  .n {
    margin-left: auto;
    font-size: 11px;
  }
  .proj {
    width: 100%;
    padding-left: 30px;
    height: 26px;
  }
  .proj .ellipsis {
    flex: 1;
  }
  .tid {
    font-size: 10.5px;
  }
  .note {
    padding: 2px 30px 6px;
    font-size: 11.5px;
  }
  .note.bad {
    color: var(--bad);
  }
  .new {
    margin: 8px 4px 0;
    justify-content: flex-start;
  }
  .new .kbd {
    margin-left: auto;
  }
</style>
