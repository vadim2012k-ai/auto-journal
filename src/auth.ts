// Авторизация через Supabase — настоящий аккаунт, доступный с любого
// устройства. Сама логика запросов — в supabase.ts, здесь только
// человекочитаемые обёртки для остального приложения.

import {
  ensureFreshSession,
  getStoredSession,
  signIn,
  signOut,
  signUp,
  type AuthOutcome,
  type Session,
} from './supabase.js';

export type { AuthOutcome, Session };

export async function register(email: string, password: string): Promise<AuthOutcome> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return { ok: false, error: 'Введите корректный email' };
  if (password.length < 6) return { ok: false, error: 'Пароль должен быть не короче 6 символов' };
  return signUp(normalized, password);
}

export async function login(email: string, password: string): Promise<AuthOutcome> {
  return signIn(email.trim().toLowerCase(), password);
}

export function logout(): void {
  signOut();
}

export function hasSession(): boolean {
  return getStoredSession() !== null;
}

export { ensureFreshSession };
