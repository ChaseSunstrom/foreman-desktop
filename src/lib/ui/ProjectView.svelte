<script lang="ts">
  import { onDestroy } from "svelte";
  import { fly, fade, slide, scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { Spring } from "svelte/motion";
  import { app } from "$lib/app.svelte";
  import { live, type Stream } from "$lib/fm";
  import { base, TYPE_COLOR, type Item, type ProjectView } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";
  import Switch from "./Switch.svelte";

  let { device, slug }: { device: string; slug: string } = $props();
  let v = $state<ProjectView | null>(null);
  let err = $state<string | null>(null);
  let busy = $state<Record<string, boolean>>({});
  let capture = $state("");
  let openPlan = $state<string | null>(null);
  let stream: Stream | null = null;

  $effect(() => {
    const d = app.device(device);
    v = null;
    err = null;
    stream?.stop();
    if (!d) return;
    stream = live(d, ["-p", slug, "ui", "--json", "--follow"], (o) => (v = o), (s) => (err = s.ok ? null : s.error ?? null));
  });
  onDestroy(() => stream?.stop());

  const dev = $derived(app.device(device));
  const a = $derived(v?.active ?? null);
  const stageIx = $derived(a ? Math.max(0, a.stages.indexOf(a.stage)) : 0);
  const stageSpring = new Spring(0, { stiffness: 0.06, damping: 0.6 });
  $effect(() => {
    if (a) stageSpring.target = a.stages.length > 1 ? stageIx / (a.stages.length - 1) : 0;
  });

  async function act(key: string, args: string[], done?: string) {
    busy[key] = true;
    await app.act(device, ["-p", slug, ...args], done);
    busy[key] = false;
  }
  const start = (i: Item) => act(`s${i.id}`, ["focus", i.id, "--json"], `${i.id} is the active task`);
  const drop = (i: Item) => act(`d${i.id}`, ["task", "drop", i.id, "dropped from Foreman Desktop", "--json"], `${i.id} dropped`);
  const approve = (i: Item) => act(`a${i.id}`, ["task", "set", i.id, "approved=true", "--json"], `${i.id} approved`);
  async function doCapture(e: Event) {
    e.preventDefault();
    const text = capture.trim();
    if (!text) return;
    capture = "";
    await act("capture", ["capture", "--json", "--", text], "Captured to the inbox");
  }
  const mins = (s: number | null | undefined) => (s == null ? null : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);
</script>

<div class="page">
  <header in:fly={{ y: 8, duration: 400 }}>
    <div class="title">
      <h1>{v?.root ? base(v.root) : slug}</h1>
      <div class="path mono faint">{v?.root ?? ""} <span class="on">on {dev?.name}</span></div>
    </div>
    {#if v?.mode}
      <div class="controls" in:fade>
        <Switch on={v.mode.drive} label="Drive" busy={busy.drive}
          onchange={(on) => act("drive", ["drive", on ? "on" : "off", "--json"], `Drive ${on ? "on" : "off"}`)} />
        <div class="seg">
          {#each ["standard", "full"] as m}
            <button class:sel={v.mode.autonomy === m} disabled={busy.autonomy}
              onclick={() => v?.mode?.autonomy !== m && act("autonomy", ["autonomy", m, "--json"], `Autonomy: ${m}`)}>
              {m === "full" ? "Full auto" : "Standard"}
            </button>
          {/each}
        </div>
        <button class="btn" onclick={() => (app.newSession = { device, cwd: v?.root })}>
          <Icon name="sparkles" size={15} /> New session here
        </button>
      </div>
    {/if}
  </header>

  {#if err && !v}
    <div class="card errbox" in:fade><Icon name="alert" /> {err}</div>
  {:else if !v}
    <div class="skeleton">
      <div class="shimmer" style="height: 220px"></div>
      <div class="shimmer" style="height: 220px"></div>
    </div>
  {:else}
    {#if v.next}
      <div class="next" in:fly={{ y: 6 }}>
        <span class="next-label">Next</span>
        <span>{v.next}</span>
      </div>
    {/if}

    <div class="cols">
      <div class="col">
        {#if a}
          <article class="card task running-ring" in:fly={{ y: 12, duration: 450 }}>
            <div class="task-top">
              <Bits kind="type" type={a.type} tier={a.tier} />
              <span class="mono faint">{a.id}</span>
              {#if a.on_task_s}
                <span class="timer"><Icon name="clock" size={13} /> {mins(a.on_task_s)} on it
                  {#if v.typical?.[`${a.type}/${a.tier}`]}· usually ~{v.typical[`${a.type}/${a.tier}`]}m{/if}</span>
              {/if}
            </div>
            <h2>{a.title}</h2>

            <div class="stepper">
              <div class="rail"><div class="rail-fill" style="width: {stageSpring.current * 100}%"></div></div>
              {#each a.stages as st, i}
                <div class="stage" class:done={i < stageIx} class:cur={i === stageIx}
                  style="left: {a.stages.length > 1 ? (i / (a.stages.length - 1)) * 100 : 0}%">
                  <span class="node"></span>
                  <span class="label">{st}</span>
                </div>
              {/each}
            </div>

            <div class="sub-title">Steps <span class="faint">{a.steps.filter((s) => s.done).length}/{a.steps.length}</span></div>
            <ul class="steps">
              {#each a.steps as s (s.n)}
                <li class:done={s.done} class:cur={s.current} animate:flip>
                  <span class="tick">
                    {#if s.done}<span in:scale={{ start: 0.3, duration: 350 }}><Icon name="check" size={12} stroke={3} /></span>
                    {:else if s.current}<Bits kind="spinner" size={14} />{/if}
                  </span>
                  <span>{s.text}</span>
                </li>
              {/each}
            </ul>

            {#if a.criteria.length}
              <div class="sub-title">Done when</div>
              <ul class="crit">
                {#each a.criteria as c (c.n)}
                  <li class:checked={c.checked}>
                    <span class="box">{#if c.checked}<Icon name="check" size={11} stroke={3} />{/if}</span>
                    <div>
                      <div>{c.text}</div>
                      {#if c.verify}<div class="mono faint verify">{c.verify}</div>{/if}
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}

            <div class="task-foot">
              <span><Icon name="shield" size={13} /> audits {a.audits.done}/{a.audits.need}</span>
              {#if a.blockers.length}
                <span class="blockers" title={a.blockers.join("\n")}><Icon name="alert" size={13} /> {a.blockers.length} before done</span>
              {/if}
            </div>
          </article>
        {:else}
          <div class="card empty" in:fade>
            <Icon name="sparkles" size={20} />
            <div>No active task. Start one from the queue or the inbox, or start a session to work here.</div>
          </div>
        {/if}

        {#if v.checks?.results?.length}
          <div class="card pad" in:fly={{ y: 10, delay: 120 }}>
            <div class="card-title"><Icon name="gauge" size={14} /> Last gates <span class="faint">{v.checks.at?.slice(11, 16)}</span></div>
            <ul class="checks">
              {#each v.checks.results as r}
                <li>
                  <span class:ok={r.exit === 0} class:bad={r.exit !== 0} class="ck">
                    <Icon name={r.exit === 0 ? "check" : "x"} size={12} stroke={3} /></span>
                  <span class="mono cmd">{r.cmd}</span>
                  <span class="faint">{r.s}s</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      <div class="col">
        <div class="card pad" in:fly={{ y: 10, delay: 60 }}>
          <div class="card-title"><Icon name="list" size={14} /> Queue <span class="faint">{v.queue?.length ?? 0}</span></div>
          {#if !v.queue?.length}<div class="faint none">Nothing queued.</div>{/if}
          <ul class="items">
            {#each v.queue ?? [] as i (i.id)}
              <li animate:flip={{ duration: 300 }} transition:slide={{ duration: 200 }}>
                {@render row(i, true)}
              </li>
            {/each}
          </ul>
        </div>

        <div class="card pad" in:fly={{ y: 10, delay: 110 }}>
          <div class="card-title"><Icon name="inbox" size={14} /> Inbox <span class="faint">{v.inbox_total ?? 0}</span></div>
          <form class="capture" onsubmit={doCapture}>
            <input placeholder="Capture an idea, a bug, a request…" bind:value={capture} />
            <button class="icon-btn" aria-label="Capture" disabled={!capture.trim()}><Icon name="plus" /></button>
          </form>
          <ul class="items">
            {#each v.inbox ?? [] as i (i.id)}
              <li animate:flip={{ duration: 300 }} transition:slide={{ duration: 200 }}>
                {@render row(i, false)}
              </li>
            {/each}
          </ul>
        </div>

        {#if v.recent?.length}
          <div class="card pad" in:fly={{ y: 10, delay: 160 }}>
            <div class="card-title"><Icon name="clock" size={14} /> Recent</div>
            <ul class="recent">
              {#each v.recent.slice(-8).reverse() as r}
                <li class="mono">{r}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#snippet row(i: Item, queued: boolean)}
  <div class="item">
    <span class="tdot" style="background: {TYPE_COLOR[i.type] ?? 'var(--accent)'}"></span>
    <span class="mono faint id">{i.id}</span>
    <span class="ititle" title={i.title}>{i.title}</span>
    {#if i.waits}<span class="waits">{i.waits}</span>{/if}
    <span class="acts">
      {#if i.waits === "plan approval"}
        <button class="mini-btn" onclick={() => (openPlan = openPlan === i.id ? null : i.id)}>Plan</button>
      {/if}
      <button class="icon-btn" title="Start" disabled={busy[`s${i.id}`]} onclick={() => start(i)}><Icon name="play" size={13} /></button>
      <button class="icon-btn" title="Drop" disabled={busy[`d${i.id}`]} onclick={() => drop(i)}><Icon name="x" size={13} /></button>
    </span>
  </div>
  {#if queued && i.steps_total}
    <div class="ibar"><Bits kind="bar" value={(i.steps_done ?? 0) / i.steps_total} height={3} /></div>
  {/if}
  {#if openPlan === i.id && i.plan}
    <div class="plan" transition:slide>
      <p><b>Interpretation.</b> {i.plan.interpretation}</p>
      <p><b>Approach.</b> {i.plan.approach}</p>
      <ol>{#each i.plan.steps as s}<li>{s.text}</li>{/each}</ol>
      <button class="btn grad" disabled={busy[`a${i.id}`]} onclick={() => approve(i)}><Icon name="check" size={14} /> Approve plan</button>
    </div>
  {/if}
{/snippet}

<style>
  .page {
    padding: 28px 36px 40px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 1320px;
  }
  header {
    display: flex;
    align-items: flex-end;
    gap: 20px;
    flex-wrap: wrap;
  }
  .title {
    flex: 1;
    min-width: 260px;
  }
  h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.025em;
  }
  .path {
    margin-top: 3px;
  }
  .on {
    font-family: "Inter Variable", sans-serif;
    color: var(--dim);
    margin-left: 6px;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .seg {
    display: flex;
    padding: 3px;
    border-radius: 11px;
    background: var(--panel);
    border: 1px solid var(--line);
  }
  .seg button {
    border: 0;
    background: none;
    color: var(--dim);
    padding: 5px 11px;
    border-radius: 8px;
    font-size: 12.5px;
    transition: all 0.25s var(--ease);
  }
  .seg button.sel {
    background: var(--panel-3);
    color: var(--text);
    box-shadow: 0 2px 10px -2px rgba(0, 0, 0, 0.5);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 13px;
    border-radius: 10px;
    border: 1px solid var(--line-2);
    background: var(--panel-2);
    color: var(--text);
    font-size: 13px;
    transition: transform 0.2s var(--spring), background 0.2s;
  }
  .btn:hover {
    background: var(--panel-3);
    transform: translateY(-1px);
  }
  .btn.grad {
    background: var(--grad);
    color: #0b0b14;
    border: 0;
    font-weight: 650;
  }
  .next {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 11px 16px;
    border-radius: 12px;
    background: var(--grad-soft);
    border: 1px solid rgba(141, 125, 255, 0.22);
    font-size: 13.5px;
  }
  .next-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .cols {
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 16px;
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .pad {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .task {
    padding: 20px 22px;
  }
  .task-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .timer {
    margin-left: auto;
    display: inline-flex;
    gap: 5px;
    align-items: center;
    color: var(--dim);
    font-size: 12.5px;
  }
  h2 {
    margin: 12px 0 22px;
    font-size: 21px;
    line-height: 1.3;
    letter-spacing: -0.015em;
  }
  .stepper {
    position: relative;
    height: 46px;
    margin: 0 18px 18px;
  }
  .rail {
    position: absolute;
    top: 6px;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.08);
  }
  .rail-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--grad);
    box-shadow: 0 0 10px rgba(141, 125, 255, 0.6);
  }
  .stage {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .node {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #15152a;
    border: 2px solid rgba(255, 255, 255, 0.15);
    transition: all 0.4s var(--spring);
  }
  .stage.done .node {
    background: var(--accent);
    border-color: var(--accent);
  }
  .stage.cur .node {
    background: var(--accent-2);
    border-color: #fff;
    transform: scale(1.25);
    box-shadow: 0 0 0 5px rgba(64, 216, 246, 0.18), 0 0 18px rgba(64, 216, 246, 0.7);
    animation: breathe 2s ease-in-out infinite;
  }
  @keyframes breathe {
    50% { box-shadow: 0 0 0 8px rgba(64, 216, 246, 0.08), 0 0 24px rgba(64, 216, 246, 0.8); }
  }
  .label {
    font-size: 11px;
    color: var(--faint);
    text-transform: capitalize;
    white-space: nowrap;
  }
  .stage.cur .label {
    color: var(--text);
    font-weight: 600;
  }
  .sub-title {
    font-size: 12px;
    font-weight: 650;
    color: var(--dim);
    margin: 14px 0 8px;
    letter-spacing: 0.03em;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .steps li {
    display: flex;
    gap: 11px;
    align-items: flex-start;
    padding: 7px 10px;
    border-radius: 9px;
    color: var(--dim);
    transition: background 0.3s;
  }
  .steps li.cur {
    background: rgba(64, 216, 246, 0.07);
    color: var(--text);
  }
  .steps li.done {
    color: var(--faint);
  }
  .tick {
    width: 18px;
    height: 18px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    border: 1.5px solid var(--line-2);
    margin-top: 1px;
  }
  .done .tick {
    background: var(--grad);
    border: 0;
    color: #0b0b14;
  }
  .cur .tick {
    border: 0;
  }
  .crit li {
    display: flex;
    gap: 10px;
    padding: 5px 2px;
    color: var(--dim);
  }
  .crit li.checked {
    color: var(--text);
  }
  .box {
    width: 16px;
    height: 16px;
    flex: none;
    border-radius: 5px;
    border: 1.5px solid var(--line-2);
    display: grid;
    place-items: center;
    margin-top: 2px;
  }
  .checked .box {
    background: var(--ok);
    border-color: var(--ok);
    color: #04140d;
  }
  .verify {
    font-size: 11.5px;
    margin-top: 2px;
  }
  .task-foot {
    display: flex;
    gap: 16px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
    color: var(--dim);
    font-size: 12.5px;
  }
  .task-foot span {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .blockers {
    color: var(--warn);
  }
  .items li {
    border-radius: 9px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 8px;
    border-radius: 9px;
    transition: background 0.2s;
  }
  .item:hover {
    background: var(--panel-2);
  }
  .tdot {
    width: 7px;
    height: 7px;
    border-radius: 2px;
    flex: none;
  }
  .id {
    flex: none;
  }
  .ititle {
    flex: 1;
    min-width: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.35;
  }
  .waits {
    font-size: 11px;
    color: var(--warn);
    white-space: nowrap;
  }
  .acts {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .item:hover .acts {
    opacity: 1;
  }
  .icon-btn {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--dim);
    display: grid;
    place-items: center;
    transition: all 0.2s;
  }
  .icon-btn:hover:not(:disabled) {
    color: var(--text);
    border-color: var(--line-2);
    transform: scale(1.06);
  }
  .icon-btn:disabled {
    opacity: 0.4;
  }
  .mini-btn {
    border: 1px solid rgba(251, 191, 36, 0.35);
    background: rgba(251, 191, 36, 0.1);
    color: var(--warn);
    border-radius: 8px;
    font-size: 11.5px;
    padding: 0 8px;
  }
  .ibar {
    padding: 0 8px 6px 24px;
  }
  .plan {
    margin: 4px 8px 10px 24px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(251, 191, 36, 0.05);
    border: 1px solid rgba(251, 191, 36, 0.2);
    font-size: 13px;
    color: var(--dim);
  }
  .plan p {
    margin: 0 0 8px;
  }
  .plan b {
    color: var(--text);
  }
  .plan ol {
    margin: 0 0 12px;
    padding-left: 18px;
  }
  .capture {
    display: flex;
    gap: 8px;
  }
  .capture input {
    flex: 1;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.25);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .capture input:focus {
    border-color: rgba(141, 125, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(141, 125, 255, 0.15);
  }
  .capture .icon-btn {
    width: 36px;
    height: 36px;
  }
  .checks li {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 4px 0;
  }
  .ck {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
  }
  .ck.ok {
    background: rgba(61, 220, 151, 0.15);
    color: var(--ok);
  }
  .ck.bad {
    background: rgba(251, 113, 133, 0.15);
    color: var(--bad);
  }
  .cmd {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
  }
  .recent li {
    font-size: 11.5px;
    color: var(--dim);
    padding: 3px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .none {
    font-size: 13px;
  }
  .empty {
    padding: 28px;
    display: flex;
    gap: 14px;
    align-items: center;
    color: var(--dim);
  }
  .errbox {
    padding: 16px;
    color: var(--bad);
    display: flex;
    gap: 10px;
  }
  .skeleton {
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 16px;
  }
</style>
