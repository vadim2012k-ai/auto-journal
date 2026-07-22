// Тонкий клиент к Supabase (Auth + REST) на чистом fetch — без SDK, чтобы не
// вводить внешние зависимости в сборку. "Publishable" ключ безопасен для
// браузера: реальный доступ к данным ограничен политиками RLS на сервере.

const SUPABASE_URL = 'https://fzygxacnusjmthfuvsvv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2oL9z3r2bLeIthLIfum2Bg_k5fVQ8fC';

const SESSION_KEY = 'auto-journal-supabase-session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix-время (сек), когда access_token истекает
  userId: string;
  email: string;
}

export function getStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function storeSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // localStorage недоступен — сессия будет жить только в памяти вкладки.
  }
}

function authHeaders(accessToken?: string): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${accessToken ?? SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

interface RawAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email: string } | null;
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
}

function toSession(raw: RawAuthResponse): Session | null {
  if (!raw.access_token || !raw.refresh_token || !raw.user) return null;
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + (raw.expires_in ?? 3600),
    userId: raw.user.id,
    email: raw.user.email,
  };
}

function friendlyAuthError(raw: RawAuthResponse, status: number): string {
  const msg = raw.error_description || raw.msg || raw.message || raw.error || '';
  if (/already registered|already exists|user_repeated_signup/i.test(msg)) {
    return 'Аккаунт с таким email уже существует';
  }
  if (/invalid login credentials/i.test(msg)) return 'Неверный email или пароль';
  if (/email not confirmed/i.test(msg)) {
    return 'Email ещё не подтверждён — проверьте почту и перейдите по ссылке из письма';
  }
  if (/password.*(least|short|characters)/i.test(msg)) return 'Пароль слишком короткий (минимум 6 символов)';
  if (/unable to validate email/i.test(msg)) return 'Некорректный email';
  if (status === 0) return 'Нет соединения с сервером — проверьте интернет';
  return msg || 'Ошибка соединения с сервером';
}

export type AuthOutcome =
  | { ok: true; session: Session }
  | { ok: true; needsEmailConfirmation: true }
  | { ok: false; error: string };

export async function signUp(email: string, password: string): Promise<AuthOutcome> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const raw = (await res.json().catch(() => ({}))) as RawAuthResponse;
    if (!res.ok) return { ok: false, error: friendlyAuthError(raw, res.status) };
    const session = toSession(raw);
    if (session) {
      storeSession(session);
      return { ok: true, session };
    }
    // Пользователь создан, но токена нет — включено подтверждение email.
    return { ok: true, needsEmailConfirmation: true };
  } catch {
    return { ok: false, error: 'Нет соединения с сервером — проверьте интернет' };
  }
}

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const raw = (await res.json().catch(() => ({}))) as RawAuthResponse;
    if (!res.ok) return { ok: false, error: friendlyAuthError(raw, res.status) };
    const session = toSession(raw);
    if (!session) return { ok: false, error: 'Не удалось войти' };
    storeSession(session);
    return { ok: true, session };
  } catch {
    return { ok: false, error: 'Нет соединения с сервером — проверьте интернет' };
  }
}

export function signOut(): void {
  storeSession(null);
}

export async function requestPasswordReset(
  email: string,
  redirectTo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, redirect_to: redirectTo }),
    });
    if (!res.ok) {
      const raw = (await res.json().catch(() => ({}))) as RawAuthResponse;
      return { ok: false, error: friendlyAuthError(raw, res.status) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Нет соединения с сервером — проверьте интернет' };
  }
}

export interface RecoveryTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Меняет пароль по токену из ссылки восстановления (ещё не полноценная сессия). */
export async function updatePassword(
  accessToken: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      const raw = (await res.json().catch(() => ({}))) as RawAuthResponse;
      return { ok: false, error: friendlyAuthError(raw, res.status) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Нет соединения с сервером — проверьте интернет' };
  }
}

/** После смены пароля превращаем токены из ссылки восстановления в обычную сессию. */
export async function completeRecoverySignIn(tokens: RecoveryTokens): Promise<Session | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: authHeaders(tokens.accessToken),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string; email: string };
    const session: Session = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expiresIn,
      userId: user.id,
      email: user.email,
    };
    storeSession(session);
    return session;
  } catch {
    return null;
  }
}

async function refreshSession(): Promise<Session | null> {
  const current = getStoredSession();
  if (!current) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    });
    if (!res.ok) {
      storeSession(null);
      return null;
    }
    const raw = (await res.json()) as RawAuthResponse;
    const session = toSession(raw);
    storeSession(session);
    return session;
  } catch {
    // Сети нет прямо сейчас — работаем со старым токеном, пока он не истёк.
    return current;
  }
}

/** Отдаёт валидную сессию, заранее обновляя токен, если он скоро истечёт. */
export async function ensureFreshSession(): Promise<Session | null> {
  const current = getStoredSession();
  if (!current) return null;
  const now = Math.floor(Date.now() / 1000);
  if (current.expiresAt - now > 60) return current;
  return refreshSession();
}

export interface RemoteAppData {
  data: unknown;
  displayId: number;
}

export async function fetchAppData(): Promise<RemoteAppData | null> {
  const session = await ensureFreshSession();
  if (!session) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/app_data?select=data,display_id&user_id=eq.${session.userId}`,
    { headers: authHeaders(session.accessToken), cache: 'no-store' },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { data: unknown; display_id: number }[];
  if (rows.length === 0) return null;
  return { data: rows[0].data, displayId: rows[0].display_id };
}

export type SaveAppDataResult =
  | { ok: true; displayId: number }
  | { ok: false; status: number; message: string };

export async function saveAppData(data: unknown): Promise<SaveAppDataResult> {
  const session = await ensureFreshSession();
  if (!session) return { ok: false, status: 0, message: 'Нет действительной сессии (не удалось обновить токен)' };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
      method: 'POST',
      headers: {
        ...authHeaders(session.accessToken),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({ user_id: session.userId, data, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      return { ok: false, status: res.status, message: bodyText.slice(0, 300) || res.statusText };
    }
    const rows = (await res.json().catch(() => [])) as { display_id: number }[];
    return { ok: true, displayId: rows[0]?.display_id ?? 0 };
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : 'Сеть недоступна' };
  }
}
