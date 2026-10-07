import { useCallback, useEffect, useState } from 'react';
import { clearShareFromLocation, courseShareService } from '../services/courseShareService';
import { hasOpened, readShortSlug, rememberOpened, shareLinkService, type ShareLinkService, type ShareSender } from '../services/shareLinkService';
import type { SharedCourse } from '../types/course';

/** A short link also says who shared it and how often it's been opened; a long one doesn't. */
export interface IncomingMeta {
  openCount: number;
  sender: ShareSender;
}

export type IncomingState =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'ready'; course: SharedCourse; meta?: IncomingMeta };

/** What the link in `url` holds: a long `#share=` token, or a short `#s=` link asked of the server. */
export async function resolveIncoming(url: string, links: ShareLinkService = shareLinkService): Promise<IncomingState> {
  const slug = readShortSlug(url);
  if (slug) {
    if (!links.available) return { status: 'invalid' };
    // Counted the first time this browser opens it.
    const first = !hasOpened(slug);
    const opened = await links.open(slug, first);
    if (!opened || opened === 'error') return { status: 'invalid' };
    if (first) rememberOpened(slug);
    return { status: 'ready', course: opened.course, meta: { openCount: opened.openCount, sender: opened.sender } };
  }
  if (!new URL(url).hash.includes('share=')) return { status: 'none' };
  const course = await courseShareService.resolveFromUrl(url);
  return course ? { status: 'ready', course } : { status: 'invalid' };
}

/**
 * Watches the URL for a shared route (`#share=…` or a short `#s=…`), on load
 * and when a link is pasted into an already-open tab. `dismiss()` strips the
 * fragment so a reload doesn't re-open it.
 */
export function useIncomingCourse() {
  const [state, setState] = useState<IncomingState>({ status: 'none' });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = await resolveIncoming(window.location.href);
      if (!cancelled && next.status !== 'none') setState(next);
    };
    void check();
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
