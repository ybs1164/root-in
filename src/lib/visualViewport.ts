/**
 * The part of the screen the keyboard leaves, as CSS: `--vv-top` and
 * `--vv-height` on the root, and `data-keyboard` while a keyboard is up.
 *
 * On iPhone a keyboard doesn't shrink the page: iOS pans it to bring the
 * focused field into view, and over a full-screen `position: fixed` layer
 * (the group's 대화, a big photo's comments) that pan sometimes doesn't
 * happen — the keyboard comes up over the input and the last lines. Layers
 * with an input size themselves to the visible part instead, so their
 * bottom (the input) sits right on the keyboard every time.
 */
/** How long the keyboard takes to come up or go down, with room to spare (ms). */
const KEYBOARD_SETTLE_MS = 1200;

export function trackVisualViewport(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const root = document.documentElement;
  let frame = 0;
  let last = { top: '', height: '' };
  const apply = () => {
    frame = 0;
    const top = `${Math.max(0, vv.offsetTop)}px`;
    const height = `${vv.height}px`;
    // Read every frame for a while around a focus: only a change restyles the page.
    if (top !== last.top) root.style.setProperty('--vv-top', top);
    if (height !== last.height) root.style.setProperty('--vv-height', height);
    last = { top, height };
    // A keyboard, not a pinch: the visible part is much shorter than the page at 1× (the page itself, clientHeight, never shrinks for it).
    const keyboard = vv.scale <= 1.01 && root.clientHeight - vv.height > 120;
    if (keyboard) root.dataset.keyboard = '';
    else delete root.dataset.keyboard;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };
  // A field focused as a layer opens (the photo panel's 💬 opening the big
  // photo with its comment line already focused) brings the keyboard up
  // while that layer is still popping in, and iOS sometimes sends no resize
  // for it (or one before the keyboard is all the way up): the layer stayed
  // full height under the keyboard. So for a while after a field gains or
  // loses focus, the visible part is read every frame too.
  let watchUntil = 0;
  let watchFrame = 0;
  const watch = () => {
    apply();
    watchFrame = performance.now() < watchUntil ? requestAnimationFrame(watch) : 0;
  };
  const focusChanged = (e: FocusEvent) => {
    if (!(e.target as Element | null)?.closest?.('input, textarea, [contenteditable]')) return;
    watchUntil = performance.now() + KEYBOARD_SETTLE_MS;
    if (!watchFrame) watchFrame = requestAnimationFrame(watch);
  };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  document.addEventListener('focusin', focusChanged);
  document.addEventListener('focusout', focusChanged);
  apply();
  return () => {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(watchFrame);
    vv.removeEventListener('resize', schedule);
    vv.removeEventListener('scroll', schedule);
    document.removeEventListener('focusin', focusChanged);
    document.removeEventListener('focusout', focusChanged);
  };
}
