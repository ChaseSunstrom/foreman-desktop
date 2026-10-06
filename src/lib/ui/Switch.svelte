<script lang="ts">
  let { on, label, onchange, busy = false }: { on: boolean; label: string; onchange: (v: boolean) => void; busy?: boolean } =
    $props();
</script>

<button class="sw" class:on class:busy role="switch" aria-checked={on} onclick={() => !busy && onchange(!on)}>
  <span class="track"><span class="knob"></span></span>
  <span>{label}</span>
</button>

<style>
  .sw {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 28px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--text-2);
    font-size: 12.5px;
  }
  .sw.on {
    color: var(--text);
  }
  .sw.busy {
    opacity: 0.6;
    cursor: progress;
  }
  .track {
    width: 26px;
    height: 15px;
    border-radius: 8px;
    background: var(--line-2);
    position: relative;
    transition: background 0.15s;
  }
  .on .track {
    background: var(--accent);
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s var(--ease);
  }
  .on .knob {
    transform: translateX(11px);
  }
</style>
