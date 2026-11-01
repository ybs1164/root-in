import { describe, expect, it } from 'vitest';
import { apnsBody, apnsTokenDead, base64url, fcmBody, fcmTokenDead, newsMessage, pemToDer } from '../../supabase/functions/push-news/payload';

// The push-news Edge Function's pure parts (it runs on Deno; these don't need it).
const row = { id: 'n1', to_user: 'u2', from_user: 'u1', group_id: 'g1', kind: 'route', name: '민수', group_name: '우리', place: '서촌 카페' };

describe('push-news payloads', () => {
  it('tells the group, who and where, and which group to open', () => {
    const message = newsMessage(row);
    expect(message).toEqual({ title: '우리', body: "민수님이 '서촌 카페'에 핑을 찍었어요.", data: { group: 'g1', news: 'n1' } });
    const fcm = fcmBody('tok', message, 'u1');
    expect(fcm.message.token).toBe('tok');
    expect(fcm.message.data).toEqual({ group: 'g1', news: 'n1' });
    expect(fcm.message.android.notification.tag).toBe('route:g1:u1');
    expect(apnsBody(message)).toMatchObject({ aps: { alert: { title: '우리' }, 'thread-id': 'g1' }, group: 'g1' });
  });

  it('drops only tokens the services call gone', () => {
    expect(fcmTokenDead(404, null)).toBe(true);
    expect(fcmTokenDead(400, { error: { details: [{ errorCode: 'UNREGISTERED' }] } })).toBe(true);
    expect(fcmTokenDead(500, null)).toBe(false);
    expect(fcmTokenDead(401, { error: 'auth' })).toBe(false);
    expect(apnsTokenDead(410, 'Unregistered')).toBe(true);
    expect(apnsTokenDead(400, 'BadDeviceToken')).toBe(true);
    expect(apnsTokenDead(403, 'InvalidProviderToken')).toBe(false);
  });

  it('encodes JWT parts and reads PEM keys (escaped newlines too)', () => {
    expect(base64url('{"a":1}')).toBe('eyJhIjoxfQ');
    expect(base64url(new Uint8Array([251, 255]))).toBe('-_8');
    const der = pemToDer('-----BEGIN PRIVATE KEY-----\\nAQID\\n-----END PRIVATE KEY-----\\n');
    expect([...der]).toEqual([1, 2, 3]);
  });
});
