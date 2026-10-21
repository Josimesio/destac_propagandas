const SUPABASE_URL =
  'https://kvmayirfbdnexlzqnjvr.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


const menuUsuarios =
  document.getElementById('menuUsuarios');

const atalhoUsuarios =
  document.getElementById('atalhoUsuarios');

const btnSair =
  document.getElementById('btnSair');

const tituloUsuario =
  document.getElementById('tituloUsuario');

const descricaoUsuario =
  document.getElementById('descricaoUsuario');


function nomeAmigavelPerfilLogado(perfil) {

  switch (perfil) {

    case 'SUPER_USUARIO':
      return 'Super usuário';

    case 'ADMINISTRADOR':
      return 'Administrador';

    case 'USUARIO':
      return 'Usuário comum';

    default:
      return perfil || '-';
  }
}


function mostrarUsuarioConectado(
  nome,
  perfil
) {

  const nomeElemento =
    document.getElementById(
      'nomeUsuarioConectado'
    );

  const perfilElemento =
    document.getElementById(
      'perfilUsuarioConectado'
    );


  if (nomeElemento) {
    nomeElemento.textContent =
      nome || 'Usuário';
  }


  if (perfilElemento) {
    perfilElemento.textContent =
      nomeAmigavelPerfilLogado(
        perfil
      );
  }
}


async function iniciarAdmin() {

  const {
    data: { session }
  } =
    await supabaseClient
      .auth
      .getSession();


  if (!session) {

    window.location.href =
      'index.html';

    return;
  }


  const {
    data: perfil,
    error
  } =
    await supabaseClient
      .from('perfis_usuario')
      .select(`
        id,
        user_id,
        nome,
        email,
        cargo,
        perfil,
        ativo,
        empresa_id
      `)
      .eq(
        'user_id',
        session.user.id
      )
      .single();


  if (
    error ||
    !perfil ||
    perfil.ativo !== true
  ) {

    console.error(
      'Erro ao validar perfil:',
      error
    );

    await supabaseClient
      .auth
      .signOut();

    window.location.href =
      'index.html';

    return;
  }


  mostrarUsuarioConectado(
    perfil.nome,
    perfil.perfil
  );


  if (tituloUsuario) {

    tituloUsuario.textContent =
      `Olá, ${perfil.nome || 'Usuário'}!`;
  }


  if (descricaoUsuario) {

    descricaoUsuario.textContent =
      `Perfil: ${nomeAmigavelPerfilLogado(
        perfil.perfil
      )}`;
  }


  const podeGerenciarUsuarios =
    perfil.perfil === 'SUPER_USUARIO' ||
    perfil.perfil === 'ADMINISTRADOR';


  const menuPermissoes = document.getElementById('menuPermissoes');
  if (menuPermissoes) menuPermissoes.style.display = podeGerenciarUsuarios ? '' : 'none';

  if (menuUsuarios) {

    menuUsuarios.style.display =
      podeGerenciarUsuarios
        ? 'block'
        : 'none';
  }


  if (atalhoUsuarios) {

    atalhoUsuarios.style.display =
      podeGerenciarUsuarios
        ? ''
        : 'none';
  }
}


if (btnSair) {

  btnSair.addEventListener(
    'click',
    async (e) => {

      e.preventDefault();

      await supabaseClient
        .auth
        .signOut();

      window.location.href =
        'index.html';
    }
  );
}


iniciarAdmin();
