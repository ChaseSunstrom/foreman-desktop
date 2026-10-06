<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import { fm, live, type Stream } from "$lib/fm";
  import { base, type Decision, type Item, type ProjectState, type ProjectView } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";
  import Switch from "./Switch.svelte";
  import ItemTable from "./ItemTable.svelte";

  let { device, slug, tab: tab0 }: { device: string; slug: string; tab?: string } = $props();
  // svelte-ignore state_referenced_locally
  let tab = $state(tab0 ?? "overview");
  let v = $state<ProjectView | null>(null);
  let full = $state<ProjectState | null>(null);
  let err = $state<string | null>(null);
  let busy = $state<Record<string, boolean>>({});
  let decisions = $state<Decision[] | null>(null);
  let review = $state<{ digest: string; friction: { since?: string; sections: Record<string, string[]> } } | null>(null);
  let stream: Stream | null = null;
  let refetch: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const d = untrack(() => app.device(device));
    stream?.stop();
    if (!d) return;
    stream = live(d, ["-p", slug, "ui", "--json", "--follow"], (o) => {
      v = o;
      // the full lists follow the view: one fetch per change, a moment after it settles
      if (refetch) clearTimeout(refetch);
      refetch = setTimeout(() => fm<ProjectState>(d, ["-p", slug, "state", "--json"]).then((s) => (full = s)).catch(() => {}), 150);
    }, (s) => (err = s.ok ? null : (s.error ?? null)));
  });
  onDestroy(() => {
    stream?.stop();
    if (refetch) clearTimeout(refetch);
  });

  const dev = $derived(app.device(device));
  const a = $derived(v?.active ?? null);
  const waits = $derived(Object.fromEntries([...(v?.queue ?? []), ...(v?.inbox ?? [])].map((i) => [i.id, i.waits])));
  const plans = $derived([...(v?.queue ?? []), ...(v?.inbox ?? [])].filter((i) => i.waits === "plan approval" && i.plan));
  const tabs = $derived([
    { id: "overview", label: "Overview", n: null },
    { id: "queue", label: "Queue", n: full?.queue.length ?? v?.queue?.length ?? 0 },
    { id: "inbox", label: "Inbox", n: full?.inbox.length ?? v?.inbox_total ?? 0 },
    { id: "blocked", label: "Blocked", n: full?.blocked.length ?? 0 },
    { id: "decisions", label: "Decisions", n: null },
    { id: "review", label: "Review", n: null },
    { id: "activity", label: "Activity", n: null },
    { id: "gates", label: "Gates", n: null },
  ]);

  async function act(key: string, args: string[], done?: string) {
    busy[key] = true;
    await app.act(device, ["-p", slug, ...args], done);
    busy[key] = false;
  }
  // what was decided along the way, newest first; costly and outward ones are the user's to review
  $effect(() => {
    if (tab !== "decisions") return;
    const d = untrack(() => app.device(device));
    if (d) fm<{ rows: Decision[] }>(d, ["-p", slug, "decide", "--list", "--json"]).then((o) => (decisions = [...(o.rows ?? [])].reverse())).catch(() => (decisions = []));
  });
  // what got done this week, and what got in the way since the last self-improvement pass
  $effect(() => {
    if (tab !== "review") return;
    const d = untrack(() => app.device(device));
    if (!d) return;
    Promise.all([fm<string>(d, ["-p", slug, "digest"]).catch(() => ""), fm<any>(d, ["-p", slug, "friction", "--json"]).catch(() => null)])
      .then(([digest, friction]) => (review = { digest: typeof digest === "string" ? digest : "", friction: friction?.sections ? friction : { sections: {} } }));
  });
  const approve = (i: Item) => act(`a${i.id}`, ["task", "set", i.id, "approved=true", "--json"], `${i.id} approved`);
  const mins = (s: number | null | undefined) => (s == null ? null : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);
</script>

<div class="page">
  <div class="pagehead">
    <Icon name="folder" size={15} />
    <h1>{v?.root ? base(v.root) : slug}</h1>
    <span class="mono t3 ellipsis path">{v?.root ?? ""}</span>
    <span class="t3 on">on {dev?.name}</span>
    <span class="grow"></span>
    {#if v?.mode}
      <Switch on={v.mode.drive} label="Drive" busy={busy.drive}
        onchange={(on) => act("drive", ["drive", on ? "on" : "off", "--json"], `Drive ${on ? "on" : "off"}`)} />
      <div class="seg">
        {#each ["standard", "full"] as m}
          <button class:sel={v.mode.autonomy === m} disabled={busy.autonomy}
            onclick={() => v?.mode?.autonomy !== m && act("autonomy", ["autonomy", m, "--json"], `Autonomy: ${m}`)}>
            {m === "full" ? "Full auto" : "Standard"}</button>
        {/each}
      </div>
      <button class="btn" onclick={() => (app.newSession = { device, cwd: v?.root })}><Icon name="plus" size={13} /> Session here</button>
    {/if}
  </div>

  <div class="tabs">
    {#each tabs as t}
      <button class="tab" class:on={tab === t.id} onclick={() => (tab = t.id)}>{t.label}{#if t.n !== null}<span class="n">{t.n}</span>{/if}</button>
    {/each}
  </div>

  <div class="content">
    {#if err && !v}
      <div class="empty bad">{err}</div>
    {:else if !v}
      <div class="empty">Loading…</div>
    {:else if tab === "overview"}
      <div class="overview" in:fade={{ duration: 120 }}>
        <div class="col">
          {#if a}
            <section class="panel task">
              <div class="trow">
                <Bits kind="type" type={a.type} tier={a.tier} />
                <span class="mono t3">{a.id}</span>
                <span class="grow"></span>
                {#if a.on_task_s}<span class="t3 small">{`${mins(a.on_task_s)} on it${v.typical?.[`${a.type}/${a.tier}`] ? ` · usually ${v.typical[`${a.type}/${a.tier}`]}m` : ""}`}</span>{/if}
              </div>
              <h2>{a.title}</h2>
              <div class="stages">
                {#each a.stages as st, i}
                  {@const ix = a.stages.indexOf(a.stage)}
                  <div class="stage" class:done={i < ix} class:cur={i === ix}><span class="seg-bar"></span><span class="slabel">{st}</span></div>
                {/each}
              </div>
              <div class="label sub">Steps · {a.steps.filter((s) => s.done).length}/{a.steps.length}</div>
              <ol class="steps">
                {#each a.steps as s (s.n)}
                  <li class:done={s.done} class:cur={s.current}>
                    <span class="mark">{#if s.done}<Icon name="check" size={11} stroke={2.6} />{:else if s.current}<Bits kind="spinner" size={10} />{/if}</span>
                    <span>{s.text}</span>
                  </li>
                {/each}
              </ol>
              {#if a.criteria.length}
                <div class="label sub">Done when</div>
                <ul class="crit">
                  {#each a.criteria as c (c.n)}
                    <li class:ok={c.checked}>
                      <span class="box">{#if c.checked}<Icon name="check" size={10} stroke={2.8} />{/if}</span>
                      <div>{c.text}{#if c.verify}<div class="mono t3 verify ellipsis" title={c.verify}>{c.verify}</div>{/if}</div>
                    </li>
                  {/each}
                </ul>
              {/if}
              <div class="tfoot t3">
                <span><Icon name="shield" size={12} /> audits {a.audits.done}/{a.audits.need}</span>
                {#each a.blockers.slice(0, 3) as b}<span class="blocker ellipsis" title={b}>{b}</span>{/each}
              </div>
            </section>
          {:else}
            <section class="panel empty">No active task. Start one from the queue or inbox.</section>
          {/if}

          {#if plans.length}
            <section class="panel plans">
              <div class="label">Plans waiting for your yes</div>
              {#each plans as i (i.id)}
                <div class="plan">
                  <div class="trow"><Bits kind="type" type={i.type} tier={i.tier} /><span class="mono t3">{i.id}</span><span class="ellipsis">{i.title}</span></div>
                  <p><b>Interpretation</b> {i.plan!.interpretation}</p>
                  <p><b>Approach</b> {i.plan!.approach}</p>
                  <button class="btn primary" disabled={busy[`a${i.id}`]} onclick={() => approve(i)}><Icon name="check" size={13} /> Approve plan</button>
                </div>
              {/each}
            </section>
          {/if}
        </div>

        <div class="col side">
          {#if v.next}<section class="panel pad"><div class="label">Next</div><div class="next">{v.next}</div></section>{/if}
          <section class="panel pad facts">
            <div><span class="t3">Autonomy</span><span>{v.mode?.autonomy}</span></div>
            <div><span class="t3">Drive</span><span>{v.mode?.drive ? "on" : "off"}</span></div>
            <div><span class="t3">Done today</span><span>{v.today_done ?? 0}</span></div>
            <div><span class="t3">Queue · inbox</span><span>{v.queue?.length ?? 0} · {v.inbox_total ?? 0}</span></div>
            {#if v.mode?.sensitive}<div><span class="t3">Sensitive</span><span>yes</span></div>{/if}
            {#if v.budget}<div><span class="t3">Spend today</span><span>${v.budget.today_usd.toFixed(2)}</span></div>{/if}
          </section>
          {#if v.checks?.results?.length}
            <section class="panel pad">
              <div class="label">Last gates · {v.checks.at?.slice(11, 16)}</div>
              {#each v.checks.results as r}
                <div class="gate"><span class={r.exit === 0 ? "okc" : "badc"}><Icon name={r.exit === 0 ? "check" : "x"} size={11} stroke={2.6} /></span><span class="mono ellipsis">{r.cmd}</span></div>
              {/each}
            </section>
          {/if}
        </div>
      </div>
    {:else if tab === "queue" || tab === "inbox" || tab === "blocked"}
      {#if full}
        <ItemTable items={full[tab]} kind={tab} {device} {slug} {waits} capture={tab === "inbox"} />
      {:else}
        <div class="empty">Loading…</div>
      {/if}
    {:else if tab === "decisions"}
      <div class="list" in:fade={{ duration: 120 }}>
        {#if decisions === null}<div class="empty">Loading…</div>{/if}
        {#each decisions ?? [] as d}
          <div class="line dec" class:rev={d.reversed}>
            <div class="grow-row">
              <span class="t3 mono date">{d.date}</span>
              {#if d.kind}<span class="kind" title="made without asking: yours to review">{d.kind}</span>{/if}
              <span class="dtext">{d.text}</span>
              {#if d.reversed}<span class="t3">reversed later</span>{/if}
            </div>
            {#if d.why}<div class="t3 why">{d.why}</div>{/if}
          </div>
        {:else}{#if decisions}<div class="empty">No decisions recorded (fm decide).</div>{/if}{/each}
      </div>
    {:else if tab === "review"}
      <div class="list review" in:fade={{ duration: 120 }}>
        {#if !review}<div class="empty">Loading…</div>{:else}
          <div class="label rh">This week</div>
          {#each review.digest.split("\n").filter((l) => l.trim()) as l}
            {#if l.startsWith("- ")}<div class="line rl ellipsis" title={l.slice(2)}>{l.slice(2)}</div>
            {:else}<div class="rsub">{l}</div>{/if}
          {:else}<div class="empty">Nothing this week.</div>{/each}
          <div class="label rh">Since the last self-improvement pass{review.friction.since ? ` (${review.friction.since.slice(0, 10)})` : ""}</div>
          {#each Object.entries(review.friction.sections) as [title, lines]}
            <div class="rsub">{title}</div>
            {#each lines as l}<div class="line rl ellipsis" title={l}>{l}</div>{/each}
          {:else}<div class="empty">No friction recorded.</div>{/each}
        {/if}
      </div>
    {:else if tab === "activity"}
      <div class="list" in:fade={{ duration: 120 }}>
        {#each [...(v.recent ?? [])].reverse() as r}<div class="line mono">{r}</div>{:else}<div class="empty">No recent activity.</div>{/each}
      </div>
    {:else if tab === "gates"}
      <div class="list" in:fade={{ duration: 120 }}>
        {#if v.checks?.results?.length}
          <div class="t3 small gh">Run at {v.checks.at}</div>
          {#each v.checks.results as r}
            <div class="line grow-row"><span class={r.exit === 0 ? "okc" : "badc"}><Icon name={r.exit === 0 ? "check" : "x"} size={11} stroke={2.6} /></span>
              <span class="mono">{r.cmd}</span><span class="t3">exit {r.exit} · {r.s}s{r.note ? ` · ${r.note}` : ""}</span></div>
          {/each}
        {:else}<div class="empty">No gate run yet (fm check).</div>{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .path {
    max-width: 320px;
  }
  .on {
    font-size: 12px;
    white-space: nowrap;
  }
  .grow {
    flex: 1;
  }
  .seg {
    display: flex;
    padding: 2px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line-2);
  }
  .seg button {
    height: 22px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--text-2);
    font-size: 12px;
  }
  .seg button.sel {
    background: var(--surface-2);
    color: var(--text);
  }
  .content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .content :global(.wrap) {
    height: 100%;
  }
  .overview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 16px;
    padding: 16px 20px 24px;
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .pad {
    padding: 12px 14px;
  }
  .task {
    padding: 16px 18px;
  }
  .trow {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  h2 {
    font-size: 16px;
    line-height: 1.4;
    margin: 10px 0 14px;
  }
  .stages {
    display: flex;
    gap: 3px;
    margin-bottom: 4px;
  }
  .stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  .seg-bar {
    height: 3px;
    border-radius: 2px;
    background: var(--line-2);
  }
  .stage.done .seg-bar {
    background: #7a6337;
  }
  .stage.cur .seg-bar {
    background: var(--accent);
  }
  .slabel {
    font-size: 11px;
    color: var(--text-3);
    text-transform: capitalize;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stage.cur .slabel {
    color: var(--text);
  }
  .sub {
    margin: 16px 0 6px;
  }
  ol,
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .steps li {
    display: flex;
    gap: 9px;
    padding: 4px 0;
    color: var(--text-2);
  }
  .steps li.done {
    color: var(--text-3);
  }
  .steps li.cur {
    color: var(--text);
  }
  .mark {
    width: 16px;
    height: 16px;
    flex: none;
    border-radius: 4px;
    border: 1px solid var(--line-2);
    display: grid;
    place-items: center;
    margin-top: 2px;
  }
  .done .mark {
    background: var(--surface-2);
    color: var(--ok);
  }
  .cur .mark {
    border-color: var(--accent);
  }
  .crit li {
    display: flex;
    gap: 9px;
    padding: 4px 0;
    color: var(--text-2);
  }
  .crit li.ok {
    color: var(--text);
  }
  .box {
    width: 14px;
    height: 14px;
    flex: none;
    border-radius: 3px;
    border: 1px solid var(--line-2);
    display: grid;
    place-items: center;
    margin-top: 3px;
  }
  .ok .box {
    background: var(--ok);
    border-color: var(--ok);
    color: #0c1a12;
  }
  .verify {
    font-size: 11px;
    max-width: 560px;
  }
  .tfoot {
    display: flex;
    gap: 14px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 12px;
  }
  .tfoot span {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }
  .blocker {
    color: var(--warn);
    max-width: 220px;
  }
  .plans {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .plan {
    padding-top: 10px;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  .plan p {
    margin: 0;
    color: var(--text-2);
  }
  .plan b {
    color: var(--text);
    font-weight: 600;
  }
  .next {
    margin-top: 6px;
    line-height: 1.5;
  }
  .facts {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .facts div {
    display: flex;
    justify-content: space-between;
  }
  .gate {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }
  .okc,
  .badc {
    width: 16px;
    height: 16px;
    flex: none;
    border-radius: 50%;
    display: inline-grid;
    place-items: center;
  }
  .okc {
    color: var(--ok);
    background: rgba(79, 174, 126, 0.12);
  }
  .badc {
    color: var(--bad);
    background: rgba(229, 83, 75, 0.12);
  }
  .list {
    padding: 8px 20px 24px;
  }
  .line {
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
    font-size: 12px;
    color: var(--text-2);
  }
  .grow-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .gh {
    padding: 8px 0;
  }
  .small {
    font-size: 12px;
  }
  .bad {
    color: var(--bad);
  }
  .dec {
    padding: 9px 0;
  }
  .review .rh {
    margin: 18px 0 6px;
  }
  .review .rh:first-child {
    margin-top: 6px;
  }
  .review .rsub {
    padding: 10px 0 4px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
  }
  .review .rl {
    padding: 4px 0;
  }
  .dec .date {
    flex: none;
    white-space: nowrap;
  }
  .dec .dtext {
    color: var(--text);
    font-size: 13px;
  }
  .dec .why {
    margin: 3px 0 0 86px;
  }
  .dec.rev .dtext {
    text-decoration: line-through;
    color: var(--text-3);
  }
  .kind {
    flex: none;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--warn);
    background: color-mix(in srgb, var(--warn) 14%, transparent);
  }
</style>
