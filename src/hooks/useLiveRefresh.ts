import { useEffect, useRef, useState } from 'react';
import { onAppVisibility } from '../lib/native';
import { groupService, type GroupService } from '../services/groupService';
import type { LiveTopic } from '../services/groupLive';

/** Notes that come close together (a photo and its comment) make one read. */
export const LIVE_GATHER_MS = 250;
/** How often a screen reads itself again anyway: rarely while the channel is up, as before while it's down. */
export const POLL_LIVE_MS = 120_000;
export const POLL_OFF_MS = 30_000;

export const pollEvery = (live: boolean): number => (live ? POLL_LIVE_MS : POLL_OFF_MS);

const topicKey = (topic: LiveTopic | null): string | null => (!topic ? null : 'group' in topic ? `group:${topic.group}` : `photo:${topic.photo}`);

/**
 * Keeps a screen (the 대화, a big photo's comments) up to date: `refresh`
 * runs when a line is written there (one read for notes that come close
 * together, none for a line `known` says is already shown — like the one I
 * just sent), after the channel reconnects, when the app comes back to the
 * front, and on a timer — slow while connected, every 30 seconds while not.
 * Whether the channel is connected.
 */
export function useLiveRefresh(
  topic: LiveTopic | null,
  refresh: () => void,
  { known, service = groupService }: { known?: (id: string) => boolean; service?: GroupService } = {},
): boolean {
  const key = topicKey(topic);
  const refreshRef = useRef(refresh);
  const knownRef = useRef(known);
  useEffect(() => {
    refreshRef.current = refresh;
    knownRef.current = known;
  });
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLive(false);
    if (!key) return;
    const at = key.startsWith('group:') ? { group: key.slice(6) } : { photo: key.slice(6) };
    let gather: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      gather ??= setTimeout(() => {
        gather = null;
        refreshRef.current();
      }, LIVE_GATHER_MS);
    };
    const stop = service.watch(at, (event) => {
      if (event.kind === 'live') return setLive(event.on);
      if (event.kind !== 'resync' && knownRef.current?.(event.id)) return;
      soon();
    });
    // Back from the background (the phone's socket was likely closed): read what was missed.
    let first = true;
    const hide = onAppVisibility((active) => {
      if (first) return void (first = false);
      if (active) soon();
    });
    return () => {
      stop();
      hide();
      if (gather) clearTimeout(gather);
    };
  }, [key, service]);

  useEffect(() => {
    if (!key) return;
    const timer = window.setInterval(() => refreshRef.current(), pollEvery(live));
    return () => window.clearInterval(timer);
  }, [key, live]);

  return live;
}
