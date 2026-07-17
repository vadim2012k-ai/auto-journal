import { mountApp } from './app.js';
import { initForAccount } from './store.js';
import { getAccountById, getSessionAccountId, login, register } from './auth.js';
import { renderAuthScreen } from './authView.js';
const root = document.getElementById('app');
function startApp(accountId) {
    initForAccount(accountId);
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
    const form = root.querySelector('#auth-form');
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
const sessionId = getSessionAccountId();
if (sessionId != null && getAccountById(sessionId)) {
    startApp(sessionId);
}
else {
    renderAuth('login', null);
}
