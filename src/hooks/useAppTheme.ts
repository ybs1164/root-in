import { useEffect, type RefObject } from 'react';
import type { ThemeId } from '../domain/decor';
import { setAppIcon } from '../lib/appIcon';
import type { CourseMap } from '../map/courseMap';
import type { Profile } from '../services/profileRepository';

/**
 * 디스플레이 및 언어 → 디스플레이: 말차, 바나나, 초코 or 딸기 is the app's own theme,
 * under whatever a share card picks (`cardTheme`; its 'default' means "the app's").
 * The one showing lives on <html data-theme>, where styles.css swaps the tokens.
 * There's no dark choice any more, so the page is always drawn light.
 */
export function useAppTheme(appTheme: Profile['appTheme'], cardTheme: ThemeId, mapRef: RefObject<CourseMap | null>): void {
  const own: ThemeId = appTheme === 'banana' ? 'default' : appTheme;
  const shown: ThemeId = cardTheme === 'default' ? own : cardTheme;
  // …and so does the app's icon (the phone's launcher icon, or the browser's tab icon).
  useEffect(() => {
    void setAppIcon(appTheme);
  }, [appTheme]);
  useEffect(() => {
    const root = document.documentElement;
    if (shown === 'default') delete root.dataset.theme;
    else root.dataset.theme = shown;
    root.dataset.scheme = 'light';
    // Phone browsers tint their own bars (and the strip under the page at the
    // bottom edge) from theme-color; left alone it keeps the default theme's
    // (and the phone's light/dark) colour, a pale band under a themed or dark page.
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((m) => {
      m.dataset.base ??= m.content;
      m.content = getComputedStyle(root).getPropertyValue('--surface').trim() || m.dataset.base!;
    });
    // The map painted its areas from the old tokens.
    mapRef.current?.refreshColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
}
