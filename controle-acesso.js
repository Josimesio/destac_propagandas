/* DESTAC - Controle de navegação V2. As permissões de dados precisam de RLS no Supabase. */
(async function () {
  const mapa = {
    'admin.html':'admin','empresas.html':'empresas','clientes.html':'clientes',
    'cliente_novo.html':'clientes','consultar_clientes.html':'clientes',
    'importar_clientes.html':'clientes','contratos.html':'contratos',
    'contrato_novo.html':'contratos','consultar_contratos.html':'contratos',
    'dashboard_contratos.html':'dashboard_contratos',
    'financeiro.html':'financeiro','conciliacao_contratos.html':'conciliacao_contratos',
    'consultar_cnpj.html':'consultar_cnpj','buscar_cep.html':'buscar_cep',
    'usuarios.html':'usuarios','permissoes.html':'usuarios','auditoria.html':'analytics'
  };
  const rota = location.pathname.split('/').pop();
  const modulo = mapa[rota];
  if (!modulo || !window.supabase) return;

  const css = document.createElement('style');
  css.textContent = `
    .destac-bloqueado { opacity:.55!important; cursor:not-allowed!important; position:relative; }
    .destac-bloqueado:hover { opacity:.75!important; }
    .destac-bloqueado::after { content:attr(data-aviso); position:absolute; z-index:20;
      bottom:calc(100% + 8px); left:50%; transform:translateX(-50%); max-width:250px;
      width:max-content; white-space:normal; text-align:center; background:#302843; color:#fff;
      border-radius:10px; padding:9px 12px; font-size:12px; font-weight:600;
      line-height:1.4; box-shadow:0 7px 20px #30284333; pointer-events:none;
      opacity:0; visibility:hidden; transition:opacity .15s; }
    .destac-bloqueado:hover::after,.destac-bloqueado:focus-visible::after { opacity:1; visibility:visible; }
    .destac-aviso-flutuante { position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      z-index:9999999; background:#302843; color:#fff; padding:13px 20px;
      border-radius:12px; box-shadow:0 9px 28px #30284355; font:600 14px Inter,Arial,sans-serif;
      max-width:min(90vw,380px); text-align:center; }
  `;
  document.head.append(css);
  let avisoAtual;
  function avisar(msg) {
    if (avisoAtual) avisoAtual.remove();
    avisoAtual=document.createElement('div');
    avisoAtual.className='destac-aviso-flutuante';
    avisoAtual.setAttribute('role','status');
    avisoAtual.textContent=msg;
    document.body.append(avisoAtual);
    const referencia=avisoAtual;
    setTimeout(()=>{if(avisoAtual===referencia){referencia.remove();avisoAtual=null;}},3000);
  }
  function bloquear(elemento, mensagem, exibirOculto=false) {
    elemento.classList.add('destac-bloqueado');
    elemento.dataset.aviso=mensagem;
    elemento.setAttribute('aria-disabled','true');
    elemento.setAttribute('title',mensagem);
    if(exibirOculto) elemento.style.setProperty('display','block','important');
    if (!elemento.hasAttribute('tabindex')) elemento.setAttribute('tabindex','0');
    elemento.addEventListener('click',evento=>{evento.preventDefault();evento.stopImmediatePropagation();avisar(mensagem);},true);
    elemento.addEventListener('keydown',evento=>{
      if(evento.key==='Enter'||evento.key===' '){evento.preventDefault();avisar(mensagem);}
    });
  }
  const verificando=document.createElement('div');
  verificando.id='destacChecagem';
  verificando.style='position:fixed;inset:0;background:#f9f7fc;display:grid;place-items:center;z-index:999999;font:600 18px Arial;color:#483861';
  verificando.textContent='Verificando permissões de acesso...';
  document.body.append(verificando);
  try {
    const client=window.supabase.createClient('https://kvmayirfbdnexlzqnjvr.supabase.co','sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP');
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user){location.replace('index.html');return;}
    const cache=new Map();
    async function permitido(chave){
      if(!cache.has(chave))cache.set(chave,client.rpc('destac_tem_permissao',{p_modulo:chave,p_acao:'visualizar'}).then(r=>!r.error && r.data===true));
      return cache.get(chave);
    }
    if(!await permitido(modulo)){
      document.body.replaceChildren(verificando);
      verificando.textContent='';
      const cartao=document.createElement('div');cartao.style='text-align:center;max-width:480px;padding:28px';
      const titulo=document.createElement('h2');titulo.textContent='Acesso restrito';
      const descricao=document.createElement('p');descricao.textContent='Seu usuário não possui permissão para esta área.';
      const voltar=document.createElement('a');voltar.href='admin.html';voltar.textContent='Voltar ao início';
      cartao.append(titulo,descricao,voltar);verificando.append(cartao);return;
    }
    // Remove opções de navegação sem permissão, inclusive em páginas secundárias.
    // Não altera conteúdo público editorial que eventualmente menciona campanhas.
    const links=[...document.querySelectorAll('aside a[href], nav a[href], .atalhos-grid a[href]')];
    await Promise.all(links.map(async link=>{
      const href=(link.getAttribute('href')||'').split(/[?#]/)[0].split('/').pop();
      const destino=mapa[href];
      if (destino && !(await permitido(destino))) link.remove();
    }));
    // Módulos ainda não implantados não devem aparecer, nem mesmo cinza/desabilitados.
    document.querySelectorAll('aside nav a.disabled, aside nav a[aria-disabled="true"], .atalhos-grid .atalho-card[aria-disabled="true"]').forEach(el=>el.remove());
    verificando.remove();
  } catch(error) {
    console.error('Destac acesso',error);
    verificando.textContent='Não foi possível validar o acesso. Atualize a página.';
  }
})();
