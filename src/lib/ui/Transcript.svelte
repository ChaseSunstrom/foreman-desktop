<script lang="ts">
  // One session's conversation: what was asked, what the agent said (Markdown), each tool call with its result and
  // any images, newest at the bottom. Claude sessions' images load from the transcript on demand.
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import type { Device } from "$lib/fm";
  import type { Ev } from "$lib/types";
  import { transcriptImage, whenVisible } from "./media";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";
  import Markdown from "./Markdown.svelte";

  let { events, device, sid, agent, source, busy = false, onimage }: {
    events: Ev[];
    device: Device;
    sid: string;
    agent?: string;
    source: "fm" | "claude";
    busy?: boolean;
    onimage?: (src: string) => void;
  } = $props();

  const SHOW = 400;
  let earlier = $state(false);
  let open = $state<Record<string, boolean>>({});
  let scroller = $state<HTMLDivElement>();
  let pinned = true;
  let queued = false;

  const results = $derived(new Map(events.filter((e) => e.kind === "tool_result" && e.id).map((e) => [e.id!, e])));
  const toolImages = $derived.by(() => {
    const m = new Map<string, Ev[]>();
    for (const e of events) if (e.kind === "image" && e.tool_use_id) m.set(e.tool_use_id, [...(m.get(e.tool_use_id) ?? []), e]);
    return m;
  });
  const visible = $derived(
    events.filter((e) => !["init", "raw", "status"].includes(e.kind) && !(e.kind === "tool_result" && e.id) && !(e.kind === "image" && e.tool_use_id)),
  );
  const shown = $derived(earlier ? visible : visible.slice(-SHOW));

  $effect(() => {
    events.length;
    if (!pinned || queued) return;
    queued = true;
    requestAnimationFrame(async () => {
      queued = false;
      await tick();
      scroller?.scrollTo({ top: scroller.scrollHeight });
    });
  });
  const onScroll = () => scroller && (pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80);
  const key = (e: Ev, i: number) => `${e.n ?? ""}:${e.kind}:${e.id ?? ""}:${i}`;
  const time = (ts?: string) => (ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

  function lazyImage(node: HTMLImageElement, ref: string) {
    return whenVisible(node, () => {
      if (source !== "claude") return;
      transcriptImage(device, sid, ref, agent).then((src) => (node.src = src)).catch(() => node.classList.add("broken"));
    });
  }
</script>

<div class="scroll" bind:this={scroller} onscroll={onScroll}>
  <div class="inner">
    {#if !earlier && visible.length > SHOW}
      <button class="btn ghost more" onclick={() => (earlier = true)}>Show {visible.length - SHOW} earlier</button>
    {/if}
    {#each shown as e, i (key(e, i))}
      {#if e.kind === "user"}
        <div class="msg user" class:queued={e.queued}>
          <div class="who t3">You{#if e.queued} · sent while it worked{/if}<span class="when">{time(e.ts)}</span></div>
          <div class="text">{e.text}</div>
        </div>
      {:else if e.kind === "text"}
        <div class="msg agent"><Markdown text={e.text ?? ""} /></div>
      {:else if e.kind === "tool"}
        {@const r = e.id ? results.get(e.id) : undefined}
        {@const imgs = e.id ? toolImages.get(e.id) : undefined}
        {@const k = key(e, i)}
        <div class="tool" class:fail={r && !r.ok}>
          <button class="trow" onclick={() => (open[k] = !open[k])}>
            <span class="st">
              {#if !r}{#if busy}<Bits kind="spinner" size={11} />{:else}<span class="t3">·</span>{/if}
              {:else if r.ok}<Icon name="check" size={12} stroke={2.4} />{:else}<Icon name="x" size={12} stroke={2.4} />{/if}
            </span>
            <span class="tname" class:agentcall={e.tool === "Agent" || e.tool === "Task"}>{e.tool}</span>
            <span class="mono t2 ellipsis detail">{e.detail}</span>
            {#if r?.text}<span class="t3 caret" class:openc={open[k]}><Icon name="chevron" size={11} /></span>{/if}
          </button>
          {#if open[k] && r?.text}<pre class="out" transition:fade={{ duration: 100 }}>{r.text}</pre>{/if}
          {#if imgs}
            <div class="imgs">{#each imgs as im}<button class="imgbtn" onclick={(ev) => onimage?.((ev.currentTarget.firstElementChild as HTMLImageElement).src)}><img alt="tool output" use:lazyImage={im.ref!} /></button>{/each}</div>
          {/if}
        </div>
      {:else if e.kind === "image"}
        <div class="imgs user-img"><button class="imgbtn" onclick={(ev) => onimage?.((ev.currentTarget.firstElementChild as HTMLImageElement).src)}><img alt="attached" use:lazyImage={e.ref!} /></button></div>
      {:else if e.kind === "tool_result"}
        <pre class="out">{e.text}</pre>
      {:else if e.kind === "result"}
        <div class="result" class:bad={!e.ok}>
          {e.ok ? "Turn finished" : "Turn failed"}{e.cost_usd ? ` · $${e.cost_usd.toFixed(3)}` : ""}{!e.ok && e.text ? ` · ${e.text.slice(0, 240)}` : ""}
        </div>
      {:else if e.kind === "error"}
        <div class="result bad">{e.text}</div>
      {/if}
    {:else}
      <div class="empty">No messages yet.</div>
    {/each}
    {#if busy}<div class="working t3"><Bits kind="spinner" size={11} /> Working…</div>{/if}
  </div>
</div>

<style>
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .inner {
    max-width: 860px;
    margin: 0 auto;
    padding: 16px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .more {
    align-self: center;
  }
  .msg {
    padding: 2px 0;
  }
  .msg.user {
    margin: 14px 0 6px;
    padding: 8px 12px;
    border-left: 2px solid var(--accent);
    background: var(--surface);
    border-radius: 0 var(--r-sm) var(--r-sm) 0;
  }
  .msg.user.queued {
    border-left-color: var(--text-3);
  }
  .who {
    font-size: 11.5px;
    margin-bottom: 3px;
    display: flex;
  }
  .when {
    margin-left: auto;
  }
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .msg.agent {
    padding: 4px 0;
  }
  .tool {
    display: flex;
    flex-direction: column;
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 26px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    text-align: left;
    color: var(--text-2);
    min-width: 0;
  }
  .trow:hover {
    background: var(--surface);
  }
  .st {
    width: 14px;
    display: grid;
    place-items: center;
    color: var(--ok);
    flex: none;
  }
  .fail .st {
    color: var(--bad);
  }
  .tname {
    font-weight: 500;
    color: var(--text);
    font-size: 12.5px;
    flex: none;
  }
  .tname.agentcall {
    color: var(--accent);
  }
  .detail {
    flex: 1;
    font-size: 11.5px;
  }
  .caret {
    display: grid;
    transition: transform 0.12s;
  }
  .caret.openc {
    transform: rotate(90deg);
  }
  .out {
    margin: 2px 0 6px 28px;
    max-height: 320px;
    overflow: auto;
    padding: 8px 10px;
    border-radius: var(--r-sm);
    background: var(--bg);
    border: 1px solid var(--line);
    font: 11.5px/1.5 var(--mono);
    color: var(--text-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .imgs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin: 2px 0 6px 28px;
  }
  .imgs.user-img {
    margin-left: 14px;
  }
  .imgs img {
    max-width: 280px;
    max-height: 200px;
    min-width: 60px;
    min-height: 40px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line);
    background: var(--surface);
    cursor: zoom-in;
    object-fit: contain;
  }
  .imgbtn {
    padding: 0;
    border: 0;
    background: none;
    cursor: zoom-in;
  }
  .imgs :global(img.broken) {
    opacity: 0.3;
  }
  .result {
    align-self: flex-start;
    margin: 6px 0 4px;
    font-size: 11.5px;
    color: var(--text-3);
  }
  .result.bad {
    color: var(--bad);
  }
  .working {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    padding: 6px;
  }
</style>
