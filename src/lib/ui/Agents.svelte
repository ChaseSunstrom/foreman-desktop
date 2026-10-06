<script lang="ts">
  import { fly } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import { fm } from "$lib/fm";
  import { AGENT } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  // What each agent gets from Foreman on a device: Claude Code has the plugin; the others get it through
  // `fm agents install` where that command exists (it reports per agent), else they run sessions without its rules.
  type Wiring = Record<string, { installed: boolean; detail?: string }>;
  let wiring = $state<Record<string, Wiring | null>>({});
  $effect(() => {
    for (const d of app.devices) {
      if (d.id in wiring) continue;
      wiring[d.id] = null;
      fm<{ agents: { agent: string; installed: boolean; detail?: string }[] }>(d, ["agents", "list", "--json"])
        .then((o) => (wiring[d.id] = Object.fromEntries(o.agents.map((a) => [a.agent, a]))))
        .catch(() => (wiring[d.id] = {}));
    }
  });
  const running = (dev: string, agent: string) =>
    app.st(dev).sessions.filter((s) => s.agent === agent && (s.status === "running" || s.status === "starting")).length;
</script>

<div class="page">
  <header in:fly={{ y: 8 }}>
    <h1>Agents</h1>
    <p class="dim">Which coding agents each device has, whether Foreman's discipline is wired into them, and what they're running.</p>
  </header>

  {#each app.devices as d, di (d.id)}
    {@const st = app.st(d.id)}
    <section class="card" in:fly={{ y: 12, delay: 60 * di }}>
      <div class="dev">
        <Bits kind="dot" status={st.status} />
        <span class="dname">{d.name}</span>
        <span class="faint mono">{d.host ?? "local"}</span>
      </div>
      <div class="grid">
        {#each Object.keys(AGENT) as key, i}
          {@const a = st.agents.find((x) => x.agent === key)}
          {@const meta = AGENT[key]}
          {@const w = key === "claude" ? { installed: !!a?.installed, detail: "plugin" } : wiring[d.id]?.[key]}
          {@const unknown = st.status !== "online" && !st.agents.length}
          <div class="agent" class:off={!a?.installed || unknown} style="--c: {meta.color}" in:fly={{ y: 10, delay: 60 * di + 40 * i }}>
            <div class="top">
              <span class="mark">{meta.mark}</span>
              <div>
                <div class="aname">{meta.name}</div>
                <div class="faint ver">{unknown ? "device offline" : a?.installed ? (a.version ?? "installed") : "not installed"}</div>
              </div>
              {#if running(d.id, key)}
                <span class="run"><Bits kind="spinner" size={12} /> {running(d.id, key)}</span>
              {/if}
            </div>
            <div class="wire" class:ok={w?.installed}>
              <Icon name={w?.installed ? "shield" : "link"} size={13} />
              {#if unknown}Unknown until the device is reachable
              {:else if !a?.installed}Install it on this device to use it
              {:else if w?.installed}Foreman: {w.detail ?? "wired in"}
              {:else}Foreman not wired in yet{/if}
            </div>
            {#if a?.installed && key !== "claude"}
              <button class="wire-btn" disabled={w?.installed}
                onclick={async () => {
                  await app.act(d.id, ["agents", "install", key, "--json"], `Foreman wired into ${meta.name}`);
                  delete wiring[d.id];
                }}>
                {w?.installed ? "Wired" : "Wire Foreman in"}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .page {
    padding: 30px 38px 40px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 1200px;
  }
  h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.025em;
  }
  header p {
    margin: 6px 0 0;
  }
  section {
    padding: 18px 20px 20px;
  }
  .dev {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .dname {
    font-weight: 650;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .agent {
    padding: 14px;
    border-radius: 13px;
    border: 1px solid color-mix(in srgb, var(--c) 25%, transparent);
    background: linear-gradient(160deg, color-mix(in srgb, var(--c) 9%, transparent), transparent 70%);
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: transform 0.25s var(--ease);
  }
  .agent:hover {
    transform: translateY(-2px);
  }
  .agent.off {
    filter: grayscale(0.8);
    opacity: 0.55;
  }
  .top {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .mark {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-weight: 800;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, transparent);
  }
  .aname {
    font-weight: 650;
  }
  .ver {
    font-size: 11.5px;
  }
  .run {
    margin-left: auto;
    display: inline-flex;
    gap: 5px;
    align-items: center;
    font-size: 12px;
    color: var(--accent-2);
  }
  .wire {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: var(--dim);
  }
  .wire.ok {
    color: var(--ok);
  }
  .wire-btn {
    padding: 6px 10px;
    border-radius: 9px;
    border: 1px solid var(--line-2);
    background: var(--panel-2);
    font-size: 12px;
  }
  .wire-btn:disabled {
    opacity: 0.5;
  }
</style>
