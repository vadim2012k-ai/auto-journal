// Тонкий клиент к Supabase (Auth + REST) на чистом fetch — без SDK, чтобы не
// вводить внешние зависимости в сборку. "Publishable" ключ безопасен для
// браузера: реальный доступ к данным ограничен политиками RLS на сервере.
const SUPABASE_URL = 'https://fzygxacnusjmthfuvsvv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2oL9z3r2bLeIthLIfum2Bg_k5fVQ8fC';
const SESSION_KEY = 'auto-journal-supabase-session';
export function getStoredSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function storeSession(session) {
    try {
        if (session)
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        else
            localStorage.removeItem(SESSION_KEY);
    }
    catch {
        // localStorage недоступен — сессия будет жить только в памяти вкладки.
    }
}
function authHeaders(accessToken) {
    return {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken ?? SUPABASE_KEY}`,
        'Content-Type': 'application/json',
    };
}
function toSession(raw) {
    if (!raw.access_token || !raw.refresh_token || !raw.user)
        return null;
    return {
        accessToken: raw.access_token,
        refreshToken: raw.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + (raw.expires_in ?? 3600),
        userId: raw.user.id,
        email: raw.user.email,
    };
}
function friendlyAuthError(raw, status) {
    const msg = raw.error_description || raw.msg || raw.message || raw.error || '';
    if (/already registered|already exists|user_repeated_signup/i.test(msg)) {
        return 'Аккаунт с таким email уже существует';
    }
    if (/invalid login credentials/i.test(msg))
        return 'Неверный email или пароль';
    if (/email not confirmed/i.test(msg)) {
        return 'Email ещё не подтверждён — проверьте почту и перейдите по ссылке из письма';
    }
    if (/password.*(least|short|characters)/i.test(msg))
        return 'Пароль слишком короткий (минимум 6 символов)';
    if (/unable to validate email/i.test(msg))
        return 'Некорректный email';
    if (status === 0)
        return 'Нет соединения с сервером — проверьте интернет';
    return msg || 'Ошибка соединения с сервером';
}
export async function signUp(email, password) {
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ email, password }),
        });
        const raw = (await res.json().catch(() => ({})));
        if (!res.ok)
            return { ok: false, error: friendlyAuthError(raw, res.status) };
        const session = toSession(raw);
        if (session) {
            storeSession(session);
            return { ok: true, session };
        }
        // Пользователь создан, но токена нет — включено подтверждение email.
        return { ok: true, needsEmailConfirmation: true };
    }
    catch {
        return { ok: false, error: 'Нет соединения с сервером — проверьте интернет' };
    }
}
export async function signIn(email, password) {
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ email, password }),
        });
        const raw = (await res.json().catch(() => ({})));
        if (!res.ok)
            return { ok: false, error: friendlyAuthError(raw, res.status) };
        const session = toSession(raw);
        if (!session)
            return { ok: false, error: 'Не удалось войти' };
        storeSession(session);
        return { ok: true, session };
    }
    catch {
        return { ok: false, error: 'Нет соединения с сервером — проверьте интернет' };
    }
}
export function signOut() {
    storeSession(null);
}
async function refreshSession() {
    const current = getStoredSession();
    if (!current)
        return null;
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
        const raw = (await res.json());
        const session = toSession(raw);
        storeSession(session);
        return session;
    }
    catch {
        // Сети нет прямо сейчас — работаем со старым токеном, пока он не истёк.
        return current;
    }
}
/** Отдаёт валидную сессию, заранее обновляя токен, если он скоро истечёт. */
export async function ensureFreshSession() {
    const current = getStoredSession();
    if (!current)
        return null;
    const now = Math.floor(Date.now() / 1000);
    if (current.expiresAt - now > 60)
        return current;
    return refreshSession();
}
export async function fetchAppData() {
    const session = await ensureFreshSession();
    if (!session)
        return null;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=data,display_id&user_id=eq.${session.userId}`, { headers: authHeaders(session.accessToken) });
    if (!res.ok)
        return null;
    const rows = (await res.json());
    if (rows.length === 0)
        return null;
    return { data: rows[0].data, displayId: rows[0].display_id };
}
export async function saveAppData(data) {
    const session = await ensureFreshSession();
    if (!session)
        return { ok: false };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
        method: 'POST',
        headers: {
            ...authHeaders(session.accessToken),
            Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({ user_id: session.userId, data, updated_at: new Date().toISOString() }),
    });
    if (!res.ok)
        return { ok: false };
    const rows = (await res.json().catch(() => []));
    return { ok: true, displayId: rows[0]?.display_id ?? 0 };
}
