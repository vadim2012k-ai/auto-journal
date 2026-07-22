export type AuthMode = 'login' | 'register';

export function renderCheckEmailScreen(email: string): string {
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

export function renderAuthScreen(mode: AuthMode, error: string | null): string {
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
        ${
          isLogin
            ? ''
            : `<p class="password-strength-hint" data-strength-text>Надёжность пароля: —</p>
        <label>Повторите пароль
          <div class="password-field">
            <input type="password" name="password2" required minlength="6" autocomplete="new-password" />
            <button type="button" class="password-toggle" data-toggle-password aria-label="Показать пароль">👁️</button>
          </div>
        </label>`
        }
        ${error ? `<p class="auth-error">${error}</p>` : ''}
        <button type="submit" class="btn btn-primary btn-block">${isLogin ? 'Войти' : 'Зарегистрироваться'}</button>
        ${isLogin ? `<button type="button" class="link-btn" data-forgot-password>Забыли пароль?</button>` : ''}
      </form>
    </div>
  </div>`;
}

export function renderRecoverScreen(error: string | null): string {
  return `
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-title">🔑 Восстановление пароля</div>
      <p class="hint">Введите email аккаунта — пришлём ссылку для сброса пароля.</p>
      <form id="recover-form" class="sheet-body">
        <label>Email
          <input type="email" name="email" required autocomplete="username" placeholder="you@example.com" />
        </label>
        ${error ? `<p class="auth-error">${error}</p>` : ''}
        <button type="submit" class="btn btn-primary btn-block">Отправить письмо</button>
        <button type="button" class="btn btn-secondary btn-block" data-auth-tab="login">Назад ко входу</button>
      </form>
    </div>
  </div>`;
}

export function renderRecoverSentScreen(email: string): string {
  return `
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-title">📩 Проверьте почту</div>
      <p class="hint">
        Мы отправили письмо на <strong>${email}</strong> со ссылкой для сброса пароля.
        Перейдите по ней, чтобы задать новый пароль.
      </p>
      <p class="hint">Если письма нет 1–2 минуты — проверьте папку «Спам».</p>
      <button type="button" class="btn btn-primary btn-block" data-auth-tab="login">Назад ко входу</button>
    </div>
  </div>`;
}

export function renderNewPasswordScreen(error: string | null): string {
  return `
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-title">🔑 Новый пароль</div>
      <p class="hint">Придумайте новый пароль для входа в аккаунт.</p>
      <form id="new-password-form" class="sheet-body">
        <label>Новый пароль
          <div class="password-field">
            <input type="password" name="password" class="password-input" required minlength="6" autocomplete="new-password" placeholder="минимум 6 символов" />
            <button type="button" class="password-toggle" data-toggle-password aria-label="Показать пароль">👁️</button>
          </div>
        </label>
        <p class="password-strength-hint" data-strength-text>Надёжность пароля: —</p>
        <label>Повторите пароль
          <div class="password-field">
            <input type="password" name="password2" required minlength="6" autocomplete="new-password" />
            <button type="button" class="password-toggle" data-toggle-password aria-label="Показать пароль">👁️</button>
          </div>
        </label>
        ${error ? `<p class="auth-error">${error}</p>` : ''}
        <button type="submit" class="btn btn-primary btn-block">Сохранить новый пароль</button>
      </form>
    </div>
  </div>`;
}
