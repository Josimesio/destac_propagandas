/* Portal público DESTAC — restauração do login original (Supabase Auth). */
'use strict';
const SUPABASE_URL = 'https://kvmayirfbdnexlzqnjvr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const loginButton = loginForm.querySelector('button[type="submit"]');
const emailField = document.getElementById('email');
const closeButton = document.getElementById('closeLogin');
let loginClient;
let lastFocus;
function abrirLogin(event) {
  if (event) event.preventDefault();
  lastFocus = document.activeElement;
  loginModal.classList.add('active');
  loginModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  loginMessage.textContent = '';
  emailField.focus();
}
function fecharLogin() {
  loginModal.classList.remove('active');
  loginModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  loginMessage.textContent = '';
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
}
document.querySelectorAll('[data-open-login]').forEach(link => link.addEventListener('click', abrirLogin));
closeButton.addEventListener('click', fecharLogin);
document.getElementById('backdrop').addEventListener('click', fecharLogin);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && loginModal.classList.contains('active')) fecharLogin(); });
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = emailField.value.trim();
  const password = document.getElementById('password').value;
  loginMessage.style.color = '#736a79';
  loginMessage.textContent = 'Entrando...';
  loginButton.disabled = true;
  try {
    if (!window.supabase || typeof window.supabase.createClient !== 'function')
      throw new Error('A biblioteca de autenticação não foi carregada. Verifique a conexão de internet.');
    if (!loginClient) loginClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const {data, error} = await loginClient.auth.signInWithPassword({email, password});
    if (error) {
      loginMessage.style.color = '#a44f69';
      loginMessage.textContent = 'Não foi possível entrar. Verifique seu e-mail e senha.';
      return;
    }
    if (!data || !data.session) throw new Error('Sessão não foi iniciada.');
    loginMessage.style.color = '#655474';
    loginMessage.textContent = 'Acesso autorizado. Abrindo painel...';
    window.location.assign('admin.html');
  } catch (error) {
    console.error('Falha ao realizar login:', error);
    loginMessage.style.color = '#a44f69';
    loginMessage.textContent = error.message || 'Não foi possível entrar. Tente novamente.';
  } finally { loginButton.disabled = false; }
});
