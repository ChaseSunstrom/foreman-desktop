<script lang="ts">
  // Ctrl+K: jump to any project, session or page, or run an action, on any device.
  import { fade, fly } from "svelte/transition";
  import { app, type View } from "$lib/app.svelte";
  import { base } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  type Hit = { group: string; label: string; hint: string; icon: string; agent?: string; run: () => void };
  let q = $state("");
  let sel = $state(0);
  let input: HTMLInputElement | undefined = $state();
  $effect(() => input?.focus());

  const go = (v: View) => () => (app.view = v);
  const all = $derived.by((): Hit[] => {
    const hits: Hit[] = [
      { group: "Actions", label: "New session", hint: "Ctrl N", icon: "plus", run: () => (app.newSession = {}) },
      { group: "Pages", label: "Home", hint: "", icon: "home", run: go({ kind: "home" }) },
      { group: "Pages", label: "Sessions", hint: "", icon: "message", run: go({ kind: "sessions" }) },
      { group: "Pages", label: "Remote control", hint: "", icon: "radio", run: go({ kind: "remote" }) },
      { group: "Pages", label: "Agents", hint: "", icon: "cpu", run: go({ kind: "agents" }) },
      { group: "Pages", label: "Devices", hint: "", icon: "server", run: go({ kind: "devices" }) },
    ];
    for (const d of app.devices)
      for (const p of app.st(d.id).projects) {
        hits.push({ group: "Projects", label: base(p.root), hint: `${p.active ? p.active.id + " · " : ""}${d.name}`,
          icon: "folder", run: go({ kind: "project", device: d.id, slug: p.project }) });
        for (const tab of ["queue", "inbox"])
          hits.push({ group: "Projects", label: `${base(p.root)} ${tab}`, hint: `${tab === "queue" ? p.queue : p.inbox} items`,
            icon: tab === "queue" ? "list" : "inbox", run: go({ kind: "project", device: d.id, slug: p.project, tab }) });
      }
    for (const s of app.sessions.slice(0, 300))
      hits.push({ group: "Sessions", label: s.title, hint: `${base(s.cwd)} · ${app.device(s.device)?.name ?? ""}${s.live ? " · live" : ""}`,
        icon: "message", agent: s.agent, run: go({ kind: "sessions", device: s.device, id: s.id, source: s.source }) });
    return hits;
  });
  const shown = $derived.by(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = words.length ? all.filter((h) => words.every((w) => `${h.label} ${h.hint} ${h.group}`.toLowerCase().includes(w))) : all.filter((h) => h.group !== "Sessions").slice(0, 14);
    return hits.slice(0, 60);
  });
  $effect(() => {
    q;
    sel = 0;
  });
  const close = () => (app.palette = false);
  function key(e: KeyboardEvent) {
    if (e.key === "ArrowDown") (sel = Math.min(sel + 1, shown.length - 1)), e.preventDefault();
    else if (e.key === "ArrowUp") (sel = Math.max(sel - 1, 0)), e.preventDefault();
    else if (e.key === "Enter" && shown[sel]) (shown[sel].run(), close());
    else if (e.key === "Escape") close();
  }
  function scrollIntoView(node: HTMLElement, on: boolean) {
    $effect(() => {
      if (on) node.scrollIntoView({ block: "nearest" });
    });
  }
</script>

<div class="scrim" transition:fade={{ duration: 100 }} onclick={close} role="presentation"></div>
<div class="pal panel" transition:fly={{ y: -8, duration: 140 }}>
  <div class="q">
    <Icon name="search" size={15} />
    <input bind:this={input} bind:value={q} onkeydown={key} placeholder="Projects, sessions, pages, actions…" />
    <span class="kbd">Esc</span>
  </div>
  <div class="list">
    {#each shown as h, i}
      {#if i === 0 || shown[i - 1].group !== h.group}<div class="label grp">{h.group}</div>{/if}
      <button class="hit" class:on={i === sel} onmouseenter={() => (sel = i)} onclick={() => (h.run(), close())}
        use:scrollIntoView={i === sel}>
        {#if h.agent}<Bits kind="agent" agent={h.agent} size={18} />{:else}<span class="ic"><Icon name={h.icon} size={14} /></span>{/if}
        <span class="ellipsis lbl">{h.label}</span>
        <span class="t3 ellipsis hint">{h.hint}</span>
      </button>
    {:else}
      <div class="empty">Nothing matches “{q}”.</div>
    {/each}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.45);
  }
  .pal {
    position: fixed;
    z-index: 51;
    top: 12vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(620px, 92vw);
    background: var(--surface);
    border-color: var(--line-2);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .q {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    height: 46px;
    border-bottom: 1px solid var(--line);
    color: var(--text-3);
  }
  .q input {
    flex: 1;
    border: 0;
    outline: none;
    background: none;
    font-size: 14px;
    color: var(--text);
  }
  .list {
    max-height: 56vh;
    overflow: auto;
    padding: 6px;
  }
  .grp {
    padding: 8px 8px 4px;
  }
  .hit {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    text-align: left;
    color: var(--text-2);
  }
  .hit.on {
    background: var(--hover);
    color: var(--text);
  }
  .ic {
    width: 18px;
    display: grid;
    place-items: center;
    color: var(--text-3);
  }
  .lbl {
    flex: 1;
  }
  .hint {
    max-width: 45%;
    font-size: 12px;
  }
</style>
