import { useCallback, useEffect, useState } from 'react';
import { clearShareFromLocation, routeShareService } from '../services/routeShareService';
import type { SharedRoute } from '../types/travelRoute';

type IncomingState =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'ready'; route: SharedRoute };

/**
 * Watches the page URL for a `#share=…` link (on load, and when a link is
 * pasted into an already-open tab) and exposes the decoded route.
 * `dismiss()` also strips the fragment so a reload doesn't re-open it.
 */
export function useIncomingSharedRoute() {
  const [state, setState] = useState<IncomingState>({ status: 'none' });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!window.location.hash.includes('share=')) return;
      const route = await routeShareService.resolveFromUrl(window.location.href);
      if (!cancelled) {
        setState(route ? { status: 'ready', route } : { status: 'invalid' });
      }
    };

    check();
    window.addEventListener('hashchange', check);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', check);
    };
  }, []);

  const dismiss = useCallback(() => {
    clearShareFromLocation();
    setState({ status: 'none' });
  }, []);

  return { incoming: state, dismiss };
}
