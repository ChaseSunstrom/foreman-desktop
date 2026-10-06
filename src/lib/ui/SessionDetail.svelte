<script lang="ts">
  // One session, Foreman's or Claude Code's: its conversation, subagents, scratchpad files and pictures, and a
  // composer. A Claude session is continued headlessly by its own id (forked while its terminal is still open).
  import { onDestroy, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import { fm, live, type Stream } from "$lib/fm";
  import { AGENT, ago, base, type Ev, type SessionItem, type SubAgent } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";
  import Transcript from "./Transcript.svelte";
  import Files from "./Files.svelte";
  import Gallery from "./Gallery.svelte";

  let { s }: { s: SessionItem } = $props();
  let tab = $state("chat");
  let events = $state<Ev[]>([]);
  let err = $state<string | null>(null);
  let agents = $state<SubAgent[]>([]);
  let agentSel = $state<string | null>(null);
  let agentEvents = $state<Ev[]>([]);
  let draft = $state("");
  let sending = $state(false);
  let lightbox = $state<string | null>(null);
  let main: Stream | null = null;
  let whole = $state(false); // the last 4000 transcript lines first; the whole history on request
  let allSteps = $state(false); // tool runs fold to one row each; this opens them all, to audit what was done
  let sub: Stream | null = null;

  const d = $derived(app.device(s.device)!);
  const claude = $derived(s.source === "claude");

  function stream(args: string[], into: (e: Ev[]) => void, get: () => Ev[], onErr?: (e: string | null) => void): Stream {
    let first = true;
    return live(untrack(() => d), args, (e: Ev) => {
      if (first) {
        first = false;
        into([]);
      }
      get().push(e);
      onErr?.(null);
    }, (st) => {
      if (!st.ok) {
        first = true; // a reconnect replays from the start
        onErr?.(st.error ?? "lost the stream");
      }
    });
  }

  $effect(() => {
    const id = s.id, src = s.source, all = whole;
    untrack(() => {
      main?.stop();
      events = [];
      err = null;
      if (!all) tab = "chat";
      agentSel = null;
      main = stream(src === "claude" ? ["claude", "show", id, "--follow", ...(all ? [] : ["--from", "-4000"])] : ["session", "tail", id, "--follow"],
        (e) => (events = e), () => events, (e) => (err = e));
      if (src === "claude") loadAgents();
    });
  });
  $effect(() => {
    const a = agentSel;
    untrack(() => {
      sub?.stop();
      sub = null;
      agentEvents = [];
      if (a) sub = stream(["claude", "show", s.id, "--agent", a, "--follow"], (e) => (agentEvents = e), () => agentEvents);
    });
  });
  onDestroy(() => {
    main?.stop();
    sub?.stop();
  });

  async function loadAgents() {
    try {
      agents = (await fm<{ agents: SubAgent[] }>(d, ["claude", "agents", s.id, "--json"])).agents;
    } catch {
      agents = [];
    }
  }

  async function send(e?: Event) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sending = true;
    if (claude) {
      const out = await app.act<{ id: string; forked: boolean }>(s.device, ["claude", "send", "--json", s.id, "--", text]);
      if (out && typeof out === "object") {
        draft = "";
        app.toast("ok", "Continuing in a forked headless session", {
          label: "Open", run: () => (app.view = { kind: "sessions", device: s.device, id: out.id, source: "fm" }),
        });
      }
    } else if (await app.act(s.device, ["session", "send", "--json", s.id, "--", text])) draft = "";
    sending = false;
  }
  const stop = () => app.act(s.device, ["session", "stop", s.id, "--json"], "Session stopped");
  async function remove() {
    if (await app.act(s.device, ["session", "rm", s.id, "--json"], "Session removed")) app.view = { kind: "sessions" };
  }
  function copyResume() {
    const q = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`; // single quotes: nothing in the path is expanded
    navigator.clipboard?.writeText(`cd ${q(s.cwd)} && claude --resume ${s.id}`);
    app.toast("info", "Resume command copied");
  }
  const busy = $derived(!claude && s.live);
</script>

<div class="detail">
  <div class="head">
    <Bits kind="agent" agent={s.agent} size={26} />
    <div class="htext">
      <div class="title ellipsis">{s.title}</div>
      <div class="t3 sub ellipsis">
        {AGENT[s.agent]?.name ?? s.agent} · {s.kind} · <span class="mono">{s.cwd}</span> · {d?.name}
      </div>
    </div>
    <span class="status" class:live={s.live}>{#if s.live}<Bits kind="dot" status="live" />{/if}{s.live ? (claude ? "live" : s.status) : s.status}</span>
    {#if claude}
      <button class="btn ghost" title="Copy a command that resumes it in a terminal" onclick={copyResume}><Icon name="copy" size={13} /> Resume cmd</button>
    {:else if s.live}
      <button class="btn" onclick={stop}><Icon name="stop" size={12} /> Stop</button>
    {:else}
      <button class="btn icon ghost" title="Remove" onclick={remove}><Icon name="trash" size={14} /></button>
    {/if}
  </div>

  <div class="tabs">
    <button class="tab" class:on={tab === "chat"} onclick={() => (tab = "chat")}>Conversation</button>
    {#if claude}
      <button class="tab" class:on={tab === "agents"} onclick={() => ((tab = "agents"), loadAgents())}>Subagents<span class="n">{agents.length || s.subagents || ""}</span></button>
      <button class="tab" class:on={tab === "files"} onclick={() => (tab = "files")}>Files</button>
      <button class="tab" class:on={tab === "images"} onclick={() => (tab = "images")}>Images<span class="n">{events.filter((e) => e.kind === "image").length || ""}</span></button>
    {/if}
    {#if tab === "chat"}
      <span class="grow"></span>
      <button class="btn ghost small steps" onclick={() => (allSteps = !allSteps)} title="Tool calls fold to one row per run">
        {allSteps ? "Fold steps" : "Show every step"}</button>
    {/if}
  </div>

  {#if err && !events.length}<div class="errbar">{err}</div>{/if}

  {#if tab === "chat" && claude && !whole && (events[0]?.n ?? 0) > 0}
    <button class="btn ghost history" onclick={() => (whole = true)}>Showing the latest part · load the full history</button>
  {/if}
  {#if tab === "chat"}
    <Transcript {events} device={d} sid={s.id} source={s.source} {busy} {allSteps} onimage={(src) => (lightbox = src)} />
  {:else if tab === "agents"}
    <div class="agents">
      <div class="alist">
        {#each agents as a (a.id)}
          <button class="arow" class:on={agentSel === a.id} onclick={() => (agentSel = a.id)}>
            <div class="ellipsis aname">{a.description ?? a.id}</div>
            <div class="t3 small ellipsis">{a.type ?? "agent"} · {a.live ? "running" : ago(a.updated * 1000)}</div>
          </button>
        {:else}<div class="empty">No subagents in this session.</div>{/each}
      </div>
      <div class="aview">
        {#if agentSel}
          <Transcript events={agentEvents} device={d} sid={s.id} agent={agentSel} source="claude" {allSteps} onimage={(src) => (lightbox = src)} />
        {:else}<div class="empty">Pick a subagent to read what it did.</div>{/if}
      </div>
    </div>
  {:else if tab === "files"}
    <Files device={d} sid={s.id} onimage={(src) => (lightbox = src)} />
  {:else if tab === "images"}
    <Gallery device={d} sid={s.id} {events} onimage={(src) => (lightbox = src)} />
  {/if}

  <form class="composer" onsubmit={send}>
    <textarea class="input" rows="2" bind:value={draft}
      placeholder={claude ? "Continue this conversation… (Ctrl+Enter)" : busy ? "Queue a message for the next turn… (Ctrl+Enter)" : "Message the agent… (Ctrl+Enter)"}
      onkeydown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && send(e)}></textarea>
    <div class="cfoot">
      <span class="t3 small">
        {#if claude}Runs <span class="mono">claude -p --resume</span> in {base(s.cwd)}{s.live ? "; it's open in a terminal, so the reply goes to a fork" : ""}.
        {:else}Sent to the next turn; it runs detached on {d?.name}.{/if}
      </span>
      <button class="btn primary" disabled={!draft.trim() || sending}><Icon name="send" size={12} /> Send</button>
    </div>
  </form>
</div>

{#if lightbox}
  <div class="lightbox" transition:fade={{ duration: 120 }} onclick={() => (lightbox = null)} role="presentation">
    <img src={lightbox} alt="" />
  </div>
{/if}
<svelte:window onkeydown={(e) => e.key === "Escape" && (lightbox = null)} />

<style>
  .detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 20px;
    border-bottom: 1px solid var(--line);
    flex: none;
  }
  .htext {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-weight: 600;
    font-size: 14px;
  }
  .sub {
    font-size: 11.5px;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-3);
    text-transform: capitalize;
  }
  .status.live {
    color: var(--accent);
  }
  .tabs {
    flex: none;
    display: flex;
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  .steps {
    margin-right: 12px;
    font-size: 12px;
  }
  .history {
    align-self: center;
    margin-top: 6px;
    font-size: 12px;
  }
  .errbar {
    padding: 8px 20px;
    font-size: 12px;
    color: var(--bad);
    border-bottom: 1px solid var(--line);
  }
  .agents {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 280px 1fr;
  }
  .alist {
    overflow: auto;
    border-right: 1px solid var(--line);
  }
  .arow {
    width: 100%;
    padding: 9px 14px;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    text-align: left;
    color: var(--text);
  }
  .arow:hover {
    background: var(--surface);
  }
  .arow.on {
    background: var(--surface-2);
  }
  .aname {
    font-weight: 500;
  }
  .aview {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .small {
    font-size: 11.5px;
  }
  .composer {
    flex: none;
    border-top: 1px solid var(--line);
    padding: 10px 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .composer textarea {
    width: 100%;
    max-height: 200px;
  }
  .cfoot {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cfoot .t3 {
    flex: 1;
  }
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgba(0, 0, 0, 0.85);
    display: grid;
    place-items: center;
    cursor: zoom-out;
  }
  .lightbox img {
    max-width: 94vw;
    max-height: 92vh;
    border-radius: var(--r-sm);
  }
</style>
