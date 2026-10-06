<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import { AGENT, base } from "$lib/types";
  import Icon from "./Icon.svelte";

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
    const out = await app.act(device, [...args, "--", message.trim()], "Session started");
    starting = false;
    if (out && typeof out === "object" && "id" in out) {
      close();
      app.view = { kind: "sessions", device, id: (out as { id: string }).id };
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && close()} />

<div class="scrim" transition:fade={{ duration: 180 }} onclick={close} role="presentation"></div>
<form class="sheet card" onsubmit={start} transition:fly={{ y: 24, duration: 320, opacity: 0 }}>
  <div class="head">
    <h2>New session</h2>
    <button type="button" class="x" onclick={close} aria-label="Close"><Icon name="x" /></button>
  </div>

  <label>Device
    <div class="pills">
      {#each app.devices as d}
        <button type="button" class="pill" class:sel={device === d.id} onclick={() => ((device = d.id), (cwd = ""))}>{d.name}</button>
      {/each}
    </div>
  </label>

  <label>Agent
    <div class="agents">
      {#each agents as a}
        {@const meta = AGENT[a.agent]}
        <button type="button" class="agent-card" class:sel={agent === a.agent} disabled={!a.installed}
          style="--c: {meta?.color}" onclick={() => ((agent = a.agent), (model = ""))}>
          <span class="mark">{meta?.mark}</span>
          <span class="aname">{meta?.name ?? a.agent}</span>
          <span class="aver">{a.installed ? (a.version ?? "installed") : "not installed"}</span>
        </button>
      {/each}
    </div>
  </label>

  <div class="two">
    <label>Folder
      <input list="projects" bind:value={cwd} placeholder="/path/to/repo" class="mono" />
      <datalist id="projects">
        {#each st.projects as p}<option value={p.root}>{base(p.root)}</option>{/each}
      </datalist>
    </label>
    <label>Model
      <input list="models" bind:value={model} placeholder="Agent's default" />
      <datalist id="models">
        {#each MODELS[agent] ?? [] as m}<option value={m}></option>{/each}
      </datalist>
    </label>
  </div>

  <label>First message
    <textarea bind:this={field} rows="5" bind:value={message} placeholder="What should it do? Foreman's rules apply in Foreman projects."
      onkeydown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && start(e)}></textarea>
  </label>

  <div class="foot">
    <span class="faint hint">Runs detached on {app.device(device)?.name}: it keeps going if you close the app.</span>
    <button class="go" disabled={starting || !message.trim() || !cwd.trim()}>
      {#if starting}<span class="spin"></span>{:else}<Icon name="play" size={14} />{/if}
      Start
    </button>
  </div>
</form>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(3, 3, 8, 0.6);
    backdrop-filter: blur(3px);
    z-index: 40;
  }
  .sheet {
    position: fixed;
    z-index: 41;
    left: 50%;
    top: 9vh;
    transform: translateX(-50%);
    width: min(640px, 92vw);
    padding: 22px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: #10101c;
    border-color: var(--line-2);
    box-shadow: 0 40px 120px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(141, 125, 255, 0.12);
  }
  .head {
    display: flex;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 19px;
    flex: 1;
  }
  .x {
    border: 0;
    background: none;
    color: var(--dim);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 7px;
    font-size: 12px;
    font-weight: 600;
    color: var(--dim);
    letter-spacing: 0.02em;
  }
  .pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pill {
    padding: 6px 12px;
    border-radius: 99px;
    border: 1px solid var(--line-2);
    background: var(--panel);
    color: var(--dim);
    font-weight: 500;
    transition: all 0.2s;
  }
  .pill.sel {
    background: var(--grad-soft);
    border-color: rgba(141, 125, 255, 0.45);
    color: var(--text);
  }
  .agents {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .agent-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 11px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--panel);
    text-align: left;
    transition: all 0.25s var(--ease);
  }
  .agent-card:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: var(--line-2);
  }
  .agent-card.sel {
    border-color: color-mix(in srgb, var(--c) 60%, transparent);
    background: color-mix(in srgb, var(--c) 9%, transparent);
    box-shadow: 0 8px 26px -12px color-mix(in srgb, var(--c) 70%, transparent);
  }
  .agent-card:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .mark {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 12px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, transparent);
    margin-bottom: 4px;
  }
  .aname {
    font-weight: 650;
    color: var(--text);
    font-size: 13px;
  }
  .aver {
    font-weight: 400;
    color: var(--faint);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 200px;
    gap: 12px;
  }
  input,
  textarea {
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.3);
    outline: none;
    font-weight: 400;
    color: var(--text);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  textarea {
    resize: vertical;
    font-size: 14px;
  }
  input:focus,
  textarea:focus {
    border-color: rgba(141, 125, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(141, 125, 255, 0.14);
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hint {
    flex: 1;
    font-size: 12px;
  }
  .go {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    border: 0;
    border-radius: 11px;
    background: var(--grad);
    color: #0b0b14;
    font-weight: 700;
    transition: transform 0.2s var(--spring);
  }
  .go:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.02);
  }
  .go:disabled {
    opacity: 0.4;
  }
  .spin {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-top-color: #0b0b14;
    animation: r 0.7s linear infinite;
  }
  @keyframes r {
    to { transform: rotate(360deg); }
  }
</style>
