<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { fly, fade, scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { app } from "$lib/app.svelte";
  import { live, type Stream } from "$lib/fm";
  import { AGENT, base, type SessionEvent } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  let { device, id }: { device?: string; id?: string } = $props();

  const rows = $derived(
    [...app.allSessions].sort((a, b) => {
      const live = (s: typeof a) => (s.status === "running" || s.status === "starting" ? 1 : 0);
      return live(b) - live(a) || (b.updated > a.updated ? 1 : -1);
    }),
  );
  const sel = $derived(rows.find((r) => r.id === id && r.device === device) ?? null);
  const busyNow = $derived(sel?.status === "running" || sel?.status === "starting");

  let events = $state<SessionEvent[]>([]);
  let stream: Stream | null = null;
  let scroller = $state<HTMLDivElement>();
  let pinned = true;
  let draft = $state("");
  let sending = $state(false);

  $effect(() => {
    const d = device ? app.device(device) : null;
    events = [];
    stream?.stop();
    stream = null;
    if (!d || !id) return;
    let first = true;
    stream = live(d, ["session", "tail", id, "--follow"], async (e: SessionEvent) => {
      if (first) {
        first = false;
        events = [];
      }
      events.push(e);
      if (pinned) {
        await tick();
        scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
      }
    }, (s) => {
      if (!s.ok) first = true; // a reconnect replays the stream from its start
    });
  });
  onDestroy(() => stream?.stop());

  // tool calls pair with their results by id; a result shows on its call's row
  const results = $derived(new Map(events.filter((e) => e.kind === "tool_result" && e.id).map((e) => [e.id!, e])));
  const shown = $derived(events.filter((e) => !["tool_result", "init", "raw"].includes(e.kind) || (e.kind === "tool_result" && !e.id)));
  let open = $state<Record<number, boolean>>({});

  function onScroll() {
    if (!scroller) return;
    pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60;
  }
  async function send(e?: Event) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !sel || !device) return;
    sending = true;
    draft = "";
    pinned = true;
    await app.act(device, ["session", "send", sel.id, "--json", "--", text]);
    sending = false;
  }
  const stop = () => sel && device && app.act(device, ["session", "stop", sel.id, "--json"], "Session stopped");
  async function remove() {
    if (!sel || !device) return;
    if (await app.act(device, ["session", "rm", sel.id, "--json"], "Session removed")) app.view = { kind: "sessions" };
  }
  const devName = (d: string) => app.device(d)?.name ?? d;
</script>

<div class="wrap">
  <div class="list">
    <div class="list-head">
      <div class="card-title"><Icon name="terminal" size={14} /> Sessions</div>
      <button class="icon-btn" title="New session" onclick={() => (app.newSession = {})}><Icon name="plus" /></button>
    </div>
    {#if !rows.length}
      <div class="faint none">No sessions yet.</div>
    {/if}
    {#each rows as r (r.device + r.id)}
      <button class="srow" class:sel={r.id === id && r.device === device} animate:flip={{ duration: 300 }}
        in:fly={{ x: -8, duration: 250 }} onclick={() => (app.view = { kind: "sessions", device: r.device, id: r.id })}>
        <span class="agent" style="--c: {AGENT[r.agent]?.color}">{AGENT[r.agent]?.mark ?? "?"}</span>
        <div class="smeta">
          <div class="stitle">{r.title}</div>
          <div class="ssub faint">{base(r.cwd)} · {devName(r.device)} · {r.turns} turn{r.turns === 1 ? "" : "s"}</div>
        </div>
        {#if r.status === "running" || r.status === "starting"}<Bits kind="spinner" size={13} />
        {:else}<Bits kind="dot" status={r.status} />{/if}
      </button>
    {/each}
  </div>

  <div class="detail">
    {#if !sel}
      <div class="placeholder" in:fade>
        <div class="orb"></div>
        <h2>Pick a session, or start one</h2>
        <p class="dim">Claude Code, Codex, Gemini CLI or opencode, on any device. Sessions keep running when you close the app.</p>
        <button class="btn grad" onclick={() => (app.newSession = {})}><Icon name="sparkles" size={15} /> New session</button>
      </div>
    {:else}
      {#key sel.device + sel.id}
        <header in:fade={{ duration: 200 }}>
          <span class="agent big" style="--c: {AGENT[sel.agent]?.color}">{AGENT[sel.agent]?.mark}</span>
          <div class="htext">
            <div class="htitle">{sel.title}</div>
            <div class="faint hsub mono">{AGENT[sel.agent]?.name}{sel.model ? ` · ${sel.model}` : ""} · {sel.cwd} · {devName(sel.device)}</div>
          </div>
          <span class="status {sel.status}">{sel.status}</span>
          {#if busyNow}
            <button class="btn" onclick={stop}><Icon name="stop" size={14} /> Stop</button>
          {:else}
            <button class="icon-btn" title="Remove" onclick={remove}><Icon name="trash" size={14} /></button>
          {/if}
        </header>

        <div class="events" bind:this={scroller} onscroll={onScroll}>
          {#each shown as e, i (i)}
            {#if e.kind === "user"}
              <div class="turn-sep faint" in:fade>turn {e.turn}</div>
              <div class="bubble user" in:fly={{ y: 10, duration: 300 }}>{e.text}</div>
            {:else if e.kind === "text"}
              <div class="bubble agent-text" in:fly={{ y: 10, duration: 300 }}>{e.text}</div>
            {:else if e.kind === "tool"}
              {@const r = e.id ? results.get(e.id) : undefined}
              <button class="tool" class:fail={r && !r.ok} in:fly={{ x: -6, duration: 250 }} onclick={() => (open[i] = !open[i])}>
                <span class="tstate">
                  {#if !r}<Bits kind="spinner" size={13} />
                  {:else if r.ok}<span in:scale class="okc"><Icon name="check" size={12} stroke={3} /></span>
                  {:else}<span in:scale class="badc"><Icon name="x" size={12} stroke={3} /></span>{/if}
                </span>
                <span class="tname">{e.tool}</span>
                <span class="tdetail mono">{e.detail}</span>
              </button>
              {#if open[i] && r?.text}
                <pre class="tout" transition:fly={{ y: -4, duration: 200 }}>{r.text}</pre>
              {/if}
            {:else if e.kind === "result"}
              <div class="result" class:bad={!e.ok} in:scale={{ start: 0.96, duration: 300 }}>
                <Icon name={e.ok ? "check" : "alert"} size={13} />
                {e.ok ? "Turn finished" : "Turn failed"}{e.cost_usd ? ` · $${e.cost_usd.toFixed(3)}` : ""}
                {#if !e.ok && e.text}<span class="mono"> · {e.text.slice(0, 200)}</span>{/if}
              </div>
            {:else if e.kind === "error"}
              <div class="result bad" in:fade><Icon name="alert" size={13} /> {e.text}</div>
            {:else if e.kind === "status"}
              <div class="turn-sep faint">{e.text}</div>
            {/if}
          {/each}
          {#if busyNow}
            <div class="typing" in:fade><span></span><span></span><span></span></div>
          {/if}
        </div>

        <form class="composer" onsubmit={send}>
          <textarea rows="2" placeholder={busyNow ? "Queue a message for the next turn…" : "Message the agent…  (Ctrl+Enter)"}
            bind:value={draft} onkeydown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && send(e)}></textarea>
          <button class="send" disabled={!draft.trim() || sending} aria-label="Send"><Icon name="send" size={16} /></button>
        </form>
      {/key}
    {/if}
  </div>
</div>

<style>
  .wrap {
    display: grid;
    grid-template-columns: 320px 1fr;
    height: 100%;
    min-height: 0;
  }
  .list {
    border-right: 1px solid var(--line);
    padding: 22px 12px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 10px;
  }
  .none {
    padding: 8px;
  }
  .srow {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px;
    border-radius: 11px;
    border: 1px solid transparent;
    background: none;
    color: inherit;
    text-align: left;
    transition: background 0.2s, border-color 0.2s;
  }
  .srow:hover {
    background: var(--panel);
  }
  .srow.sel {
    background: var(--panel-2);
    border-color: var(--line-2);
  }
  .agent {
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: 9px;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 12px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 32%, transparent);
  }
  .agent.big {
    width: 38px;
    height: 38px;
    font-size: 15px;
    border-radius: 12px;
  }
  .smeta {
    flex: 1;
    min-width: 0;
  }
  .stitle,
  .ssub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stitle {
    font-weight: 550;
  }
  .ssub {
    font-size: 11.5px;
  }
  .detail {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 18px 26px;
    border-bottom: 1px solid var(--line);
  }
  .htext {
    flex: 1;
    min-width: 0;
  }
  .htitle {
    font-weight: 650;
    font-size: 16px;
  }
  .hsub {
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status {
    font-size: 11.5px;
    padding: 3px 10px;
    border-radius: 99px;
    background: var(--panel-2);
    color: var(--dim);
    text-transform: capitalize;
  }
  .status.running,
  .status.starting {
    color: var(--accent-2);
    background: rgba(64, 216, 246, 0.12);
  }
  .status.idle {
    color: var(--ok);
    background: rgba(61, 220, 151, 0.12);
  }
  .status.died {
    color: var(--bad);
    background: rgba(251, 113, 133, 0.12);
  }
  .events {
    flex: 1;
    overflow: auto;
    padding: 18px 26px 24px;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .turn-sep {
    align-self: center;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 8px 0 2px;
  }
  .bubble {
    max-width: 78%;
    padding: 11px 15px;
    border-radius: 16px;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.55;
  }
  .bubble.user {
    align-self: flex-end;
    background: var(--grad);
    color: #0b0b14;
    font-weight: 500;
    border-bottom-right-radius: 5px;
    box-shadow: 0 10px 30px -14px rgba(141, 125, 255, 0.8);
  }
  .bubble.agent-text {
    align-self: flex-start;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-bottom-left-radius: 5px;
  }
  .tool {
    align-self: flex-start;
    max-width: 88%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 12px 6px 8px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.22);
    color: var(--dim);
    font-size: 12.5px;
    text-align: left;
  }
  .tool:hover {
    border-color: var(--line-2);
  }
  .tool.fail {
    border-color: rgba(251, 113, 133, 0.3);
  }
  .tstate {
    width: 18px;
    display: grid;
    place-items: center;
  }
  .okc,
  .badc {
    width: 17px;
    height: 17px;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .okc {
    background: rgba(61, 220, 151, 0.16);
    color: var(--ok);
  }
  .badc {
    background: rgba(251, 113, 133, 0.16);
    color: var(--bad);
  }
  .tname {
    font-weight: 600;
    color: var(--text);
  }
  .tdetail {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11.5px;
  }
  .tout {
    align-self: stretch;
    margin: 0 0 4px 28px;
    max-height: 260px;
    overflow: auto;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid var(--line);
    font: 11.5px/1.5 var(--mono);
    color: var(--dim);
    white-space: pre-wrap;
  }
  .result {
    align-self: center;
    display: inline-flex;
    gap: 7px;
    align-items: center;
    padding: 5px 13px;
    border-radius: 99px;
    font-size: 12px;
    color: var(--ok);
    background: rgba(61, 220, 151, 0.08);
    border: 1px solid rgba(61, 220, 151, 0.2);
    max-width: 90%;
  }
  .result.bad {
    color: var(--bad);
    background: rgba(251, 113, 133, 0.08);
    border-color: rgba(251, 113, 133, 0.22);
  }
  .typing {
    display: flex;
    gap: 5px;
    padding: 12px 16px;
    align-self: flex-start;
    border-radius: 14px;
    background: var(--panel);
  }
  .typing span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-2);
    animation: bounce 1.2s ease-in-out infinite;
  }
  .typing span:nth-child(2) {
    animation-delay: 0.15s;
    background: #6aa8ff;
  }
  .typing span:nth-child(3) {
    animation-delay: 0.3s;
    background: var(--accent);
  }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
    40% { transform: translateY(-6px); opacity: 1; }
  }
  .composer {
    display: flex;
    gap: 10px;
    padding: 14px 26px 20px;
    border-top: 1px solid var(--line);
  }
  textarea {
    flex: 1;
    resize: none;
    padding: 11px 14px;
    border-radius: 13px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.28);
    outline: none;
    line-height: 1.45;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  textarea:focus {
    border-color: rgba(141, 125, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(141, 125, 255, 0.14);
  }
  .send {
    width: 48px;
    border: 0;
    border-radius: 13px;
    background: var(--grad);
    color: #0b0b14;
    display: grid;
    place-items: center;
    transition: transform 0.2s var(--spring), opacity 0.2s;
  }
  .send:hover:not(:disabled) {
    transform: scale(1.05) rotate(-6deg);
  }
  .send:disabled {
    opacity: 0.35;
  }
  .icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--dim);
    display: grid;
    place-items: center;
  }
  .icon-btn:hover {
    color: var(--text);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 13px;
    border-radius: 10px;
    border: 1px solid var(--line-2);
    background: var(--panel-2);
    font-size: 13px;
  }
  .btn.grad {
    background: var(--grad);
    color: #0b0b14;
    border: 0;
    font-weight: 650;
  }
  .placeholder {
    margin: auto;
    text-align: center;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .placeholder h2 {
    margin: 18px 0 0;
    font-size: 20px;
  }
  .placeholder p {
    margin: 0 0 14px;
  }
  .orb {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: conic-gradient(from var(--angle), #8d7dff, #40d8f6, #ec4899, #8d7dff);
    animation: spin-angle 5s linear infinite, float 6s ease-in-out infinite;
    filter: saturate(1.2);
    box-shadow: 0 0 60px rgba(141, 125, 255, 0.45);
    mask: radial-gradient(circle, #000 52%, transparent 54%);
  }
  @keyframes float {
    50% { transform: translateY(-8px); }
  }
</style>
