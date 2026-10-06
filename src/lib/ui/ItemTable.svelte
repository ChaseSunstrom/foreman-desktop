<script lang="ts">
  // Every item of one list (queue, inbox or blocked), with search, type filters and the full brief beside it.
  import { fly } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import { fm } from "$lib/fm";
  import { ago, TIER_WORD, type StateItem } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";
  import Markdown from "./Markdown.svelte";

  let { items, kind, device, slug, waits = {}, capture = false }: {
    items: StateItem[];
    kind: "queue" | "inbox" | "blocked";
    device: string;
    slug: string;
    waits?: Record<string, string | null | undefined>;
    capture?: boolean;
  } = $props();

  let q = $state("");
  let types = $state<Record<string, boolean>>({});
  let open = $state<string | null>(null);
  let brief = $state<string | null>(null);
  let busy = $state<Record<string, boolean>>({});
  let draft = $state("");

  const allTypes = $derived([...new Set(items.map((i) => i.type))].sort());
  const shown = $derived(
    items.filter((i) => {
      if (Object.values(types).some(Boolean) && !types[i.type]) return false;
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      return words.every((w) => `${i.id} ${i.title} ${i.type} ${i.source ?? ""} ${i.reason ?? ""}`.toLowerCase().includes(w));
    }),
  );

  async function show(id: string) {
    if (open === id) return void (open = null);
    open = id;
    brief = null;
    const d = app.device(device);
    if (!d) return;
    try {
      brief = String(await fm(d, ["-p", slug, "task", "show", id]));
    } catch (e) {
      brief = `Couldn't read the brief: ${e}`;
    }
  }
  async function act(key: string, args: string[], done: string) {
    busy[key] = true;
    await app.act(device, ["-p", slug, ...args], done);
    busy[key] = false;
  }
  async function add(e: Event) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    draft = "";
    await act("capture", ["capture", "--json", "--", text], "Captured to the inbox");
  }
  const age = (i: StateItem) => (i.created ? ago(Date.parse(i.created)) : "");
</script>

<div class="wrap">
  <div class="main">
    <div class="tools">
      <div class="find">
        <Icon name="search" size={13} />
        <input class="bare" placeholder="Filter {items.length} items" bind:value={q} />
      </div>
      {#each allTypes as t}
        <button class="chipbtn" class:on={types[t]} onclick={() => (types[t] = !types[t])}><Bits kind="type" type={t} /></button>
      {/each}
      <span class="t3 count">{shown.length} shown</span>
    </div>
    {#if capture}
      <form class="cap" onsubmit={add}>
        <input class="input" placeholder="Capture an idea, a bug, a request… (Enter)" bind:value={draft} />
      </form>
    {/if}
    <div class="table">
      {#each shown as i (i.id)}
        <button class="tr" class:on={open === i.id} onclick={() => show(i.id)}>
          <span class="mono t3 id">{i.id}</span>
          <Bits kind="type" type={i.type} />
          <span class="title">{i.title}</span>
          <span class="meta t3">
            {#if waits[i.id]}<span class="wait">{waits[i.id]}</span>{/if}
            {#if kind === "blocked" && i.reason}<span class="ellipsis reason" title={i.reason}>{i.reason}</span>{/if}
            {#if i.steps_total}<span class="steps">{i.steps_done}/{i.steps_total}</span>{/if}
            <span class="tier">{TIER_WORD[i.tier] ?? i.tier}</span>
            <span class="age">{age(i)}</span>
          </span>
        </button>
      {:else}
        <div class="empty">{items.length ? "Nothing matches the filter." : kind === "inbox" ? "The inbox is empty." : kind === "queue" ? "Nothing queued." : "Nothing blocked."}</div>
      {/each}
    </div>
  </div>

  {#if open}
    {@const it = items.find((i) => i.id === open)}
    <aside class="drawer" transition:fly={{ x: 16, duration: 160 }}>
      <div class="dhead">
        <span class="mono t3">{open}</span>
        <span class="grow"></span>
        {#if waits[open] === "plan approval"}
          <button class="btn primary" disabled={busy[`a${open}`]}
            onclick={() => act(`a${open}`, ["task", "set", open!, "approved=true", "--json"], `${open} approved`)}>
            <Icon name="check" size={13} /> Approve plan</button>
        {/if}
        <button class="btn" disabled={busy[`s${open}`]} onclick={() => act(`s${open}`, ["focus", open!, "--json"], `${open} is now the active task`)}>
          <Icon name="play" size={12} /> Start</button>
        <button class="btn danger" disabled={busy[`d${open}`]}
          onclick={() => act(`d${open}`, ["task", "drop", open!, "dropped from Foreman Desktop", "--json"], `${open} dropped`).then(() => (open = null))}>
          Drop</button>
        <button class="btn icon ghost" aria-label="Close" onclick={() => (open = null)}><Icon name="x" size={14} /></button>
      </div>
      {#if it}<div class="dtitle">{it.title}</div>{/if}
      <div class="dbody">
        {#if brief === null}<div class="t3">Loading the brief…</div>{:else}<Markdown text={brief} />{/if}
      </div>
    </aside>
  {/if}
</div>

<style>
  .wrap {
    display: flex;
    height: 100%;
    min-height: 0;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .find {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line-2);
    background: var(--bg);
    color: var(--text-3);
    width: 240px;
  }
  .bare {
    flex: 1;
    border: 0;
    outline: none;
    background: none;
    min-width: 0;
  }
  .chipbtn {
    border: 1px solid transparent;
    background: none;
    padding: 1px;
    border-radius: 6px;
    opacity: 0.55;
  }
  .chipbtn.on {
    opacity: 1;
    border-color: var(--line-2);
  }
  .chipbtn:hover {
    opacity: 1;
  }
  .count {
    margin-left: auto;
    font-size: 12px;
  }
  .cap {
    padding: 10px 20px;
    border-bottom: 1px solid var(--line);
  }
  .cap .input {
    width: 100%;
  }
  .table {
    flex: 1;
    overflow: auto;
  }
  .tr {
    width: 100%;
    display: grid;
    grid-template-columns: 62px auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 10px;
    padding: 9px 20px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    text-align: left;
    color: var(--text);
  }
  .tr:hover {
    background: var(--surface);
  }
  .tr.on {
    background: var(--surface-2);
  }
  .id {
    padding-top: 1px;
  }
  .title {
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .meta {
    display: flex;
    gap: 10px;
    font-size: 12px;
    white-space: nowrap;
    padding-top: 1px;
  }
  .wait {
    color: var(--warn);
  }
  .reason {
    max-width: 260px;
  }
  .tier {
    width: 48px;
  }
  .age {
    width: 28px;
    text-align: right;
  }
  .drawer {
    width: min(520px, 45%);
    flex: none;
    border-left: 1px solid var(--line);
    background: var(--bg-raised);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .dhead {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  .grow {
    flex: 1;
  }
  .dtitle {
    padding: 12px 16px 0;
    font-weight: 600;
    font-size: 14px;
    line-height: 1.4;
  }
  .dbody {
    flex: 1;
    overflow: auto;
    padding: 12px 16px 20px;
  }
</style>
