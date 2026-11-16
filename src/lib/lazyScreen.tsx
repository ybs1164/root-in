import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';

type Loader<P> = () => Promise<{ default: ComponentType<P> }>;

const loaders: (() => void)[] = [];

/**
 * A screen that isn't part of the first one (설정, the camera, the gallery …),
 * kept out of the app's first bundle: its code is fetched when it first shows
 * — or sooner, by `preloadScreens()` once the app is up — and until it is
 * there nothing is drawn in its place.
 *
 * A chunk that can't be fetched (offline, or a deploy swapped the files
 * under an open page) must not take the app down with it: the screen just
 * doesn't show, and the next time it's opened the fetch is tried again.
 */
export function lazyScreen<P extends object>(load: Loader<P>): ComponentType<P> {
  let Lazy = lazy(load);
  loaders.push(() => void load().catch(() => {}));

  class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch() {
      // React keeps a failed lazy component failed: a fresh one tries the fetch again.
      Lazy = lazy(load);
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }

  return function Screen(props: P) {
    return (
      <Boundary>
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      </Boundary>
    );
  };
}

/**
 * Fetches every lazy screen's code now (the browser caches the modules), so
 * the first time one opens it's already there. Called once the first screen
 * is up and idle; a failed fetch is just tried again when the screen opens.
 */
export function preloadScreens(): void {
  loaders.splice(0).forEach((fetchIt) => fetchIt());
}
