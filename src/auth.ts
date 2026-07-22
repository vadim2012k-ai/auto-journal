// Авторизация через Supabase — настоящий аккаунт, доступный с любого
// устройства. Сама логика запросов — в supabase.ts, здесь только
// человекочитаемые обёртки для остального приложения.

import {
  completeRecoverySignIn,
  ensureFreshSession,
  getStoredSession,
  requestPasswordReset as requestPasswordResetRaw,
  signIn,
  signOut,
  signUp,
  updatePassword as updatePasswordRaw,
  type AuthOutcome,
  type RecoveryTokens,
  type Session,
} from './supabase.js';

export type { AuthOutcome, RecoveryTokens, Session };

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

export async function requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const redirectTo = window.location.origin + window.location.pathname;
  return requestPasswordResetRaw(email.trim().toLowerCase(), redirectTo);
}

export async function updatePassword(
  accessToken: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return updatePasswordRaw(accessToken, newPassword);
}

export { completeRecoverySignIn, ensureFreshSession };
