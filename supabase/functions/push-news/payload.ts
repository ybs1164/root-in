// What push-news sends, kept free of Deno so the app's tests can check it
// (src/test/pushPayload.test.ts). No imports.

/** A group_news row as the function reads it. */
export interface NewsRow {
  id: string;
  to_user: string;
  from_user: string;
  group_id: string;
  kind: string;
  name: string;
  group_name: string;
  place: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Read by the app when the push is tapped: which group to open. */
  data: { group: string; news: string };
}

/** The same words the app shows in its own notice (src/hooks/useGroupNews.ts). */
export function newsMessage(row: NewsRow): PushMessage {
  return {
    title: row.group_name,
    body: `${row.name}님이 '${row.place}'에 핑을 찍었어요.`,
    data: { group: row.group_id, news: row.id },
  };
}

/** FCM HTTP v1 request body. One notification per sender and group: a newer place replaces the older one. */
export function fcmBody(token: string, message: PushMessage, fromUser: string) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: { priority: 'high', notification: { tag: `route:${message.data.group}:${fromUser}`, default_sound: true } },
    },
  };
}

/** APNs request body; notifications of one group are threaded together. */
export function apnsBody(message: PushMessage) {
  return {
    aps: { alert: { title: message.title, body: message.body }, sound: 'default', 'thread-id': message.data.group },
    ...message.data,
  };
}

/** FCM said this token is gone (app removed, token rotated): drop it. */
export function fcmTokenDead(status: number, errorBody: unknown): boolean {
  if (status === 404) return true;
  const text = JSON.stringify(errorBody ?? '');
  return status === 400 && /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT.*token/i.test(text);
}

/** APNs said this token is gone. */
export function apnsTokenDead(status: number, reason: string | undefined): boolean {
  return status === 410 || (status === 400 && (reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic'));
}

export function base64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let text = '';
  for (const b of raw) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A PEM private key (PKCS#8, as in a service account JSON or an APNs .p8) as DER bytes. */
export function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----(BEGIN|END)[^-]*-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '');
  const text = atob(body);
  const der = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) der[i] = text.charCodeAt(i);
  return der;
}
