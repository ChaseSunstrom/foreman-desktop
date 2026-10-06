<script lang="ts">
  import { slide } from "svelte/transition";
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
  <div class="pagehead">
    <Icon name="server" size={15} />
    <h1>Devices</h1>
    <span class="t3 small">This machine, and others reached over ssh (Tailscale SSH works). Nothing listens on a new port.</span>
  </div>
  <div class="body">
    <section class="panel">
      {#each app.devices as d (d.id)}
        {@const st = app.st(d.id)}
        <div class="dev">
          <Bits kind="dot" status={st.status} />
          <div class="dmain">
            <div class="strong">{d.name}</div>
            <div class="t3 mono small">{d.host ?? "this machine"}</div>
          </div>
          <span class="t2 small nums">{st.projects.length} projects · {st.claude.length} Claude sessions · {st.agents.filter((a) => a.installed).length} agents</span>
          {#if st.status === "offline" && changedKey(st.error)}
            <span class="err small">Host key changed: check the device before trusting it again (ssh-keygen -R)</span>
          {:else if st.status === "offline" && unknownKey(st.error) && d.host}
            <button class="btn" onclick={() => scan(d.id, d.host!)}><Icon name="shield" size={13} /> Trust this device…</button>
          {:else if st.status === "offline"}
            <span class="err small ellipsis" title={st.error}>{st.error}</span>
          {/if}
          <button class="btn icon ghost" title="Reconnect" onclick={() => app.connect(d)}><Icon name="refresh" size={13} /></button>
          {#if d.id !== "local"}<button class="btn icon ghost" title="Remove" onclick={() => app.removeDevice(d.id)}><Icon name="trash" size={13} /></button>{/if}
        </div>
        {#if st.health}
          {@const bad = st.health.results.filter((r) => r.status !== "PASS")}
          <div class="health">
            <span class={st.health.ok ? "okc" : "badc"}><Icon name={st.health.ok ? "check" : "x"} size={11} stroke={2.6} /></span>
            <span class="small">{st.health.ok ? "Foreman is healthy" : "Foreman has a problem"} · {st.health.results.length - bad.length} of {st.health.results.length} checks pass</span>
            <button class="btn ghost small" onclick={() => app.checkHealth(d)}>Check again</button>
          </div>
          {#each bad as r}
            <div class="hrow small"><span class={r.status === "FAIL" ? "bad" : "warn"}>{r.status.toLowerCase()}</span><span class="strong">{r.name}</span><span class="t3 ellipsis" title={r.detail}>{r.detail}</span></div>
          {/each}
        {/if}
      {/each}
    </section>

    {#if trust}
      <section class="panel pad trust" transition:slide={{ duration: 140 }}>
        <div class="strong">Trust {trust.host}?</div>
        {#if trust.error}<div class="err small">{trust.error}</div>
        {:else if !trust.keys}<div class="t3">Asking the device for its host keys…</div>
        {:else}
          <p class="t2 small">Compare these with the device's own (<span class="mono">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</span> on it).
            Trust them only if they match: from then on ssh refuses anything else.</p>
          <ul class="keys mono small">{#each trust.keys as k}<li>{k.fingerprint}</li>{/each}</ul>
          <div class="row"><button class="btn primary" onclick={doTrust}>They match — trust</button><button class="btn ghost" onclick={() => (trust = null)}>Cancel</button></div>
        {/if}
      </section>
    {/if}

    <form class="panel pad add" onsubmit={add}>
      <div class="label">Add a device</div>
      <div class="row">
        <input class="input" placeholder="Name (optional)" bind:value={name} />
        <input class="input mono grow" placeholder="ssh host — user@box or a Host alias" bind:value={host} />
        <button class="btn primary" disabled={!host.trim()}>Add</button>
      </div>
      {#if problem}<div class="err small" transition:slide>{problem}</div>{/if}
      <div class="t3 small">It needs Foreman installed (install.sh) and key-based ssh from here. A device whose host key you haven't trusted yet asks you to compare fingerprints first.</div>
    </form>

    {#if peers.length}
      <section class="panel pad">
        <div class="label">On your tailnet</div>
        <div class="peers">
          {#each peers as p}
            <div class="peer" class:off={!p.online}>
              <Bits kind="dot" status={p.online ? "online" : "stopped"} />
              <span class="grow ellipsis">{p.name}</span>
              <span class="t3 small">{p.os}</span>
              <button class="btn" disabled={known(p.dns)} onclick={() => add(undefined, p.name, p.dns)}>{known(p.dns) ? "Added" : "Add"}</button>
            </div>
          {/each}
        </div>
      </section>
    {/if}
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
  .pad {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dev {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  .dev:last-child {
    border-bottom: 0;
  }
  .dmain {
    min-width: 140px;
  }
  .strong {
    font-weight: 500;
  }
  .nums {
    flex: 1;
  }
  .err {
    color: var(--bad);
    max-width: 360px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  .keys {
    margin: 0;
    padding-left: 18px;
  }
  .trust p {
    margin: 0;
  }
  .peers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 6px;
  }
  .peer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--r-sm);
    background: var(--surface);
  }
  .peer.off {
    opacity: 0.6;
  }
  .health {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px 10px 40px;
  }
  .hrow {
    display: grid;
    grid-template-columns: 40px 140px minmax(0, 1fr);
    gap: 8px;
    padding: 2px 16px 2px 40px;
  }
  .hrow:last-of-type {
    padding-bottom: 10px;
  }
  .okc,
  .badc {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: inline-grid;
    place-items: center;
  }
  .okc {
    color: var(--ok);
    background: rgba(79, 174, 126, 0.12);
  }
  .badc,
  .bad {
    color: var(--bad);
  }
  .badc {
    background: rgba(229, 83, 75, 0.12);
  }
  .warn {
    color: var(--warn);
  }
</style>
