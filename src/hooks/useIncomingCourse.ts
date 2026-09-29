import { useCallback, useEffect, useState } from 'react';
import { clearShareFromLocation, courseShareService } from '../services/courseShareService';
import type { SharedCourse } from '../types/course';

type IncomingState = { status: 'none' } | { status: 'invalid' } | { status: 'ready'; course: SharedCourse };

/**
 * Watches the URL for a `#share=…` link (on load, and when a link is pasted
 * into an already-open tab). `dismiss()` strips the fragment so a reload
 * doesn't re-open it.
 */
export function useIncomingCourse() {
  const [state, setState] = useState<IncomingState>({ status: 'none' });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!window.location.hash.includes('share=')) return;
      const course = await courseShareService.resolveFromUrl(window.location.href);
      if (!cancelled) setState(course ? { status: 'ready', course } : { status: 'invalid' });
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
