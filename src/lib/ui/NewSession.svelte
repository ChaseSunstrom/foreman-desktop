<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import { AGENT, base } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  let { device: dev0, cwd: cwd0 }: { device?: string; cwd?: string } = $props();
  // the sheet opens with these and then they're the user's to change
  // svelte-ignore state_referenced_locally
  let device = $state(dev0 ?? app.devices[0]?.id ?? "local");
  // svelte-ignore state_referenced_locally
  let cwd = $state(cwd0 ?? "");
  let agent = $state("claude");
  let model = $state("");
  let message = $state("");
  let starting = $state(false);
  let field: HTMLTextAreaElement | undefined = $state();

  const st = $derived(app.st(device));
  const agents = $derived(st.agents.length ? st.agents : Object.keys(AGENT).map((a) => ({ agent: a, installed: a === "claude", version: null, path: null })));
  $effect(() => {
    if (!cwd && st.projects[0]) cwd = st.projects[0].root;
  });
  $effect(() => field?.focus());
  const MODELS: Record<string, string[]> = { claude: ["opus", "sonnet", "haiku"] }; // others: whatever their CLI takes

  const close = () => (app.newSession = null);
  async function start(e: Event) {
    e.preventDefault();
    if (!message.trim() || !cwd.trim()) return;
    starting = true;
    const args = ["session", "start", "--agent", agent, "--cwd", cwd.trim(), "--json"];
    if (model.trim()) args.push("--model", model.trim());
    const out = await app.act<{ id: string }>(device, [...args, "--", message.trim()], "Session started");
    starting = false;
    if (out && typeof out === "object" && "id" in out) {
      close();
      app.view = { kind: "sessions", device, id: out.id, source: "fm" };
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && close()} />

<div class="scrim" transition:fade={{ duration: 100 }} onclick={close} role="presentation"></div>
<form class="sheet panel" onsubmit={start} transition:fly={{ y: 10, duration: 160 }}>
  <div class="head">
    <h2>New session</h2>
    <span class="grow"></span>
    <button type="button" class="btn icon ghost" onclick={close} aria-label="Close"><Icon name="x" size={14} /></button>
  </div>

  <div class="body">
    <div class="field">
      <span class="label">Device</span>
      <div class="segs">
        {#each app.devices as d}
          <button type="button" class:on={device === d.id} onclick={() => ((device = d.id), (cwd = ""))}>
            <Bits kind="dot" status={app.st(d.id).status} />{d.name}</button>
        {/each}
      </div>
    </div>

    <div class="field">
      <span class="label">Agent</span>
      <div class="segs">
        {#each agents as a}
          <button type="button" class:on={agent === a.agent} disabled={!a.installed}
            title={a.installed ? (a.version ?? "") : "not installed on this device"} onclick={() => ((agent = a.agent), (model = ""))}>
            <Bits kind="agent" agent={a.agent} size={16} />{AGENT[a.agent]?.name ?? a.agent}</button>
        {/each}
      </div>
    </div>

    <div class="two">
      <label class="field">
        <span class="label">Folder</span>
        <input class="input mono" list="np-projects" bind:value={cwd} placeholder="/path/to/repo" />
        <datalist id="np-projects">{#each st.projects as p}<option value={p.root}>{base(p.root)}</option>{/each}</datalist>
      </label>
      <label class="field">
        <span class="label">Model</span>
        <input class="input" list="np-models" bind:value={model} placeholder="the agent's default" />
        <datalist id="np-models">{#each MODELS[agent] ?? [] as m}<option value={m}></option>{/each}</datalist>
      </label>
    </div>

    <label class="field">
      <span class="label">First message</span>
      <textarea class="input" bind:this={field} rows="6" bind:value={message}
        placeholder="What should it do? In a Foreman project, Foreman's rules apply."
        onkeydown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && start(e)}></textarea>
    </label>
  </div>

  <div class="foot">
    <span class="t3 small">Runs detached on {app.device(device)?.name}; it keeps going if you close the app.</span>
    <button class="btn primary" disabled={starting || !message.trim() || !cwd.trim()}>
      {#if starting}<Bits kind="spinner" size={11} />{:else}<Icon name="play" size={12} />{/if} Start <span class="kbd dark">Ctrl ↵</span></button>
  </div>
</form>
