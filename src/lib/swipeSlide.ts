/**
 * The one motion every swiped screen makes (We Now → the map, 설정, 대화, 갤러리):
 * let go far enough it slides on off the screen, otherwise it goes back into
 * place, both on the curve the screens come in on.
 */
export const SLIDE_OFF_MS = 260;
export const SPRING_BACK_MS = 180;

const stillMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** How long a motion lasts here: none when the phone asks for less motion. */
export const motionMs = (ms: number) => (stillMotion() ? 0 : ms);
export const slideEase = () => getComputedStyle(document.documentElement).getPropertyValue('--slide-ease').trim() || 'ease-out';

/** Slides `el` from `fromPx` off the screen to the right, then `done`. */
export function slideOff(el: HTMLElement, fromPx: number, done: () => void) {
  el.style.translate = '';
  el.animate([{ translate: `${fromPx}px 0` }, { translate: '100% 0' }], {
    duration: motionMs(SLIDE_OFF_MS),
    easing: slideEase(),
    fill: 'forwards',
  }).finished.then(done, done);
}

/** A swipe let go too soon: `el` goes back into place from `fromPx`. */
export function springBack(el: HTMLElement, fromPx: number) {
  el.style.translate = '';
  el.animate([{ translate: `${fromPx}px 0` }, { translate: '0px 0' }], { duration: motionMs(SPRING_BACK_MS), easing: slideEase() });
}
