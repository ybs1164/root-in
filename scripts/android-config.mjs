/** Stop a distributable APK from silently shipping with its server features disabled. */
export function androidBackend(env, localOnly = false) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url && !key && localOnly) return null;
  if (!url || !key) throw new Error('서버 연결 설정이 없습니다. .env.production.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY(또는 VITE_SUPABASE_ANON_KEY)를 설정하세요. 서버 없는 시험용 APK만 --local-only로 빌드할 수 있습니다.');
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Supabase URL은 HTTP 또는 HTTPS 주소여야 합니다.');
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role; } catch { /* Checked by the server. */ }
  if (key.startsWith('sb_secret_') || role === 'service_role') throw new Error('서버 관리자 키는 APK에 넣을 수 없습니다. anon/public 또는 publishable 키를 사용하세요.');
  return { url: parsed.href.replace(/\/$/, ''), key };
}

export async function checkAndroidBackend(backend, fetcher = fetch) {
  if (!backend) return;
  const response = await fetcher(`${backend.url}/auth/v1/settings`, {
    headers: { apikey: backend.key },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`서버 연결 검사 실패 (HTTP ${response.status}). 프로젝트 주소와 공개 키를 확인하세요.`);
  // A valid JSON response distinguishes the auth service from an HTML error page.
  await response.json();
}

/** Environment changes alone cannot repair an already compiled, key-less web bundle. */
export function checkAndroidBundle(backend, scripts) {
  if (!backend) return;
  if (!scripts.some((script) => script.includes(backend.url) && script.includes(backend.key))) {
    throw new Error('앱 번들에 현재 서버 설정이 없습니다. npm run android:sync를 먼저 실행하세요.');
  }
}
