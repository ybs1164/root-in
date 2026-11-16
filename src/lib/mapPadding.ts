import type { MapPadding } from '../map/courseMap';

const DESKTOP_QUERY = '(min-width: 900px)';
/** How much of the folder sheet stays up while a route is on show (matches .route-folders.is-lowered). */
export const FOLDER_LOWERED_PX = 324;

/**
 * The room the map has around whatever is over it right now (measured off
 * the page): the trays and the bottom bar cover part of the map, so a fit or
 * a focus goes around them.
 */
export function measureMapPadding(bar: HTMLElement | null, extraBottom = 0): MapPadding {
  const desktop = window.matchMedia(DESKTOP_QUERY).matches;
  const barHeight = bar?.offsetHeight ?? 0;
  const cap = (px: number) => Math.min(px, window.innerHeight * 0.5);
  // Editing a route: its sheet covers the lower part, and the route is
  // fitted with more room around it (the map steps back a little).
  const editTray = document.querySelector<HTMLElement>('.route-edit');
  if (editTray) {
    const title = document.querySelector<HTMLElement>('.route-title:not(.route-title--out)');
    const top = title ? title.getBoundingClientRect().bottom + 60 : 120;
    return { top, right: 90, bottom: editTray.offsetHeight + 60 + extraBottom, left: 90 };
  }
  // The 경로 폴더 sheet stands in for the tab buttons while it is up.
  const folderTray = document.querySelector<HTMLElement>('.route-folders:not(.is-leaving)');
  if (folderTray) {
    // Lowered (a route on show) only its top strip covers the map.
    const lowered = folderTray.classList.contains('is-lowered');
    const covered = lowered ? FOLDER_LOWERED_PX : folderTray.offsetHeight;
    // A route on show has its name under the rail; the route sits below it.
    const title = document.querySelector<HTMLElement>('.route-title:not(.route-title--out)');
    const top = lowered && title ? title.getBoundingClientRect().bottom + 30 : 90;
    // …and clear of the < > strips at its sides (.route-step, 64px wide).
    const side = lowered ? 80 : 40;
    return { top, right: side, bottom: covered + 30 + extraBottom, left: side };
  }
  return {
    top: 90,
    right: 40,
    bottom: desktop ? 40 + extraBottom : cap(barHeight) + 30 + extraBottom,
    left: 40,
  };
}

/** A route stepped to with < > glides over as fast as its name slides in (RouteTitle SLIDE_MS); so does a group's map from one member to the next. */
export const STEP_GLIDE_MS = 260;
