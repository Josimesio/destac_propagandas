const modal = document.getElementById('loginModal');
const openLogin = document.getElementById('openLogin');
const closeLogin = document.getElementById('closeLogin');
const backdrop = document.getElementById('backdrop');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
const SUPABASE_URL = 'https://kvmayirfbdnexlzqnjvr.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
function showLogin(){
  modal.classList.add('active');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}
function hideLogin(){
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
  loginMessage.textContent='';
}

openLogin.addEventListener('click', showLogin);
closeLogin.addEventListener('click', hideLogin);
backdrop.addEventListener('click', hideLogin);

document.addEventListener('keydown', e => {
  if(e.key === 'Escape') hideLogin();
});

menuBtn.addEventListener('click', () => menu.classList.toggle('open'));
document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  loginMessage.style.color = '#6e688f';
  loginMessage.textContent = 'Entrando...';

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);

    loginMessage.style.color = '#a44f69';
    loginMessage.textContent = 'E-mail ou senha incorretos.';
    return;
  }

  if (!data.session) {
    loginMessage.style.color = '#a44f69';
    loginMessage.textContent = 'Não foi possível iniciar a sessão.';
    return;
  }

  loginMessage.style.color = '#4f7a57';
  loginMessage.textContent = 'Login realizado com sucesso.';

  setTimeout(() => {
    window.location.href = 'admin.html';
  }, 500);
});

document.getElementById('year').textContent = new Date().getFullYear();
