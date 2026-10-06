<script lang="ts">
  import { TYPE_COLOR, TIER_WORD, AGENT } from "$lib/types";

  type Props =
    | { kind: "type"; type: string; tier?: string }
    | { kind: "bar"; value: number }
    | { kind: "dot"; status: string }
    | { kind: "spinner"; size?: number }
    | { kind: "agent"; agent: string; size?: number };
  let p: Props = $props();
</script>

{#if p.kind === "type"}
  <span class="type" style="--c: {TYPE_COLOR[p.type] ?? 'var(--text-2)'}">
    {p.type.toLowerCase()}{#if p.tier}<span class="tier">{TIER_WORD[p.tier] ?? p.tier}</span>{/if}
  </span>
{:else if p.kind === "bar"}
  <div class="bar"><div class="fill" style="width: {Math.max(0, Math.min(1, p.value || 0)) * 100}%"></div></div>
{:else if p.kind === "dot"}
  <span class="dot {p.status}" title={p.status}></span>
{:else if p.kind === "spinner"}
  <span class="spinner" style="width: {p.size ?? 12}px; height: {p.size ?? 12}px"></span>
{:else if p.kind === "agent"}
  {@const a = AGENT[p.agent]}
  <span class="agent" style="--c: {a?.color ?? 'var(--text-2)'}; --s: {p.size ?? 20}px" title={a?.name ?? p.agent}>{a?.mark ?? "?"}</span>
{/if}

<style>
  .type {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 18px;
    padding: 0 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 11%, transparent);
    white-space: nowrap;
  }
  .tier {
    color: var(--text-3);
  }
  .bar {
    width: 100%;
    height: 3px;
    border-radius: 2px;
    background: var(--line-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.4s var(--ease);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
    display: inline-block;
    background: var(--text-3);
  }
  .dot.online,
  .dot.idle,
  .dot.ended {
    background: var(--ok);
  }
  .dot.ended {
    background: var(--text-3);
  }
  .dot.live,
  .dot.running,
  .dot.starting,
  .dot.connecting {
    background: var(--accent);
    animation: pulse 1.6s ease-in-out infinite;
  }
  .dot.offline,
  .dot.died,
  .dot.failed {
    background: var(--bad);
  }
  .spinner {
    display: inline-block;
    flex: none;
    border-radius: 50%;
    border: 1.5px solid var(--line-2);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  .agent {
    width: var(--s);
    height: var(--s);
    flex: none;
    border-radius: 5px;
    display: inline-grid;
    place-items: center;
    font: 600 calc(var(--s) * 0.5) / 1 var(--mono);
    color: var(--c);
    background: color-mix(in srgb, var(--c) 13%, transparent);
  }
</style>
