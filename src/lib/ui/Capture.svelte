<script lang="ts">
  // An idea, a bug or a request into any project's inbox, from anywhere (Ctrl Shift C): fm capture on its device.
  import { fade, fly } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import { base } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  const TYPES = [["FEATURE", "Feature"], ["FIX", "Fix"], ["CLEAN", "Clean"], ["PERFORMANCE", "Perf"], ["SECURITY", "Security"], ["RESEARCH", "Research"]];
  const projects = $derived(
    app.devices.flatMap((d) => app.st(d.id).projects.map((p) => ({ key: `${d.id}/${p.project}`, device: d.id, slug: p.project, name: base(p.root), dev: d.name }))),
  );
  const v = app.view;
  // the project on screen, else the first one; then it's the user's to change
  let target = $state(v.kind === "project" ? `${v.device}/${v.slug}` : "");
  $effect(() => {
    if (!projects.some((p) => p.key === target) && projects[0]) target = projects[0].key;
  });
  let type = $state("FEATURE");
  let tier = $state("");
  let urgent = $state(false);
  let text = $state("");
  let busy = $state(false);
  let field: HTMLTextAreaElement | undefined = $state();
  $effect(() => field?.focus());

  const close = () => (app.capture = false);
  async function save(e: Event) {
    e.preventDefault();
    const p = projects.find((x) => x.key === target);
    if (!p || !text.trim()) return;
    busy = true;
    const args = ["-p", p.slug, "capture", "--json", "--type", type, ...(tier ? ["--tier", tier] : []), ...(urgent ? ["--urgent"] : []), "--", text.trim()];
    const out = await app.act<{ id: string }>(p.device, args);
    busy = false;
    if (out && typeof out === "object" && "id" in out) {
      close();
      app.toast("ok", `Captured as ${out.id} in ${p.name}`, {
        label: "Open", run: () => (app.view = { kind: "project", device: p.device, slug: p.slug, tab: "inbox" }),
      });
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && close()} />

<div class="scrim" transition:fade={{ duration: 100 }} onclick={close} role="presentation"></div>
<form class="sheet panel" onsubmit={save} transition:fly={{ y: 10, duration: 160 }}>
  <div class="head">
    <h2>Capture</h2>
    <span class="grow"></span>
    <button type="button" class="btn icon ghost" onclick={close} aria-label="Close"><Icon name="x" size={14} /></button>
  </div>
  <div class="body">
    <label class="field">
      <span class="label">Project</span>
      <select class="input" bind:value={target}>
        {#each projects as p (p.key)}<option value={p.key}>{p.name}{app.devices.length > 1 ? ` · ${p.dev}` : ""}</option>{/each}
      </select>
    </label>
    <div class="field">
      <span class="label">Kind</span>
      <div class="segs">
        {#each TYPES as [t, label]}<button type="button" class:on={type === t} onclick={() => (type = t)}>{label}</button>{/each}
      </div>
    </div>
    <div class="field">
      <span class="label">Size</span>
      <div class="segs">
        {#each [["", "Let Foreman guess"], ["S", "Small"], ["M", "Medium"], ["L", "Large"]] as [t, label]}
          <button type="button" class:on={tier === t} onclick={() => (tier = t)}>{label}</button>
        {/each}
        <button type="button" class:on={urgent} onclick={() => (urgent = !urgent)} title="goes first in the queue">Urgent</button>
      </div>
    </div>
    <label class="field">
      <span class="label">What</span>
      <textarea class="input" bind:this={field} rows="5" bind:value={text} placeholder="An idea, a bug, a request: it goes to the inbox, nothing starts"
        onkeydown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && save(e)}></textarea>
    </label>
  </div>
  <div class="foot">
    <span class="t3 small">fm capture on {projects.find((p) => p.key === target)?.dev ?? "the device"}; Foreman plans it when it comes up.</span>
    <button class="btn primary" disabled={busy || !text.trim() || !target}>
      {#if busy}<Bits kind="spinner" size={11} />{:else}<Icon name="plus" size={12} />{/if} Capture <span class="kbd dark">Ctrl ↵</span></button>
  </div>
</form>
