<script lang="ts">
  // A Claude session's scratchpad: every file (newest first), with a preview of text and images.
  import { onMount } from "svelte";
  import { fm, type Device } from "$lib/fm";
  import { ago, bytes, type ScratchFile } from "$lib/types";
  import { scratchImage } from "./media";
  import Icon from "./Icon.svelte";

  let { device, sid, onimage }: { device: Device; sid: string; onimage?: (src: string) => void } = $props();
  let root = $state("");
  let files = $state<ScratchFile[] | null>(null);
  let truncated = $state(false);
  let all = $state(false);
  let err = $state<string | null>(null);
  let q = $state("");
  let sel = $state<ScratchFile | null>(null);
  let preview = $state<{ text?: string; src?: string; truncated?: boolean; error?: string } | null>(null);

  async function load() {
    try {
      const o = await fm<{ root: string; files: ScratchFile[]; truncated: boolean }>(device, ["claude", "files", sid, "--json"]);
      root = o.root;
      truncated = o.truncated;
      files = o.files.sort((a, b) => b.mtime - a.mtime);
    } catch (e) {
      err = String(e);
    }
  }
  onMount(load);
  const matching = $derived((files ?? []).filter((f) => !q || f.path.toLowerCase().includes(q.toLowerCase())));
  const shown = $derived(all ? matching : matching.slice(0, 500));

  async function pick(f: ScratchFile) {
    sel = f;
    preview = null;
    try {
      if (f.kind === "image") preview = { src: await scratchImage(device, sid, f.path, f.mtime) };
      else {
        const o = await fm<{ text: string; truncated: boolean }>(device, ["claude", "file", sid, f.path, "--json"]);
        preview = { text: o.text, truncated: o.truncated };
      }
    } catch (e) {
      preview = { error: String(e) };
    }
  }
</script>

<div class="files">
  <div class="list">
    <div class="tools">
      <input class="input" placeholder="Filter {files?.length ?? 0} files" bind:value={q} />
      <button class="btn icon ghost" title="Refresh" onclick={load}><Icon name="refresh" size={13} /></button>
    </div>
    <div class="mono t3 root ellipsis" title={root}>{root}</div>
    <div class="rows">
      {#if err}<div class="empty bad">{err}</div>
      {:else if files === null}<div class="empty">Loading…</div>
      {:else}
        {#each shown as f (f.path)}
          <button class="row" class:on={sel?.path === f.path} onclick={() => pick(f)}>
            <Icon name={f.kind === "image" ? "image" : f.kind === "link" ? "link" : "file"} size={13} />
            <span class="ellipsis name" title={f.path}>{f.path}</span>
            <span class="t3 small">{bytes(f.size)}</span>
            <span class="t3 small age">{ago(f.mtime * 1000)}</span>
          </button>
        {:else}<div class="empty">{files.length ? "No match." : "This session's scratchpad is empty."}</div>{/each}
        {#if matching.length > shown.length}<button class="btn ghost more" onclick={() => (all = true)}>Show all {matching.length}</button>{/if}
        {#if truncated}<div class="t3 small note">Listing stops at 2000 files; filter to find others.</div>{/if}
      {/if}
    </div>
  </div>
  <div class="preview">
    {#if !sel}<div class="empty">Pick a file to preview it.</div>
    {:else if !preview}<div class="empty">Loading…</div>
    {:else if preview.error}<div class="empty bad">{preview.error}</div>
    {:else if preview.src}<button class="imgbtn" onclick={() => onimage?.(preview!.src!)}><img src={preview.src} alt={sel.path} /></button>
    {:else}<pre>{preview.text}</pre>{#if preview.truncated}<div class="t3 small trunc">Showing the first 2 MB.</div>{/if}{/if}
  </div>
</div>

<style>
  .files {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(260px, 38%) 1fr;
  }
  .list {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--line);
  }
  .tools {
    display: flex;
    gap: 6px;
    padding: 10px 12px 6px;
  }
  .tools .input {
    flex: 1;
  }
  .root {
    padding: 0 12px 8px;
    font-size: 11px;
  }
  .rows {
    flex: 1;
    overflow: auto;
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 12px;
    border: 0;
    background: none;
    text-align: left;
    color: var(--text-2);
  }
  .row:hover {
    background: var(--surface);
    color: var(--text);
  }
  .row.on {
    background: var(--surface-2);
    color: var(--text);
  }
  .name {
    flex: 1;
    font-size: 12.5px;
  }
  .small {
    font-size: 11.5px;
    white-space: nowrap;
  }
  .age {
    width: 26px;
    text-align: right;
  }
  .more {
    margin: 8px 12px;
  }
  .note {
    padding: 4px 12px 10px;
  }
  .preview {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 12px 16px;
  }
  .preview img {
    max-width: 100%;
    border-radius: var(--r-sm);
    border: 1px solid var(--line);
    cursor: zoom-in;
  }
  .imgbtn {
    padding: 0;
    border: 0;
    background: none;
  }
  pre {
    margin: 0;
    font: 12px/1.55 var(--mono);
    color: var(--text-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .trunc {
    margin-top: 8px;
  }
  .bad {
    color: var(--bad);
  }
</style>
