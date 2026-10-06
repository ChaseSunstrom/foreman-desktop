<script lang="ts">
  import { fly, slide } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { invoke } from "@tauri-apps/api/core";
  import { app, hostProblem } from "$lib/app.svelte";
  import Icon from "./Icon.svelte";
  import Bits from "./Bits.svelte";

  type Peer = { name: string; dns: string; online: boolean; os: string };
  let peers = $state<Peer[]>([]);
  let name = $state("");
  let host = $state("");
  let tried = $state(false);
  const problem = $derived(tried ? hostProblem(host) : null);
  invoke<Peer[]>("tailscale_peers").then((p) => (peers = p)).catch(() => {});

  const known = (h: string) => app.devices.some((d) => d.host === h);

  // an unknown host key stops ssh (StrictHostKeyChecking=yes): the user compares its fingerprint and trusts it here
  type Key = { fingerprint: string; line: string };
  let trust = $state<null | { id: string; host: string; keys: Key[] | null; error?: string }>(null);
  const unknownKey = (e?: string) => !!e && /Host key verification failed|No .* host key is known/i.test(e);
  const changedKey = (e?: string) => !!e && /IDENTIFICATION HAS CHANGED|host key .* changed/i.test(e);
  async function scan(id: string, host: string) {
    trust = { id, host, keys: null };
    try {
      trust.keys = await invoke<Key[]>("host_key_scan", { host });
    } catch (e) {
      trust.error = String(e);
    }
  }
  async function doTrust() {
    if (!trust?.keys) return;
    try {
      await invoke("host_key_trust", { host: trust.host, lines: trust.keys.map((k) => k.line) });
      const d = app.device(trust.id);
      trust = null;
      if (d) app.connect(d);
      app.toast("ok", "Host key trusted; connecting");
    } catch (e) {
      if (trust) trust.error = String(e);
    }
  }
  function add(e?: Event, n = name, h = host) {
    e?.preventDefault();
    tried = true;
    if (hostProblem(h) || !app.addDevice(n.trim(), h.trim())) return;
    tried = false;
    app.toast("info", `Connecting to ${n || h}…`);
    name = host = "";
  }
</script>

<div class="page">
  <header in:fly={{ y: 8 }}>
    <h1>Devices</h1>
    <p class="dim">Each device runs Foreman; the app reaches the others over ssh (Tailscale SSH works), never through a new server.</p>
  </header>

  <div class="list">
    {#each app.devices as d (d.id)}
      {@const st = app.st(d.id)}
      <div class="card dev" animate:flip={{ duration: 300 }} in:fly={{ y: 10 }} out:slide>
        <Bits kind="dot" status={st.status} />
        <div class="dmeta">
          <div class="dname">{d.name}</div>
          <div class="faint mono">{d.host ?? "this machine"}</div>
        </div>
        <div class="nums">
          <span><b>{st.projects.length}</b> projects</span>
          <span><b>{st.sessions.length}</b> sessions</span>
          <span><b>{st.agents.filter((a) => a.installed).length}</b> agents</span>
        </div>
        {#if st.status === "offline" && changedKey(st.error)}
          <span class="err strong">Its host key changed: check the device before trusting it again (ssh-keygen -R)</span>
        {:else if st.status === "offline" && unknownKey(st.error) && d.host}
          <button class="trust" onclick={() => scan(d.id, d.host!)}><Icon name="shield" size={13} /> Trust this device…</button>
        {:else if st.status === "offline"}<span class="err" title={st.error}>{st.error?.slice(0, 80)}</span>{/if}
        <button class="icon-btn" title="Reconnect" onclick={() => app.connect(d)}><Icon name="refresh" size={14} /></button>
        {#if d.id !== "local"}
          <button class="icon-btn" title="Remove" onclick={() => app.removeDevice(d.id)}><Icon name="trash" size={14} /></button>
        {/if}
      </div>
    {/each}
  </div>

  <form class="card add" onsubmit={add} in:fly={{ y: 10, delay: 80 }}>
    <div class="card-title"><Icon name="plus" size={14} /> Add a device</div>
    <div class="row">
      <input placeholder="Name (optional)" bind:value={name} />
      <input class="mono" placeholder="ssh host — user@box or a Tailscale name" bind:value={host} />
      <button class="go" disabled={!host.trim()}>Add</button>
    </div>
    {#if problem}<div class="bad-note" transition:slide>{problem}</div>{/if}
    <div class="faint note">It needs Foreman installed (its install.sh) and key-based ssh; nothing listens on a new port.
      A device whose host key you haven't trusted yet asks you to compare its fingerprint first.</div>
  </form>

  {#if trust}
    <div class="card trust-card" transition:slide>
      <div class="card-title"><Icon name="shield" size={14} /> Trust {trust.host}?</div>
      {#if trust.error}
        <div class="bad-note">{trust.error}</div>
      {:else if !trust.keys}
        <div class="faint">Asking the device for its host keys…</div>
      {:else}
        <p class="dim">Compare these with the device's own (<span class="mono">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</span>
          on it). Trust them only if they match: from then on ssh refuses anything else.</p>
        <ul class="keys">{#each trust.keys as k}<li class="mono">{k.fingerprint}</li>{/each}</ul>
        <div class="row">
          <button class="go" onclick={doTrust}>They match: trust</button>
          <button class="mini" onclick={() => (trust = null)}>Cancel</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if peers.length}
    <div class="card add" in:fly={{ y: 10, delay: 140 }}>
      <div class="card-title"><Icon name="wifi" size={14} /> On your tailnet</div>
      <div class="peers">
        {#each peers as p}
          <div class="peer" class:off={!p.online}>
            <Bits kind="dot" status={p.online ? "online" : "stopped"} />
            <span class="pname">{p.name}</span>
            <span class="faint">{p.os}</span>
            <button class="mini" disabled={known(p.dns)} onclick={() => add(undefined, p.name, p.dns)}>
              {known(p.dns) ? "Added" : "Add"}
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 30px 38px 40px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 1100px;
  }
  h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.025em;
  }
  header p {
    margin: 6px 0 0;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dev {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
  }
  .dmeta {
    flex: 1;
  }
  .dname {
    font-weight: 650;
  }
  .nums {
    display: flex;
    gap: 16px;
    color: var(--dim);
    font-size: 12.5px;
  }
  .nums b {
    color: var(--text);
  }
  .err {
    color: var(--bad);
    font-size: 12px;
    max-width: 260px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--dim);
    display: grid;
    place-items: center;
  }
  .icon-btn:hover {
    color: var(--text);
  }
  .add {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row {
    display: flex;
    gap: 10px;
  }
  input {
    flex: 1;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.3);
    outline: none;
  }
  input:focus {
    border-color: rgba(141, 125, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(141, 125, 255, 0.14);
  }
  .go {
    padding: 0 20px;
    border: 0;
    border-radius: 10px;
    background: var(--grad);
    color: #0b0b14;
    font-weight: 700;
  }
  .go:disabled {
    opacity: 0.4;
  }
  .note {
    font-size: 12px;
  }
  .trust {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 6px 11px;
    border-radius: 9px;
    border: 1px solid rgba(251, 191, 36, 0.4);
    background: rgba(251, 191, 36, 0.1);
    color: var(--warn);
    font-size: 12.5px;
  }
  .err.strong {
    max-width: 380px;
    white-space: normal;
  }
  .trust-card {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-color: rgba(251, 191, 36, 0.3);
  }
  .trust-card p {
    margin: 0;
    font-size: 13px;
  }
  .keys {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
  }
  .bad-note {
    font-size: 12.5px;
    color: var(--bad);
  }
  .peers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 8px;
  }
  .peer {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--panel);
  }
  .peer.off {
    opacity: 0.55;
  }
  .pname {
    flex: 1;
    font-weight: 550;
  }
  .mini {
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid var(--line-2);
    background: var(--panel-2);
    font-size: 12px;
  }
  .mini:disabled {
    opacity: 0.45;
  }
</style>
