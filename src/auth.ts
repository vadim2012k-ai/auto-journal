// Локальная авторизация — прототип без сервера.
// Аккаунты и пароли (хешированные) хранятся в localStorage ЭТОГО браузера.
// Вход с другого устройства не работает, пока не появится сервер синхронизации.

export interface Account {
  id: number;
  email: string;
  createdAt: number;
}

interface StoredAccount extends Account {
  salt: string;
  passwordHash: string;
}

interface AuthData {
  accounts: StoredAccount[];
  nextId: number;
}

const AUTH_KEY = 'auto-journal-accounts-v1';
const SESSION_KEY = 'auto-journal-session-v1';
const LEGACY_DATA_KEY = 'auto-journal-data-v1';
const FIRST_ID = 100001;
const STORAGE_TEST_KEY = '__auto_journal_storage_test__';

/**
 * Некоторые браузеры/настройки приватности (например, "Блокировать все
 * cookie" в Safari) тихо отключают localStorage — записи как бы проходят,
 * но ничего не сохраняется. Проверяем это явно, чтобы не давать ложное
 * "аккаунт создан", после которого данные пропадают.
 */
export function isStorageAvailable(): boolean {
  try {
    localStorage.setItem(STORAGE_TEST_KEY, '1');
    const ok = localStorage.getItem(STORAGE_TEST_KEY) === '1';
    localStorage.removeItem(STORAGE_TEST_KEY);
    return ok;
  } catch {
    return false;
  }
}

function loadAuth(): AuthData {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { accounts: [], nextId: FIRST_ID };
    return JSON.parse(raw) as AuthData;
  } catch {
    return { accounts: [], nextId: FIRST_ID };
  }
}

function saveAuth(auth: AuthData): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicAccount(a: StoredAccount): Account {
  return { id: a.id, email: a.email, createdAt: a.createdAt };
}

export type AuthResult = { ok: true; account: Account } | { ok: false; error: string };

export async function register(email: string, password: string): Promise<AuthResult> {
  if (!isStorageAvailable()) {
    return {
      ok: false,
      error:
        'Браузер блокирует сохранение данных сайта (localStorage). Проверьте настройки приватности — например, в Safari отключите «Блокировать все cookie» для этого сайта — и попробуйте снова.',
    };
  }

  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@')) return { ok: false, error: 'Введите корректный email' };
  if (password.length < 6) return { ok: false, error: 'Пароль должен быть не короче 6 символов' };

  const auth = loadAuth();
  if (auth.accounts.some((a) => a.email === normalized)) {
    return { ok: false, error: 'Аккаунт с таким email уже существует' };
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const account: StoredAccount = {
    id: auth.nextId,
    email: normalized,
    salt,
    passwordHash,
    createdAt: Date.now(),
  };

  const isFirstEverAccount = auth.accounts.length === 0;
  auth.accounts.push(account);
  auth.nextId += 1;
  saveAuth(auth);
  setSession(account.id);

  // Перечитываем то, что реально сохранилось — если браузер тихо не
  // записал (например, переполнено хранилище), честно сообщаем об этом,
  // а не делаем вид, что всё получилось.
  if (getSessionAccountId() !== account.id || !getAccountById(account.id)) {
    return {
      ok: false,
      error: 'Не удалось сохранить аккаунт в этом браузере. Попробуйте другой браузер или освободите память устройства.',
    };
  }

  // Если это самый первый аккаунт на этом устройстве и уже есть данные,
  // накопленные до появления авторизации — переносим их этому аккаунту,
  // чтобы ничего не потерялось.
  if (isFirstEverAccount) {
    const legacy = localStorage.getItem(LEGACY_DATA_KEY);
    if (legacy) localStorage.setItem(`${LEGACY_DATA_KEY}-${account.id}`, legacy);
  }

  return { ok: true, account: toPublicAccount(account) };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const normalized = normalizeEmail(email);
  const auth = loadAuth();
  const account = auth.accounts.find((a) => a.email === normalized);
  if (!account) return { ok: false, error: 'Неверный email или пароль' };

  const hash = await hashPassword(password, account.salt);
  if (hash !== account.passwordHash) return { ok: false, error: 'Неверный email или пароль' };

  setSession(account.id);
  return { ok: true, account: toPublicAccount(account) };
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getSessionAccountId(): number | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function setSession(accountId: number): void {
  localStorage.setItem(SESSION_KEY, String(accountId));
}

export function getAccountById(id: number): Account | null {
  const auth = loadAuth();
  const account = auth.accounts.find((a) => a.id === id);
  return account ? toPublicAccount(account) : null;
}

export function getCurrentAccount(): Account | null {
  const id = getSessionAccountId();
  return id != null ? getAccountById(id) : null;
}
