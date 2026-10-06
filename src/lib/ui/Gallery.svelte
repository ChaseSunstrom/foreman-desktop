<script lang="ts">
  // Every picture a Claude session saw or made: images in its conversation and image files in its scratchpad.
  import { onMount } from "svelte";
  import { fm, type Device } from "$lib/fm";
  import { ago, type Ev, type ScratchFile } from "$lib/types";
  import { scratchImage, transcriptImage, whenVisible } from "./media";

  let { device, sid, events, onimage }: { device: Device; sid: string; events: Ev[]; onimage?: (src: string) => void } = $props();
  let files = $state<ScratchFile[]>([]);
  onMount(() => {
    fm<{ files: ScratchFile[] }>(device, ["claude", "files", sid, "--json"])
      .then((o) => (files = o.files.filter((f) => f.kind === "image").sort((a, b) => b.mtime - a.mtime)))
      .catch(() => {});
  });
  const fromChat = $derived(events.filter((e) => e.kind === "image" && e.ref));

  function load(node: HTMLImageElement, get: () => Promise<string>) {
    return whenVisible(node, () => get().then((src) => (node.src = src)).catch(() => node.classList.add("broken")));
  }
</script>

<div class="gallery">
  {#if fromChat.length}
    <div class="label">In the conversation · {fromChat.length}</div>
    <div class="grid">
      {#each fromChat as e (e.ref)}
        <figure>
          <button class="imgbtn" onclick={(ev) => onimage?.((ev.currentTarget.firstElementChild as HTMLImageElement).src)}><img alt="" use:load={() => transcriptImage(device, sid, e.ref!)} /></button>
          <figcaption class="t3">{e.tool_use_id ? "tool output" : "attached"}{e.ts ? ` · ${new Date(e.ts).toLocaleString()}` : ""}</figcaption>
        </figure>
      {/each}
    </div>
  {/if}
  {#if files.length}
    <div class="label">In the scratchpad · {files.length}</div>
    <div class="grid">
      {#each files as f (f.path)}
        <figure>
          <button class="imgbtn" onclick={(ev) => onimage?.((ev.currentTarget.firstElementChild as HTMLImageElement).src)}><img alt={f.path} use:load={() => scratchImage(device, sid, f.path, f.mtime)} /></button>
          <figcaption class="t3 ellipsis" title={f.path}>{f.path} · {ago(f.mtime * 1000)}</figcaption>
        </figure>
      {/each}
    </div>
  {/if}
  {#if !fromChat.length && !files.length}<div class="empty">No pictures in this session.</div>{/if}
</div>

<style>
  .gallery {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 14px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  img {
    width: 100%;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    border-radius: var(--r-sm);
    border: 1px solid var(--line);
    background: var(--surface);
    cursor: zoom-in;
  }
  .imgbtn {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    cursor: zoom-in;
  }
  img:hover {
    border-color: var(--line-2);
  }
  :global(img.broken) {
    opacity: 0.3;
  }
  figcaption {
    font-size: 11px;
  }
</style>
