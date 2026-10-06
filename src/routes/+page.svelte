<script lang="ts">
  import { fade } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import Sidebar from "$lib/ui/Sidebar.svelte";
  import Overview from "$lib/ui/Overview.svelte";
  import ProjectView from "$lib/ui/ProjectView.svelte";
  import Sessions from "$lib/ui/Sessions.svelte";
  import Remote from "$lib/ui/Remote.svelte";
  import Agents from "$lib/ui/Agents.svelte";
  import Devices from "$lib/ui/Devices.svelte";
  import NewSession from "$lib/ui/NewSession.svelte";
  import Palette from "$lib/ui/Palette.svelte";
  import Toasts from "$lib/ui/Toasts.svelte";

  // switching sessions keeps the sessions page (its list stays put); a project (or its tab) is a page of its own
  const key = $derived(app.view.kind === "project" ? `p:${app.view.device}:${app.view.slug}:${app.view.tab ?? ""}` : app.view.kind);

  function keys(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k") (e.preventDefault(), (app.palette = !app.palette));
    else if (mod && e.key.toLowerCase() === "n") (e.preventDefault(), (app.newSession = {}));
  }
</script>

<svelte:window onkeydown={keys} />

<div class="shell">
  <Sidebar />
  <main>
    {#key key}
      <div class="view" in:fade={{ duration: 120 }}>
        {#if app.view.kind === "home"}
          <Overview />
        {:else if app.view.kind === "project"}
          <ProjectView device={app.view.device} slug={app.view.slug} tab={app.view.tab} />
        {:else if app.view.kind === "sessions"}
          <Sessions device={app.view.device} id={app.view.id} source={app.view.source} />
        {:else if app.view.kind === "remote"}
          <Remote />
        {:else if app.view.kind === "agents"}
          <Agents />
        {:else if app.view.kind === "devices"}
          <Devices />
        {/if}
      </div>
    {/key}
  </main>
</div>

{#if app.newSession}<NewSession device={app.newSession.device} cwd={app.newSession.cwd} />{/if}
{#if app.palette}<Palette />{/if}
<Toasts />

<style>
  .shell {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    height: 100vh;
  }
  main {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .view {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
</style>
