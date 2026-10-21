/* DESTAC: armazenamento da sessão individual por navegador/dispositivo. */
(function () {
  'use strict';
  const key = 'destac_lembrar_login';
  const tokenKey = 'sb-kvmayirfbdnexlzqnjvr-auth-token';
  window.destacCreateClient = function (url, anon, options) {
    if (!window.supabase?.createClient) throw new Error('Supabase indisponível');
    const selected = localStorage.getItem(key) === 'false' ? sessionStorage : localStorage;
    const cfg = Object.assign({}, options || {});
    cfg.auth = Object.assign({}, cfg.auth || {}, {storage:selected, persistSession:true, autoRefreshToken:true});
    return window.supabase.createClient(url, anon, cfg);
  };
  window.destacSetRemember = function (remember) {
    const from = localStorage.getItem(key) === 'false' ? sessionStorage : localStorage;
    const to = remember ? localStorage : sessionStorage;
    if (from !== to) {
      const old = from.getItem(tokenKey);
      if (old) to.setItem(tokenKey, old);
      from.removeItem(tokenKey);
    }
    localStorage.setItem(key, String(!!remember));
  };
  window.destacCleanOtherStorage = function () {
    (localStorage.getItem(key) === 'false' ? localStorage : sessionStorage).removeItem(tokenKey);
  };
})();
