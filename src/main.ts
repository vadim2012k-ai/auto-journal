import { mountApp } from './app.js';
import { initForAccount } from './store.js';
import {
  completeRecoverySignIn,
  hasSession,
  login,
  register,
  requestPasswordReset,
  updatePassword,
  type RecoveryTokens,
} from './auth.js';
import {
  renderAuthScreen,
  renderCheckEmailScreen,
  renderNewPasswordScreen,
  renderRecoverScreen,
  renderRecoverSentScreen,
  type AuthMode,
} from './authView.js';

const root = document.getElementById('app');

type PasswordStrength = 'weak' | 'medium' | 'strong';

function passwordStrength(pw: string): PasswordStrength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-zа-я]/i.test(pw) && /[A-ZА-Я]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Zа-яА-Я0-9]/.test(pw)) score++;
  if (score <= 1) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'слабый',
  medium: 'средний',
  strong: 'надёжный',
};

/** Переключатели "показать/скрыть пароль" — общие для всех экранов с паролем. */
function wirePasswordToggles(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLButtonElement>('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling as HTMLInputElement | null;
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? '👁️' : '🙈';
      btn.setAttribute('aria-label', showing ? 'Показать пароль' : 'Скрыть пароль');
    });
  });
}

/** Живой индикатор сложности пароля — общий для регистрации и смены пароля. */
function wireStrengthLive(scope: HTMLElement): void {
  const strengthText = scope.querySelector<HTMLElement>('[data-strength-text]');
  const passwordInput = scope.querySelector<HTMLInputElement>('.password-input');
  if (!strengthText || !passwordInput) return;
  passwordInput.addEventListener('input', () => {
    const value = passwordInput.value;
    if (!value) {
      strengthText.textContent = 'Надёжность пароля: —';
      strengthText.removeAttribute('data-level');
      return;
    }
    const level = passwordStrength(value);
    strengthText.textContent = `Надёжность пароля: ${STRENGTH_LABEL[level]}`;
    strengthText.setAttribute('data-level', level);
  });
}

function renderLoading(): void {
  if (!root) return;
  root.innerHTML = `<div class="auth-screen"><p class="hint">Загрузка…</p></div>`;
}

function renderCheckEmail(email: string): void {
  if (!root) return;
  root.innerHTML = renderCheckEmailScreen(email);
  root.querySelector<HTMLButtonElement>('[data-auth-tab="login"]')?.addEventListener('click', () => {
    renderAuth('login', null);
  });
}

async function startApp(): Promise<void> {
  renderLoading();
  const ok = await initForAccount();
  if (!ok) {
    renderAuth('login', 'Сессия истекла — войдите ещё раз');
    return;
  }
  if (root) mountApp(root);
}

function renderAuth(mode: AuthMode, error: string | null): void {
  if (!root) return;
  root.innerHTML = renderAuthScreen(mode, error);
  wireAuthEvents(mode);
}

function wireAuthEvents(mode: AuthMode): void {
  if (!root) return;

  root.querySelectorAll<HTMLButtonElement>('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextMode = btn.dataset.authTab as AuthMode;
      if (nextMode !== mode) renderAuth(nextMode, null);
    });
  });

  wirePasswordToggles(root);
  if (mode === 'register') wireStrengthLive(root);

  root.querySelector<HTMLButtonElement>('[data-forgot-password]')?.addEventListener('click', () => {
    renderRecover(null);
  });

  const form = root.querySelector<HTMLFormElement>('#auth-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const fd = new FormData(form);
    const email = String(fd.get('email') || '');
    const password = String(fd.get('password') || '');

    const reEnable = () => {
      if (submitBtn) submitBtn.disabled = false;
    };

    if (mode === 'register') {
      const password2 = String(fd.get('password2') || '');
      if (password !== password2) {
        renderAuth(mode, 'Пароли не совпадают');
        return;
      }
      if (passwordStrength(password) === 'weak') {
        renderAuth(mode, 'Пароль слишком простой. Используйте минимум 8 символов и сочетайте буквы разного регистра, цифры или символы.');
        return;
      }
      register(email, password).then((result) => {
        if (!result.ok) {
          reEnable();
          renderAuth(mode, result.error);
          return;
        }
        if ('needsEmailConfirmation' in result) {
          renderCheckEmail(email);
          return;
        }
        startApp();
      });
      return;
    }

    login(email, password).then((result) => {
      if (!result.ok) {
        reEnable();
        renderAuth(mode, result.error);
        return;
      }
      startApp();
    });
  });
}

function renderRecover(error: string | null): void {
  if (!root) return;
  root.innerHTML = renderRecoverScreen(error);
  root.querySelectorAll<HTMLButtonElement>('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => renderAuth('login', null));
  });

  const form = root.querySelector<HTMLFormElement>('#recover-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const email = String(new FormData(form).get('email') || '');
    requestPasswordReset(email).then((result) => {
      if (!result.ok) {
        if (submitBtn) submitBtn.disabled = false;
        renderRecover(result.error);
        return;
      }
      renderRecoverSent(email);
    });
  });
}

function renderRecoverSent(email: string): void {
  if (!root) return;
  root.innerHTML = renderRecoverSentScreen(email);
  root.querySelectorAll<HTMLButtonElement>('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => renderAuth('login', null));
  });
}

function renderNewPassword(tokens: RecoveryTokens, error: string | null): void {
  if (!root) return;
  root.innerHTML = renderNewPasswordScreen(error);
  wirePasswordToggles(root);
  wireStrengthLive(root);

  const form = root.querySelector<HTMLFormElement>('#new-password-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const fd = new FormData(form);
    const password = String(fd.get('password') || '');
    const password2 = String(fd.get('password2') || '');

    if (password !== password2) {
      renderNewPassword(tokens, 'Пароли не совпадают');
      return;
    }
    if (passwordStrength(password) === 'weak') {
      renderNewPassword(
        tokens,
        'Пароль слишком простой. Используйте минимум 8 символов и сочетайте буквы разного регистра, цифры или символы.',
      );
      return;
    }
    if (submitBtn) submitBtn.disabled = true;

    updatePassword(tokens.accessToken, password).then(async (result) => {
      if (!result.ok) {
        renderNewPassword(tokens, result.error);
        return;
      }
      const session = await completeRecoverySignIn(tokens);
      if (!session) {
        renderAuth('login', 'Пароль изменён — войдите с новым паролем');
        return;
      }
      startApp();
    });
  });
}

/** Ссылка из письма восстановления возвращает токены в хэше адреса (#access_token=...&type=recovery). */
function parseRecoveryHash(): RecoveryTokens | null {
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (params.get('type') !== 'recovery') return null;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, expiresIn: Number(params.get('expires_in')) || 3600 };
}

function boot(): void {
  const recovery = parseRecoveryHash();
  if (recovery) {
    // Убираем токены из адресной строки, чтобы они не остались в истории браузера.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    renderNewPassword(recovery, null);
    return;
  }

  if (hasSession()) {
    startApp();
  } else {
    renderAuth('login', null);
  }
}

boot();
