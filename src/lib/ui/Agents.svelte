<script lang="ts">
  // Which coding agents each device has, whether Foreman's rules are wired into them, and what each is running.
  import { app } from "$lib/app.svelte";
  import { fm } from "$lib/fm";
  import { AGENT } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

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
  const running = (dev: string, agent: string) => app.sessions.filter((s) => s.device === dev && s.agent === agent && s.live).length;
  async function wire(device: string, key: string, on = true) {
    await app.act(device, ["agents", on ? "install" : "uninstall", key, "--json"],
      on ? `Foreman's rules wired into ${AGENT[key].name}` : `Foreman taken out of ${AGENT[key].name}`);
    delete wiring[device];
  }
</script>

<div class="page">
  <div class="pagehead">
    <Icon name="cpu" size={15} />
    <h1>Agents</h1>
    <span class="t3 small">Coding agents on each device, and whether Foreman's rules apply to them</span>
  </div>
  <div class="body">
    {#each app.devices as d (d.id)}
      {@const st = app.st(d.id)}
      <section class="panel">
        <div class="dhead"><Bits kind="dot" status={st.status} /><span class="strong">{d.name}</span><span class="t3 mono small">{d.host ?? "this machine"}</span></div>
        <table>
          <thead><tr><th>Agent</th><th>Version</th><th>Foreman</th><th>Live</th><th></th></tr></thead>
          <tbody>
            {#each Object.keys(AGENT) as key}
              {@const a = st.agents.find((x) => x.agent === key)}
              {@const unknown = st.status !== "online" && !st.agents.length}
              {@const w = key === "claude" ? { installed: !!a?.installed, detail: "plugin" } : wiring[d.id]?.[key]}
              <tr class:off={!a?.installed}>
                <td><span class="name"><Bits kind="agent" agent={key} />{AGENT[key].name}</span></td>
                <td class="t2 mono small">{unknown ? "device offline" : a?.installed ? (a.version ?? "installed") : "not installed"}</td>
                <td class="small">
                  {#if !a?.installed}<span class="t3">—</span>
                  {:else if w?.installed}<span class="ok"><Icon name="shield" size={12} /> {w.detail ?? "wired"}</span>
                  {:else}<span class="t3">not wired</span>{/if}
                </td>
                <td class="small">{running(d.id, key) || ""}</td>
                <td class="act">
                  {#if a?.installed && key !== "claude" && !w?.installed}
                    <button class="btn" onclick={() => wire(d.id, key)}>Wire in Foreman</button>
                  {:else if key !== "claude" && w?.installed}
                    <button class="btn ghost" title="Take Foreman's hooks, MCP server and rules out of it" onclick={() => wire(d.id, key, false)}>Remove</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/each}
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .small {
    font-size: 12px;
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 16px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 1000px;
  }
  .dhead {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  .strong {
    font-weight: 500;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 14px;
    border-bottom: 1px solid var(--line);
  }
  td {
    padding: 8px 14px;
    border-bottom: 1px solid var(--line);
  }
  tr:last-child td {
    border-bottom: 0;
  }
  tr.off .name {
    color: var(--text-3);
  }
  .name {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .ok {
    color: var(--ok);
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }
  .act {
    text-align: right;
  }
</style>
