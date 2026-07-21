import { mountApp } from './app.js';
import { initForAccount } from './store.js';
import { hasSession, login, register } from './auth.js';
import { renderAuthScreen, renderCheckEmailScreen } from './authView.js';
const root = document.getElementById('app');
function passwordStrength(pw) {
    let score = 0;
    if (pw.length >= 8)
        score++;
    if (pw.length >= 12)
        score++;
    if (/[a-zа-я]/i.test(pw) && /[A-ZА-Я]/.test(pw))
        score++;
    if (/\d/.test(pw))
        score++;
    if (/[^a-zA-Zа-яА-Я0-9]/.test(pw))
        score++;
    if (score <= 1)
        return 'weak';
    if (score <= 3)
        return 'medium';
    return 'strong';
}
const STRENGTH_LABEL = {
    weak: 'слабый',
    medium: 'средний',
    strong: 'надёжный',
};
function renderLoading() {
    if (!root)
        return;
    root.innerHTML = `<div class="auth-screen"><p class="hint">Загрузка…</p></div>`;
}
function renderCheckEmail(email) {
    if (!root)
        return;
    root.innerHTML = renderCheckEmailScreen(email);
    root.querySelector('[data-auth-tab="login"]')?.addEventListener('click', () => {
        renderAuth('login', null);
    });
}
async function startApp() {
    renderLoading();
    const ok = await initForAccount();
    if (!ok) {
        renderAuth('login', 'Сессия истекла — войдите ещё раз');
        return;
    }
    if (root)
        mountApp(root);
}
function renderAuth(mode, error) {
    if (!root)
        return;
    root.innerHTML = renderAuthScreen(mode, error);
    wireAuthEvents(mode);
}
function wireAuthEvents(mode) {
    if (!root)
        return;
    root.querySelectorAll('[data-auth-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextMode = btn.dataset.authTab;
            if (nextMode !== mode)
                renderAuth(nextMode, null);
        });
    });
    root.querySelectorAll('[data-toggle-password]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            if (!input)
                return;
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btn.textContent = showing ? '👁️' : '🙈';
            btn.setAttribute('aria-label', showing ? 'Показать пароль' : 'Скрыть пароль');
        });
    });
    const strengthText = root.querySelector('[data-strength-text]');
    const passwordInput = root.querySelector('.password-input');
    if (mode === 'register' && strengthText && passwordInput) {
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
    const form = root.querySelector('#auth-form');
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn)
            submitBtn.disabled = true;
        const fd = new FormData(form);
        const email = String(fd.get('email') || '');
        const password = String(fd.get('password') || '');
        const reEnable = () => {
            if (submitBtn)
                submitBtn.disabled = false;
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
function boot() {
    if (hasSession()) {
        startApp();
    }
    else {
        renderAuth('login', null);
    }
}
boot();
