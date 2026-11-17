import { createContext, useContext } from 'react';
import type { ThemeId } from '../domain/decor';

/**
 * The theme of the screen we're inside (a group wearing its cover's colour),
 * for what leaves that screen's DOM subtree and so can't inherit its tokens:
 * a tray portaled to <body>, a dialog mounted beside it. Undefined is the
 * app's own theme.
 */
const ThemeScopeContext = createContext<ThemeId | undefined>(undefined);

export const ThemeScopeProvider = ThemeScopeContext.Provider;
export const useThemeScope = (): ThemeId | undefined => useContext(ThemeScopeContext);

/** Props that make an element wear `theme` (`.theme-scope[data-theme]` in styles.css); nothing for the app's own. */
export const themeScopeProps = (theme: ThemeId | undefined): { 'data-theme'?: ThemeId } => (theme ? { 'data-theme': theme } : {});
