<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { app } from "$lib/app.svelte";
  import Sidebar from "$lib/ui/Sidebar.svelte";
  import Overview from "$lib/ui/Overview.svelte";
  import ProjectView from "$lib/ui/ProjectView.svelte";
  import Sessions from "$lib/ui/Sessions.svelte";
  import Agents from "$lib/ui/Agents.svelte";
  import Devices from "$lib/ui/Devices.svelte";
  import NewSession from "$lib/ui/NewSession.svelte";
  import Toasts from "$lib/ui/Toasts.svelte";

  // a session switch keeps the sessions page (its list stays put); a project switch is a new page
  const key = $derived(app.view.kind === "project" ? `p:${app.view.device}:${app.view.slug}` : app.view.kind);
</script>

<svelte:window onkeydown={(e) => (e.ctrlKey || e.metaKey) && e.key === "n" && (e.preventDefault(), (app.newSession = {}))} />

<div class="shell">
  <Sidebar />
  <main>
    {#key key}
      <div class="view" in:fly={{ y: 10, duration: 380, delay: 90 }} out:fade={{ duration: 90 }}>
        {#if app.view.kind === "home"}
          <Overview />
        {:else if app.view.kind === "project"}
          <ProjectView device={app.view.device} slug={app.view.slug} />
        {:else if app.view.kind === "sessions"}
          <Sessions device={app.view.device} id={app.view.id} />
        {:else if app.view.kind === "agents"}
          <Agents />
        {:else if app.view.kind === "devices"}
          <Devices />
        {/if}
      </div>
    {/key}
  </main>
</div>

{#if app.newSession}
  <NewSession device={app.newSession.device} cwd={app.newSession.cwd} />
{/if}
<Toasts />

<style>
  .shell {
    display: grid;
    grid-template-columns: 272px 1fr;
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
    overflow: auto;
  }
</style>
