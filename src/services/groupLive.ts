import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';

// The group 대화 and a big photo's comments, live
// (supabase/migrations/20261107000000_realtime_group_events.sql). The server
// sends a short note on a private channel when a line is written; the note
// has no text, so the app reads the feed or the comments again through the
// usual functions. Never rejects; without a server nothing ever comes and
// the screens keep reading on their timers.

/** What to listen to: a group's 대화, or one photo's comments (its upload path). */
export type LiveTopic = { group: string } | { photo: string };

/** A line was written: what kind, its id, who wrote it, and the photo it's on. */
export interface LiveNote {
  kind: 'message' | 'comment' | 'photo';
  id: string;
  by: string;
  path?: string;
}

/**
 * A note; or whether the channel is connected (`live`); or `resync` — it
 * connected again after a break, so notes may have been missed.
 */
export type LiveEvent = LiveNote | { kind: 'live'; on: boolean } | { kind: 'resync' };

export interface GroupLive {
  /** Starts listening; returns the stop. Listeners of one topic share a channel. */
  watch(topic: LiveTopic, listener: (event: LiveEvent) => void): () => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PHOTO_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{6,40}\.jpg$/;

/** How long a channel nobody listens to stays open — a photo swiped away and back, or React mounting twice, reuses it. */
export const CLOSE_GRACE_MS = 1500;

/** The channel's name, or null when the topic isn't one the server sends on. */
export function topicName(topic: LiveTopic): string | null {
  if ('group' in topic) return UUID.test(topic.group) ? `group:${topic.group}` : null;
  return PHOTO_PATH.test(topic.photo) ? `photo:${topic.photo}` : null;
}

/** A note as it came off the channel, checked; null when anything's off. */
export function readLiveNote(raw: unknown): LiveNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== 'message' && r.kind !== 'comment' && r.kind !== 'photo') return null;
  if (typeof r.id !== 'string' || !UUID.test(r.id) || typeof r.by !== 'string' || !UUID.test(r.by)) return null;
  const note: LiveNote = { kind: r.kind, id: r.id, by: r.by };
  if (r.kind !== 'message') {
    if (typeof r.path !== 'string' || !PHOTO_PATH.test(r.path)) return null;
    note.path = r.path;
  }
  return note;
}

interface Entry {
  listeners: Set<(event: LiveEvent) => void>;
  client: SupabaseClient | null;
  channel: RealtimeChannel | null;
  closed: boolean;
  /** Connected once already: the next connect is a reconnect. */
  joined: boolean;
  live: boolean;
  closing: ReturnType<typeof setTimeout> | null;
}

export function createGroupLive(getClient: () => Promise<SupabaseClient | null> = getSupabase): GroupLive {
  const entries = new Map<string, Entry>();

  const emit = (entry: Entry, event: LiveEvent) => {
    for (const listener of [...entry.listeners]) {
      try {
        listener(event);
      } catch {
        // One screen's trouble doesn't stop the others hearing.
      }
    }
  };
  const setLive = (entry: Entry, on: boolean) => {
    if (entry.live === on) return;
    entry.live = on;
    emit(entry, { kind: 'live', on });
  };

  const open = async (name: string, entry: Entry) => {
    try {
      const client = await getClient();
      if (!client || entry.closed) return;
      // A private channel joins with the signed-in user's token (a guest's too).
      await client.realtime.setAuth().catch(() => undefined);
      if (entry.closed) return;
      const channel = client.channel(name, { config: { private: true } });
      entry.client = client;
      entry.channel = channel;
      channel
        .on('broadcast', { event: 'feed' }, (message: { payload?: unknown }) => {
          const note = readLiveNote(message?.payload);
          if (note && !entry.closed) emit(entry, note);
        })
        .subscribe((status: string) => {
          if (entry.closed) return;
          if (status === 'SUBSCRIBED') {
            if (entry.joined) emit(entry, { kind: 'resync' });
            entry.joined = true;
            setLive(entry, true);
          } else {
            // CHANNEL_ERROR, TIMED_OUT, CLOSED: the library retries by itself.
            setLive(entry, false);
          }
        });
    } catch {
      // No channel: the screens keep reading on their timers.
    }
  };

  const close = (name: string, entry: Entry) => {
    entry.closed = true;
    entries.delete(name);
    const { client, channel } = entry;
    if (client && channel) void client.removeChannel(channel).catch(() => undefined);
  };

  return {
    watch(topic, listener) {
      const name = topicName(topic);
      if (!name) return () => {};
      let entry = entries.get(name);
      if (!entry) {
        entry = { listeners: new Set(), client: null, channel: null, closed: false, joined: false, live: false, closing: null };
        entries.set(name, entry);
        void open(name, entry);
      }
      const held = entry;
      if (held.closing) clearTimeout(held.closing), (held.closing = null);
      held.listeners.add(listener);
      if (held.live) listener({ kind: 'live', on: true });
      return () => {
        if (!held.listeners.delete(listener) || held.listeners.size || held.closed) return;
        held.closing = setTimeout(() => close(name, held), CLOSE_GRACE_MS);
      };
    },
  };
}
