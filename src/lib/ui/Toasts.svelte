<script lang="ts">
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { app } from "$lib/app.svelte";
  import Icon from "./Icon.svelte";
</script>

<div class="toasts">
  {#each app.toasts as t (t.id)}
    <div class="toast {t.kind}" animate:flip={{ duration: 150 }} in:fly={{ y: 8, duration: 160 }} out:fly={{ x: 20, duration: 140 }}>
      <span class="ic"><Icon name={t.kind === "ok" ? "check" : t.kind === "bad" ? "alert" : "dot"} size={14} /></span>
      <span class="text">{t.text}</span>
      {#if t.action}<button class="btn" onclick={() => { t.action!.run(); app.toasts = app.toasts.filter((x) => x.id !== t.id); }}>{t.action.label}</button>{/if}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
    pointer-events: none;
  }
  .toast {
    display: flex;
    gap: 9px;
    align-items: center;
    max-width: 440px;
    padding: 8px 10px 8px 12px;
    border-radius: var(--r);
    background: var(--surface-2);
    border: 1px solid var(--line-2);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    font-size: 12.5px;
    pointer-events: auto;
  }
  .ic {
    display: grid;
  }
  .ok .ic {
    color: var(--ok);
  }
  .bad .ic {
    color: var(--bad);
  }
  .info .ic {
    color: var(--accent);
  }
  .text {
    overflow-wrap: anywhere;
  }
</style>
