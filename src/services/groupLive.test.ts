import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_GRACE_MS, createGroupLive, readLiveNote, topicName, type LiveEvent } from './groupLive';

const GID = '11111111-2222-4333-8444-555555555555';
const UID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PATH = `${UID}/abcdef12.jpg`;

/** A stand-in for supabase-js: channels that record their handlers so a test can play the server. */
function fakeClient() {
  const channels: { name: string; options: unknown; onBroadcast?: (m: { payload?: unknown }) => void; onStatus?: (s: string) => void }[] = [];
  const removed: string[] = [];
  const client = {
    realtime: { setAuth: vi.fn(async () => undefined) },
    channel(name: string, options: unknown) {
      const entry: (typeof channels)[number] = { name, options };
      channels.push(entry);
      const channel = {
        on(_type: string, _filter: unknown, cb: (m: { payload?: unknown }) => void) {
          entry.onBroadcast = cb;
          return channel;
        },
        subscribe(cb: (s: string) => void) {
          entry.onStatus = cb;
          return channel;
        },
        name,
      };
      return channel;
    },
    removeChannel: vi.fn(async (channel: { name: string }) => {
      removed.push(channel.name);
      return 'ok';
    }),
  };
  return { client: client as unknown as SupabaseClient, channels, removed };
}

/** Lets open()'s awaits run (timers are fake here). */
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('topicName', () => {
  it('names only the channels the server sends on', () => {
    expect(topicName({ group: GID })).toBe(`group:${GID}`);
    expect(topicName({ photo: PATH })).toBe(`photo:${PATH}`);
    expect(topicName({ group: 'dev-group' })).toBeNull();
    expect(topicName({ photo: 'demo/abc' })).toBeNull();
    expect(topicName({ photo: `${UID}/../x.jpg` })).toBeNull();
  });
});

describe('readLiveNote', () => {
  it('keeps a well-formed note and nothing it does not know', () => {
    expect(readLiveNote({ kind: 'message', id: GID, by: UID, body: 'hi' })).toEqual({ kind: 'message', id: GID, by: UID });
    expect(readLiveNote({ kind: 'comment', id: GID, by: UID, path: PATH })).toEqual({ kind: 'comment', id: GID, by: UID, path: PATH });
  });
  it('drops anything off', () => {
    expect(readLiveNote(null)).toBeNull();
    expect(readLiveNote({ kind: 'delete', id: GID, by: UID })).toBeNull();
    expect(readLiveNote({ kind: 'message', id: 'x', by: UID })).toBeNull();
    expect(readLiveNote({ kind: 'photo', id: GID, by: UID })).toBeNull();
    expect(readLiveNote({ kind: 'comment', id: GID, by: UID, path: 'nope' })).toBeNull();
  });
});

describe('createGroupLive', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('joins a private channel and passes on checked notes and the connection', async () => {
    const { client, channels } = fakeClient();
    const live = createGroupLive(async () => client);
    const heard: LiveEvent[] = [];
    live.watch({ group: GID }, (e) => heard.push(e));
    await settle();
    expect(client.realtime.setAuth).toHaveBeenCalled();
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({ name: `group:${GID}`, options: { config: { private: true } } });
    channels[0].onStatus!('SUBSCRIBED');
    channels[0].onBroadcast!({ payload: { kind: 'message', id: GID, by: UID } });
    channels[0].onBroadcast!({ payload: { kind: 'message', id: 'bad', by: UID } });
    expect(heard).toEqual([{ kind: 'live', on: true }, { kind: 'message', id: GID, by: UID }]);
  });

  it('says resync when it connects again after a break', async () => {
    const { client, channels } = fakeClient();
    const live = createGroupLive(async () => client);
    const heard: LiveEvent[] = [];
    live.watch({ photo: PATH }, (e) => heard.push(e));
    await settle();
    channels[0].onStatus!('SUBSCRIBED');
    channels[0].onStatus!('CHANNEL_ERROR');
    channels[0].onStatus!('SUBSCRIBED');
    expect(heard).toEqual([{ kind: 'live', on: true }, { kind: 'live', on: false }, { kind: 'resync' }, { kind: 'live', on: true }]);
  });

  it('shares one channel per topic and closes it a moment after the last listener goes', async () => {
    const { client, channels, removed } = fakeClient();
    const live = createGroupLive(async () => client);
    const a: LiveEvent[] = [];
    const stopA = live.watch({ group: GID }, (e) => a.push(e));
    await settle();
    channels[0].onStatus!('SUBSCRIBED');
    const b: LiveEvent[] = [];
    const stopB = live.watch({ group: GID }, (e) => b.push(e));
    expect(channels).toHaveLength(1);
    expect(b).toEqual([{ kind: 'live', on: true }]); // already connected
    stopA();
    stopB();
    // Watched again within the grace: the same channel.
    const stopC = live.watch({ group: GID }, () => {});
    vi.advanceTimersByTime(CLOSE_GRACE_MS * 2);
    expect(removed).toEqual([]);
    stopC();
    vi.advanceTimersByTime(CLOSE_GRACE_MS);
    expect(removed).toEqual([`group:${GID}`]);
    // A fresh watch after it closed opens a new one.
    live.watch({ group: GID }, () => {});
    await settle();
    expect(channels).toHaveLength(2);
  });

  it('does nothing without a server or for a topic the server never sends on', async () => {
    const { client, channels } = fakeClient();
    const none = createGroupLive(async () => null);
    const heard: LiveEvent[] = [];
    none.watch({ group: GID }, (e) => heard.push(e))();
    await settle();
    expect(heard).toEqual([]);
    const live = createGroupLive(async () => client);
    live.watch({ photo: 'demo/x' }, () => {})();
    await settle();
    expect(channels).toEqual([]);
  });

  it('never rejects when the library throws', async () => {
    const live = createGroupLive(async () => {
      throw new Error('offline');
    });
    expect(() => live.watch({ group: GID }, () => {})).not.toThrow();
    await settle();
  });
});
