// Images from a Claude session (pasted, or returned by a tool) and its scratchpad, fetched once each.
import { fm, type Device } from "$lib/fm";

const cache = new Map<string, Promise<string>>();

/** A data URL for an image in a Claude session's transcript (ref from fm claude show). */
export function transcriptImage(d: Device, sid: string, ref: string, agent?: string): Promise<string> {
  const key = `${d.id}|${sid}|${agent ?? ""}|${ref}`;
  if (!cache.has(key)) {
    const args = ["claude", "image", sid, ref, "--json", ...(agent ? ["--agent", agent] : [])];
    cache.set(key, fm<{ media_type: string; data: string }>(d, args).then((o) => `data:${o.media_type};base64,${o.data}`));
  }
  return cache.get(key)!;
}

/** A data URL for an image file in a Claude session's scratchpad. */
export function scratchImage(d: Device, sid: string, path: string, mtime: number): Promise<string> {
  const key = `${d.id}|${sid}|file|${path}|${mtime}`;
  if (!cache.has(key)) {
    cache.set(key, fm<{ media_type: string; data: string }>(d, ["claude", "file", sid, path, "--json"]).then(
      (o) => `data:${o.media_type};base64,${o.data}`,
    ));
  }
  return cache.get(key)!;
}

/** Load when the element scrolls into view (a long gallery never fetches what nobody looks at). */
export function whenVisible(node: HTMLElement, load: () => void) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      load();
    }
  });
  io.observe(node);
  return { destroy: () => io.disconnect() };
}
