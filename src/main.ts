import { mountApp } from './app.js';
import { initForAccount } from './store.js';
import { getAccountById, getSessionAccountId, isStorageAvailable, login, register } from './auth.js';
import { renderAuthScreen, renderStorageBlocked, type AuthMode } from './authView.js';

const root = document.getElementById('app');

function startApp(accountId: number): void {
  initForAccount(accountId);
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

  const form = root.querySelector<HTMLFormElement>('#auth-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '');
    const password = String(fd.get('password') || '');

    if (mode === 'register') {
      const password2 = String(fd.get('password2') || '');
      if (password !== password2) {
        renderAuth(mode, 'Пароли не совпадают');
        return;
      }
      register(email, password).then((result) => {
        if (!result.ok) {
          renderAuth(mode, result.error);
          return;
        }
        startApp(result.account.id);
      });
      return;
    }

    login(email, password).then((result) => {
      if (!result.ok) {
        renderAuth(mode, result.error);
        return;
      }
      startApp(result.account.id);
    });
  });
}

function renderStorageBlockedScreen(): void {
  if (!root) return;
  root.innerHTML = renderStorageBlocked();
  root.querySelector('[data-storage-retry]')?.addEventListener('click', () => location.reload());
}

function boot(): void {
  if (!isStorageAvailable()) {
    renderStorageBlockedScreen();
    return;
  }
  const sessionId = getSessionAccountId();
  if (sessionId != null && getAccountById(sessionId)) {
    startApp(sessionId);
  } else {
    renderAuth('login', null);
  }
}

boot();
