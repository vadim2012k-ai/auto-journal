export type AuthMode = 'login' | 'register';

export function renderAuthScreen(mode: AuthMode, error: string | null): string {
  const isLogin = mode === 'login';
  return `
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-title">🚗 Автожурнал</div>
      <p class="hint">Прототип без сервера: аккаунт и данные хранятся в этом браузере. Вход с другого устройства пока недоступен.</p>

      <div class="auth-tabs">
        <button type="button" class="auth-tab ${isLogin ? 'auth-tab-active' : ''}" data-auth-tab="login">Войти</button>
        <button type="button" class="auth-tab ${!isLogin ? 'auth-tab-active' : ''}" data-auth-tab="register">Регистрация</button>
      </div>

      <form id="auth-form" class="sheet-body" data-mode="${mode}">
        <label>Email
          <input type="email" name="email" required autocomplete="username" placeholder="you@example.com" />
        </label>
        <label>Пароль
          <input type="password" name="password" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="минимум 6 символов" />
        </label>
        ${
          isLogin
            ? ''
            : `<label>Повторите пароль
          <input type="password" name="password2" required minlength="6" autocomplete="new-password" />
        </label>`
        }
        ${error ? `<p class="auth-error">${error}</p>` : ''}
        <button type="submit" class="btn btn-primary btn-block">${isLogin ? 'Войти' : 'Зарегистрироваться'}</button>
      </form>
    </div>
  </div>`;
}
