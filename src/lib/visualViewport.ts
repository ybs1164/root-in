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
export function trackVisualViewport(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const root = document.documentElement;
  let frame = 0;
  const apply = () => {
    frame = 0;
    root.style.setProperty('--vv-top', `${Math.max(0, vv.offsetTop)}px`);
    root.style.setProperty('--vv-height', `${vv.height}px`);
    // A keyboard, not a pinch: the visible part is much shorter than the page at 1× (the page itself, clientHeight, never shrinks for it).
    const keyboard = vv.scale <= 1.01 && root.clientHeight - vv.height > 120;
    if (keyboard) root.dataset.keyboard = '';
    else delete root.dataset.keyboard;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  apply();
  return () => {
    cancelAnimationFrame(frame);
    vv.removeEventListener('resize', schedule);
    vv.removeEventListener('scroll', schedule);
  };
}
