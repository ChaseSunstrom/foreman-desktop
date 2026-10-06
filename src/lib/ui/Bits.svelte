<script lang="ts">
  import { Spring } from "svelte/motion";
  import { TYPE_COLOR, TIER_WORD } from "$lib/types";

  type Props =
    | { kind: "type"; type: string; tier?: string }
    | { kind: "bar"; value: number; height?: number; glow?: boolean }
    | { kind: "ring"; value: number; size?: number; running?: boolean }
    | { kind: "dot"; status: string }
    | { kind: "spinner"; size?: number };
  let p: Props = $props();

  const spring = new Spring(0, { stiffness: 0.08, damping: 0.55 });
  $effect(() => {
    if (p.kind === "bar" || p.kind === "ring") spring.target = Math.max(0, Math.min(1, p.value || 0));
  });
</script>

{#if p.kind === "type"}
  <span class="chip" style="--c: {TYPE_COLOR[p.type] ?? 'var(--accent)'}">
    {p.type}{#if p.tier}<span class="tier">· {TIER_WORD[p.tier] ?? p.tier}</span>{/if}
  </span>
{:else if p.kind === "bar"}
  <div class="bar" style="height: {p.height ?? 6}px">
    <div class="fill" class:glow={p.glow} style="width: {spring.current * 100}%"></div>
  </div>
{:else if p.kind === "ring"}
  {@const s = p.size ?? 18}
  {@const r = s / 2 - 2}
  {@const c = 2 * Math.PI * r}
  <svg width={s} height={s} class:spin={p.running} viewBox="0 0 {s} {s}">
    <circle cx={s / 2} cy={s / 2} {r} fill="none" stroke="rgba(255,255,255,.1)" stroke-width="2.4" />
    <circle cx={s / 2} cy={s / 2} {r} fill="none" stroke="url(#g-ring)" stroke-width="2.4" stroke-linecap="round"
      stroke-dasharray={c} stroke-dashoffset={c * (1 - spring.current)} transform="rotate(-90 {s / 2} {s / 2})" />
    <defs>
      <linearGradient id="g-ring" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#8d7dff" /><stop offset="1" stop-color="#40d8f6" />
      </linearGradient>
    </defs>
  </svg>
{:else if p.kind === "dot"}
  <span class="dot {p.status}"></span>
{:else if p.kind === "spinner"}
  <span class="spinner" style="width: {p.size ?? 14}px; height: {p.size ?? 14}px"></span>
{/if}

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.04em;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
    white-space: nowrap;
  }
  .tier {
    font-weight: 500;
    opacity: 0.75;
    letter-spacing: 0;
  }
  .bar {
    width: 100%;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 99px;
    background: var(--grad);
    background-size: 200% 100%;
    animation: flow 3s linear infinite;
  }
  .fill.glow {
    box-shadow: 0 0 12px rgba(141, 125, 255, 0.6);
  }
  @keyframes flow {
    to { background-position: -200% 0; }
  }
  .spin {
    animation: rot 2.2s linear infinite;
  }
  @keyframes rot {
    to { transform: rotate(360deg); }
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex: none;
    background: var(--faint);
  }
  .dot.online,
  .dot.idle {
    background: var(--ok);
    box-shadow: 0 0 0 0 rgba(61, 220, 151, 0.6);
    animation: pulse 2.6s ease-out infinite;
  }
  .dot.running,
  .dot.starting,
  .dot.connecting {
    background: var(--accent-2);
    animation: pulse-b 1.4s ease-out infinite;
  }
  .dot.offline,
  .dot.died {
    background: var(--bad);
  }
  .dot.stopped {
    background: var(--faint);
  }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(61, 220, 151, 0.55); }
    80%, 100% { box-shadow: 0 0 0 7px rgba(61, 220, 151, 0); }
  }
  @keyframes pulse-b {
    0% { box-shadow: 0 0 0 0 rgba(64, 216, 246, 0.6); }
    80%, 100% { box-shadow: 0 0 0 7px rgba(64, 216, 246, 0); }
  }
  .spinner {
    display: inline-block;
    flex: none;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.12);
    border-top-color: var(--accent-2);
    border-right-color: var(--accent);
    animation: rot 0.8s linear infinite;
  }
</style>
