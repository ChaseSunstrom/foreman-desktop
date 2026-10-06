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
    gap: 8px;
    background: none;
    border: 0;
    padding: 4px 2px;
    color: var(--dim);
    font-size: 13px;
  }
  .sw.on {
    color: var(--text);
  }
  .sw.busy {
    opacity: 0.6;
    cursor: progress;
  }
  .track {
    width: 34px;
    height: 20px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--line-2);
    position: relative;
    transition: background 0.3s var(--ease);
  }
  .on .track {
    background: var(--grad);
    border-color: transparent;
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: transform 0.35s var(--spring);
  }
  .on .knob {
    transform: translateX(14px);
  }
</style>
