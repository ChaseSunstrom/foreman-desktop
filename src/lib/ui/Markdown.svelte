<script lang="ts" module>
  // A small Markdown reader for agent text and task briefs: code fences, headings, lists, quotes, tables, `code` and
  // **bold**. It builds elements, never HTML strings, so text from another device can't inject markup.
  type Inline = { t: "text" | "code" | "b"; v: string };
  type Block =
    | { t: "p" | "quote"; inl: Inline[] }
    | { t: "h"; level: number; inl: Inline[] }
    | { t: "code"; lang: string; v: string }
    | { t: "ul" | "ol"; items: Inline[][] }
    | { t: "table"; rows: Inline[][][] }
    | { t: "hr" };

  function inline(s: string): Inline[] {
    const out: Inline[] = [];
    const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let at = 0;
    for (const m of s.matchAll(re)) {
      if (m.index! > at) out.push({ t: "text", v: s.slice(at, m.index) });
      out.push(m[0].startsWith("`") ? { t: "code", v: m[0].slice(1, -1) } : { t: "b", v: m[0].slice(2, -2) });
      at = m.index! + m[0].length;
    }
    if (at < s.length) out.push({ t: "text", v: s.slice(at) });
    return out;
  }

  export function parse(src: string): Block[] {
    const lines = src.replace(/\r/g, "").split("\n");
    const out: Block[] = [];
    let para: string[] = [];
    const flush = () => {
      if (para.length) out.push({ t: "p", inl: inline(para.join(" ")) });
      para = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const fence = l.match(/^\s*```(\S*)/);
      if (fence) {
        flush();
        const body: string[] = [];
        while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
        out.push({ t: "code", lang: fence[1], v: body.join("\n") });
        continue;
      }
      const h = l.match(/^(#{1,4})\s+(.*)/);
      if (h) {
        flush();
        out.push({ t: "h", level: h[1].length, inl: inline(h[2]) });
        continue;
      }
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(l)) {
        flush();
        out.push({ t: "hr" });
        continue;
      }
      const li = l.match(/^\s*([-*+]|\d+[.)])\s+(.*)/);
      if (li) {
        flush();
        const kind = /\d/.test(li[1]) ? "ol" : "ul";
        const last = out[out.length - 1];
        if (last && last.t === kind) last.items.push(inline(li[2]));
        else out.push({ t: kind, items: [inline(li[2])] });
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l)) {
        flush();
        const cells = l.trim().slice(1, -1).split("|").map((c) => c.trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        const last = out[out.length - 1];
        if (last && last.t === "table") last.rows.push(cells.map(inline));
        else out.push({ t: "table", rows: [cells.map(inline)] });
        continue;
      }
      const q = l.match(/^\s*>\s?(.*)/);
      if (q) {
        flush();
        out.push({ t: "quote", inl: inline(q[1]) });
        continue;
      }
      if (!l.trim()) flush();
      else para.push(l.trim());
    }
    flush();
    return out;
  }
</script>

<script lang="ts">
  let { text }: { text: string } = $props();
  const blocks = $derived(parse(text ?? ""));
</script>

{#snippet inl(parts: Inline[])}{#each parts as p}{#if p.t === "code"}<code>{p.v}</code>{:else if p.t === "b"}<b>{p.v}</b>{:else}{p.v}{/if}{/each}{/snippet}

<div class="md">
  {#each blocks as b}
    {#if b.t === "p"}<p>{@render inl(b.inl)}</p>
    {:else if b.t === "h"}<div class="h h{b.level}">{@render inl(b.inl)}</div>
    {:else if b.t === "code"}<pre><code>{b.v}</code></pre>
    {:else if b.t === "ul"}<ul>{#each b.items as it}<li>{@render inl(it)}</li>{/each}</ul>
    {:else if b.t === "ol"}<ol>{#each b.items as it}<li>{@render inl(it)}</li>{/each}</ol>
    {:else if b.t === "quote"}<blockquote>{@render inl(b.inl)}</blockquote>
    {:else if b.t === "table"}
      <div class="tw"><table><tbody>{#each b.rows as r, i}<tr>{#each r as c}{#if i === 0}<th>{@render inl(c)}</th>{:else}<td>{@render inl(c)}</td>{/if}{/each}</tr>{/each}</tbody></table></div>
    {:else if b.t === "hr"}<hr />{/if}
  {/each}
</div>

<style>
  .md {
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .md > :first-child {
    margin-top: 0;
  }
  .md > :last-child {
    margin-bottom: 0;
  }
  p,
  ul,
  ol,
  blockquote,
  pre,
  .tw {
    margin: 0 0 8px;
  }
  ul,
  ol {
    padding-left: 20px;
  }
  li {
    margin: 2px 0;
  }
  .h {
    font-weight: 600;
    margin: 12px 0 6px;
  }
  .h1 {
    font-size: 15px;
  }
  .h2 {
    font-size: 14px;
  }
  .h3,
  .h4 {
    font-size: 13px;
    color: var(--text-2);
  }
  code {
    font: 12px var(--mono);
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--surface-2);
  }
  pre {
    padding: 10px 12px;
    border-radius: var(--r-sm);
    background: var(--bg);
    border: 1px solid var(--line);
    overflow-x: auto;
  }
  pre code {
    padding: 0;
    background: none;
    white-space: pre;
  }
  blockquote {
    padding-left: 10px;
    border-left: 2px solid var(--line-2);
    color: var(--text-2);
  }
  hr {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 10px 0;
  }
  .tw {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 12.5px;
  }
  th,
  td {
    border: 1px solid var(--line);
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: var(--surface);
    font-weight: 600;
  }
</style>
