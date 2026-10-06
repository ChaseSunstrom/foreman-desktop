// The transport: every call is `fm … --json` on a device, this machine or one reached over ssh (the Rust side).
import { Channel, invoke } from "@tauri-apps/api/core";

export type Device = { id: string; name: string; host: string | null };

const target = (d: Device) => ({ host: d.host });

/** Run fm on a device and parse its JSON answer. Rejects with fm's own error text. */
export async function fm<T = any>(d: Device, args: string[]): Promise<T> {
  const out = await invoke<string>("fm", { device: target(d), args });
  const text = out.trim();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T; // a command without a JSON mode answered in words
  }
}

export type Stream = { stop: () => void };

/** A long-lived `fm … --follow`: onLine for each JSON line, onEnd once (exit code, stderr) unless stopped. */
export function follow(
  d: Device,
  args: string[],
  onLine: (o: any) => void,
  onEnd: (code: number, error: string) => void,
): Stream {
  let stopped = false;
  const ch = new Channel<string>();
  ch.onmessage = (line) => {
    if (stopped) return;
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      return;
    }
    if (o && typeof o === "object" && "__end" in o) onEnd(o.__end, o.error || "");
    else onLine(o);
  };
  const id = invoke<number>("fm_stream", { device: target(d), args, onLine: ch }).catch((e) => {
    if (!stopped) onEnd(-1, String(e));
    return null;
  });
  return {
    stop() {
      stopped = true;
      id.then((n) => n && invoke("fm_stream_stop", { id: n }));
    },
  };
}

/** follow() that reconnects with backoff when the stream ends, until stopped, or until giveUp says the error is
 * final (a removed session, a device whose fm lacks the command). */
export function live(
  d: Device,
  args: string[],
  onLine: (o: any) => void,
  onState: (s: { ok: boolean; error?: string; final?: boolean }) => void,
  giveUp: (error: string) => boolean = (e) => /invalid choice|no session|was removed|not a session id/.test(e),
): Stream {
  let cur: Stream | null = null;
  let stopped = false;
  let delay = 1500;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const start = () => {
    if (stopped) return;
    cur = follow(
      d,
      args,
      (o) => {
        delay = 1500;
        onState({ ok: true });
        onLine(o);
      },
      (code, error) => {
        if (stopped) return;
        const final = giveUp(error);
        onState({ ok: false, error: error || `stream ended (${code})`, final });
        if (final) return;
        timer = setTimeout(start, delay);
        delay = Math.min(delay * 2, 30000);
      },
    );
  };
  start();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      cur?.stop();
    },
  };
}
