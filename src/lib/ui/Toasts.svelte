<script lang="ts">
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { app } from "$lib/app.svelte";
  import Icon from "./Icon.svelte";
</script>

<div class="toasts">
  {#each app.toasts as t (t.id)}
    <div class="toast {t.kind}" animate:flip={{ duration: 250 }} in:fly={{ x: 40, duration: 350 }} out:fly={{ x: 40, duration: 250 }}>
      <Icon name={t.kind === "ok" ? "check" : t.kind === "bad" ? "alert" : "sparkles"} size={15} />
      <span>{t.text}</span>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    pointer-events: none;
  }
  .toast {
    display: flex;
    gap: 10px;
    align-items: center;
    max-width: 420px;
    padding: 11px 15px;
    border-radius: 12px;
    background: rgba(20, 20, 34, 0.96);
    border: 1px solid var(--line-2);
    box-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.8);
    font-size: 13px;
    pointer-events: auto;
  }
  .ok :global(svg) {
    color: var(--ok);
  }
  .bad {
    border-color: rgba(251, 113, 133, 0.35);
  }
  .bad :global(svg) {
    color: var(--bad);
  }
  .info :global(svg) {
    color: var(--accent-2);
  }
</style>
