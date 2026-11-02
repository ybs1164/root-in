// push-news: pushes new group_news lines to their people's phones.
// Called by the database (public.push_news, pg_net) with { ids }, guarded by
// the shared secret in the x-push-secret header. Android through FCM HTTP v1,
// iPhone straight to APNs. Tokens the services say are gone are dropped.
//
// Secrets (supabase secrets set …):
//   PUSH_SECRET           same value as the Vault secret push_news_secret
//   FCM_SERVICE_ACCOUNT   the Firebase service account JSON (Android)
//   APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID (iPhone; APNS_SANDBOX=true for Xcode builds)
// Deploy with --no-verify-jwt (the database calls it with the secret, not a user token).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { apnsBody, apnsTokenDead, base64url, fcmBody, fcmTokenDead, newsMessage, pemToDer, type NewsRow } from './payload.ts';

const env = (name: string) => Deno.env.get(name) ?? '';

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

async function signJwt(header: object, claims: object, key: CryptoKey, algorithm: AlgorithmIdentifier | EcdsaParams): Promise<string> {
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = new Uint8Array(await crypto.subtle.sign(algorithm, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${base64url(signature)}`;
}

// ── FCM ──────────────────────────────────────────────────────────────────
let fcmAccess: { token: string; until: number } | null = null;

async function fcmToken(account: { client_email: string; private_key: string }): Promise<string | null> {
  if (fcmAccess && fcmAccess.until > Date.now() + 60_000) return fcmAccess.token;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    { iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    key,
    { name: 'RSASSA-PKCS1-v1_5' },
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  fcmAccess = { token: json.access_token, until: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return fcmAccess.token;
}

/** True when the token is gone. */
async function sendFcm(token: string, row: NewsRow): Promise<boolean> {
  const raw = env('FCM_SERVICE_ACCOUNT');
  if (!raw) return false;
  const account = JSON.parse(raw);
  const access = await fcmToken(account);
  if (!access) return false;
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fcmBody(token, newsMessage(row), row.from_user)),
  });
  if (res.ok) return false;
  return fcmTokenDead(res.status, await res.json().catch(() => null));
}

// ── APNs ─────────────────────────────────────────────────────────────────
let apnsAuth: { token: string; until: number } | null = null;

async function apnsJwt(): Promise<string | null> {
  if (apnsAuth && apnsAuth.until > Date.now()) return apnsAuth.token;
  const pem = env('APNS_KEY');
  if (!pem || !env('APNS_KEY_ID') || !env('APNS_TEAM_ID')) return null;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const token = await signJwt(
    { alg: 'ES256', kid: env('APNS_KEY_ID') },
    { iss: env('APNS_TEAM_ID'), iat: Math.floor(Date.now() / 1000) },
    key,
    { name: 'ECDSA', hash: 'SHA-256' },
  );
  // Apple wants a fresh one at most hourly, at least every 20 minutes apart.
  apnsAuth = { token, until: Date.now() + 40 * 60_000 };
  return token;
}

async function sendApns(token: string, row: NewsRow): Promise<boolean> {
  const auth = await apnsJwt();
  if (!auth) return false;
  const host = env('APNS_SANDBOX') === 'true' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${auth}`,
      'apns-topic': env('APNS_BUNDLE_ID') || 'app.rootin.ios',
      'apns-push-type': 'alert',
      'apns-collapse-id': `route:${row.group_id}:${row.from_user}`.slice(0, 64),
      'content-type': 'application/json',
    },
    body: JSON.stringify(apnsBody(newsMessage(row))),
  });
  if (res.ok) return false;
  const reason = (await res.json().catch(() => null))?.reason;
  return apnsTokenDead(res.status, reason);
}

Deno.serve(async (req) => {
  const secret = env('PUSH_SECRET');
  if (req.method !== 'POST' || !secret || req.headers.get('x-push-secret') !== secret) return new Response('no', { status: 401 });
  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === 'string').slice(0, 500) : [];
  if (!ids.length) return Response.json({ sent: 0 });

  // Only fresh, unseen lines: a replayed call can't push old news again and again.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: rows } = await db.from('group_news').select('id, to_user, from_user, group_id, kind, name, group_name, place')
    .in('id', ids).is('seen_at', null).gte('created_at', since);
  const news = (rows ?? []) as NewsRow[];
  if (!news.length) return Response.json({ sent: 0 });

  const { data: tokens } = await db.from('push_tokens').select('token, user_id, platform').in('user_id', [...new Set(news.map((n) => n.to_user))]);
  const jobs: Promise<{ token: string; dead: boolean }>[] = [];
  for (const row of news) {
    for (const t of tokens ?? []) {
      if (t.user_id !== row.to_user) continue;
      const send = t.platform === 'ios' ? sendApns : sendFcm;
      jobs.push(send(t.token, row).then((dead) => ({ token: t.token, dead }), () => ({ token: t.token, dead: false })));
    }
  }
  const done = await Promise.all(jobs);
  const dead = done.filter((d) => d.dead).map((d) => d.token);
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  return Response.json({ tried: done.length, dropped: dead.length });
});
