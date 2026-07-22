// Авторизация через Supabase — настоящий аккаунт, доступный с любого
// устройства. Сама логика запросов — в supabase.ts, здесь только
// человекочитаемые обёртки для остального приложения.
import { completeRecoverySignIn, ensureFreshSession, getStoredSession, requestPasswordReset as requestPasswordResetRaw, signIn, signOut, signUp, updatePassword as updatePasswordRaw, } from './supabase.js';
export async function register(email, password) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@'))
        return { ok: false, error: 'Введите корректный email' };
    if (password.length < 6)
        return { ok: false, error: 'Пароль должен быть не короче 6 символов' };
    return signUp(normalized, password);
}
export async function login(email, password) {
    return signIn(email.trim().toLowerCase(), password);
}
export function logout() {
    signOut();
}
export function hasSession() {
    return getStoredSession() !== null;
}
export async function requestPasswordReset(email) {
    const redirectTo = window.location.origin + window.location.pathname;
    return requestPasswordResetRaw(email.trim().toLowerCase(), redirectTo);
}
export async function updatePassword(accessToken, newPassword) {
    return updatePasswordRaw(accessToken, newPassword);
}
export { completeRecoverySignIn, ensureFreshSession };
