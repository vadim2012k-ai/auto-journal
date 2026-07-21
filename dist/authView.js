export function renderCheckEmailScreen(email) {
    return `
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-title">📩 Проверьте почту</div>
      <p class="hint">
        Мы отправили письмо на <strong>${email}</strong>.
        Откройте его и нажмите на ссылку внутри — это подтвердит ваш email.
      </p>
      <p class="hint">
        После подтверждения вернитесь сюда и войдите с тем же email и паролем.
        Если письма нет 1–2 минуты — проверьте папку «Спам».
      </p>
      <button type="button" class="btn btn-primary btn-block" data-auth-tab="login">У меня есть подтверждение — войти</button>
    </div>
  </div>`;
}
export function renderAuthScreen(mode, error) {
    const isLogin = mode === 'login';
    return `
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-title">🚗 Автожурнал</div>
      <p class="hint">Один аккаунт — доступ с любого устройства, данные хранятся на сервере.</p>

      <div class="auth-tabs">
        <button type="button" class="auth-tab ${isLogin ? 'auth-tab-active' : ''}" data-auth-tab="login">Войти</button>
        <button type="button" class="auth-tab ${!isLogin ? 'auth-tab-active' : ''}" data-auth-tab="register">Регистрация</button>
      </div>

      <form id="auth-form" class="sheet-body" data-mode="${mode}">
        <label>Email
          <input type="email" name="email" required autocomplete="username" placeholder="you@example.com" />
        </label>
        <label>Пароль
          <div class="password-field">
            <input type="password" name="password" class="password-input" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="минимум 6 символов" />
            <button type="button" class="password-toggle" data-toggle-password aria-label="Показать пароль">👁️</button>
          </div>
        </label>
        ${isLogin
        ? ''
        : `<p class="password-strength-hint" data-strength-text>Надёжность пароля: —</p>
        <label>Повторите пароль
          <div class="password-field">
            <input type="password" name="password2" required minlength="6" autocomplete="new-password" />
            <button type="button" class="password-toggle" data-toggle-password aria-label="Показать пароль">👁️</button>
          </div>
        </label>`}
        ${error ? `<p class="auth-error">${error}</p>` : ''}
        <button type="submit" class="btn btn-primary btn-block">${isLogin ? 'Войти' : 'Зарегистрироваться'}</button>
      </form>
    </div>
  </div>`;
}
