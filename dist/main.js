import { mountApp } from './app.js';
import { initForAccount } from './store.js';
import { hasSession, login, register } from './auth.js';
import { renderAuthScreen } from './authView.js';
const root = document.getElementById('app');
function renderLoading() {
    if (!root)
        return;
    root.innerHTML = `<div class="auth-screen"><p class="hint">Загрузка…</p></div>`;
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
function renderAuth(mode, error, info) {
    if (!root)
        return;
    root.innerHTML = renderAuthScreen(mode, error ?? null, info ?? null);
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
            register(email, password).then((result) => {
                if (!result.ok) {
                    reEnable();
                    renderAuth(mode, result.error);
                    return;
                }
                if ('needsEmailConfirmation' in result) {
                    renderAuth('login', null, 'Аккаунт создан. Проверьте почту и перейдите по ссылке для подтверждения, затем войдите.');
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
