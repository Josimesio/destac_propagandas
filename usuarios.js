const SUPABASE_URL =
  'https://kvmayirfbdnexlzqnjvr.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


/* =========================================================
   ELEMENTOS DA TELA
========================================================= */

const formUsuario = document.getElementById('formUsuario');
const empresaSelect = document.getElementById('empresa');
const mensagem = document.getElementById('mensagem');
const btnSair = document.getElementById('btnSair');
const btnAtualizarUsuarios =
  document.getElementById('btnAtualizarUsuarios');


/* =========================================================
   CONTROLE DE EDIÇÃO
========================================================= */

let usuarioEditandoId = null;



/* =========================================================
   USUÁRIO CONECTADO
========================================================= */

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
      nome ||
      'Usuário';
  }


  if (perfilElemento) {

    perfilElemento.textContent =
      nomeAmigavelPerfilLogado(
        perfil
      );
  }
}


/* =========================================================
   VERIFICAR ACESSO
========================================================= */

async function verificarAcesso() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {

    window.location.href = 'index.html';

    return null;
  }


  const {
    data: perfil,
    error
  } = await supabaseClient
    .from('perfis_usuario')
    .select('nome, perfil, ativo')
    .eq('user_id', session.user.id)
    .single();


  if (
    error ||
    !perfil ||
    perfil.ativo !== true
  ) {

    await supabaseClient.auth.signOut();

    window.location.href = 'index.html';

    return null;
  }


  if (perfil.perfil !== 'SUPER_USUARIO') {

    alert(
      'Você não possui permissão para acessar o cadastro de usuários.'
    );

    window.location.href = 'admin.html';

    return null;
  }


  return session;
}


/* =========================================================
   CARREGAR EMPRESAS
========================================================= */

async function carregarEmpresas() {

  const {
    data,
    error
  } = await supabaseClient
    .from('empresas')
    .select(`
      id,
      razao_social,
      nome_fantasia
    `)
    .eq('ativo', true)
    .order('razao_social');


  if (error) {

    console.error(
      'Erro ao carregar empresas:',
      error
    );

    mensagem.style.color = '#a44f69';

    mensagem.textContent =
      'Erro ao carregar empresas.';

    return;
  }


  /*
   * Mantém apenas a opção inicial
   * "Acesso global".
   */
  empresaSelect.innerHTML = `
    <option value="">
      Acesso global
    </option>
  `;


  data.forEach((empresa) => {

    const option =
      document.createElement('option');

    option.value = empresa.id;

    option.textContent =
      empresa.nome_fantasia ||
      empresa.razao_social;

    empresaSelect.appendChild(option);
  });
}


/* =========================================================
   CADASTRAR USUÁRIO
========================================================= */

formUsuario.addEventListener(
  'submit',
  async (e) => {

    e.preventDefault();


    /*
     * Enquanto a rotina completa de atualização
     * não estiver implementada, evitamos criar
     * outro usuário acidentalmente ao editar.
     */
    if (usuarioEditandoId !== null) {

      mensagem.style.color = '#6e688f';
      mensagem.textContent = 'Salvando alterações...';

      const {
        data: { session }
      } = await supabaseClient.auth.getSession();

      if (!session) {
        mensagem.style.color = '#a44f69';
        mensagem.textContent =
          'Sua sessão expirou. Faça login novamente.';
        return;
      }

      const dadosAtualizacao = {
        id: usuarioEditandoId,

        nome:
          document
            .getElementById('nome')
            .value
            .trim(),

        email:
          document
            .getElementById('email')
            .value
            .trim(),

        telefone:
          document
            .getElementById('telefone')
            .value
            .trim() || null,

        cargo:
          document
            .getElementById('cargo')
            .value
            .trim() || null,

        empresa_id:
          empresaSelect.value === ''
            ? null
            : Number(empresaSelect.value),

        perfil:
          document
            .getElementById('perfil')
            .value,

        senha:
          document
            .getElementById('senha')
            .value,

        ativo:
          document
            .getElementById('ativo')
            .value === 'true'
      };

      try {
        const resposta = await fetch(
          `${SUPABASE_URL}/functions/v1/atualizar-usuario`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },

            body: JSON.stringify(dadosAtualizacao)
          }
        );

        const resultado = await resposta.json();

        if (!resposta.ok) {
          console.error(resultado);

          mensagem.style.color = '#a44f69';
          mensagem.textContent =
            resultado.erro ||
            'Erro ao atualizar usuário.';

          return;
        }

        mensagem.style.color = '#4f7a57';
        mensagem.textContent =
          'Usuário atualizado com sucesso.';

        usuarioEditandoId = null;

        formUsuario.reset();

        const campoSenha =
          document.getElementById('senha');

        campoSenha.required = true;
        campoSenha.placeholder = '';

        const botao =
          formUsuario.querySelector(
            'button[type="submit"]'
          );

        botao.textContent = 'Cadastrar usuário';

        await carregarUsuarios();

        return;

      } catch (erro) {
        console.error(erro);

        mensagem.style.color = '#a44f69';
        mensagem.textContent =
          'Não foi possível comunicar com o servidor.';

        return;
      }
    }


    mensagem.style.color = '#6e688f';

    mensagem.textContent =
      'Cadastrando usuário...';


    const empresaValor =
      empresaSelect.value;


    const dadosUsuario = {

      nome:
        document
          .getElementById('nome')
          .value
          .trim(),

      email:
        document
          .getElementById('email')
          .value
          .trim(),

      telefone:
        document
          .getElementById('telefone')
          .value
          .trim() || null,

      cargo:
        document
          .getElementById('cargo')
          .value
          .trim() || null,

      empresa_id:
        empresaValor === ''
          ? null
          : Number(empresaValor),

      perfil:
        document
          .getElementById('perfil')
          .value,

      senha:
        document
          .getElementById('senha')
          .value,

      ativo:
        document
          .getElementById('ativo')
          .value === 'true'
    };


    const {
      data: { session }
    } = await supabaseClient.auth.getSession();


    if (!session) {

      mensagem.style.color = '#a44f69';

      mensagem.textContent =
        'Sua sessão expirou. Faça login novamente.';

      return;
    }


    try {

      const resposta = await fetch(
        `${SUPABASE_URL}/functions/v1/criar-usuario`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            'Authorization':
              `Bearer ${session.access_token}`
          },

          body:
            JSON.stringify(dadosUsuario)
        }
      );


      const resultado =
        await resposta.json();


      if (!resposta.ok) {

        console.error(
          'Erro no cadastro:',
          resultado
        );

        mensagem.style.color = '#a44f69';

        mensagem.textContent =
          resultado.erro ||
          'Erro ao cadastrar usuário.';

        return;
      }


      mensagem.style.color = '#4f7a57';

      mensagem.textContent =
        'Usuário cadastrado com sucesso.';


      formUsuario.reset();


      /*
       * Recarrega a listagem automaticamente.
       */
      await carregarUsuarios();

    } catch (erro) {

      console.error(
        'Erro de comunicação:',
        erro
      );

      mensagem.style.color = '#a44f69';

      mensagem.textContent =
        'Não foi possível comunicar com o servidor.';
    }
  }
);


/* =========================================================
   PREPARAR EDIÇÃO
========================================================= */

function prepararEdicaoUsuario(usuario) {

  usuarioEditandoId =
    usuario.id;


  document
    .getElementById('nome')
    .value =
    usuario.nome || '';


  document
    .getElementById('email')
    .value =
    usuario.email || '';


  document
    .getElementById('telefone')
    .value =
    usuario.telefone || '';


  document
    .getElementById('cargo')
    .value =
    usuario.cargo || '';


  document
    .getElementById('empresa')
    .value =
    usuario.empresa_id ?? '';


  document
    .getElementById('perfil')
    .value =
    usuario.perfil || '';


  document
    .getElementById('ativo')
    .value =
    usuario.ativo
      ? 'true'
      : 'false';


  const campoSenha =
    document.getElementById('senha');


  campoSenha.value = '';

  campoSenha.required = false;

  campoSenha.placeholder =
    'Deixe em branco para manter a senha';


  const botao =
    formUsuario.querySelector(
      'button[type="submit"]'
    );


  botao.textContent =
    'Salvar alterações';


  mensagem.textContent = '';


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* =========================================================
   CARREGAR USUÁRIOS
========================================================= */

async function carregarUsuarios() {

  const listaUsuarios =
    document.getElementById(
      'listaUsuarios'
    );


  listaUsuarios.innerHTML = `
    <tr>
      <td colspan="7">
        Carregando usuários...
      </td>
    </tr>
  `;


  const {
    data,
    error
  } = await supabaseClient
    .from('perfis_usuario')
    .select(`
      id,
      nome,
      email,
      telefone,
      cargo,
      perfil,
      ativo,
      empresa_id
    `)
    .order('nome');


  if (error) {

    console.error(
      'Erro ao carregar usuários:',
      error
    );

    listaUsuarios.innerHTML = `
      <tr>
        <td colspan="7">
          Erro ao carregar usuários.
        </td>
      </tr>
    `;

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

    listaUsuarios.innerHTML = `
      <tr>
        <td colspan="7">
          Nenhum usuário cadastrado.
        </td>
      </tr>
    `;

    return;
  }


  /* =======================================================
     CARREGAR EMPRESAS PARA EXIBIÇÃO
  ======================================================= */

  const {
    data: empresas,
    error: empresasError
  } = await supabaseClient
    .from('empresas')
    .select(`
      id,
      razao_social,
      nome_fantasia
    `);


  if (empresasError) {

    console.error(
      'Erro ao carregar empresas:',
      empresasError
    );
  }


  const mapaEmpresas = {};


  if (empresas) {

    empresas.forEach((empresa) => {

      mapaEmpresas[empresa.id] =
        empresa.nome_fantasia ||
        empresa.razao_social;
    });
  }


  listaUsuarios.innerHTML = '';


  /* =======================================================
     MONTAR TABELA
  ======================================================= */

  data.forEach((usuario) => {

    const linha =
      document.createElement('tr');


    let nomePerfil =
      usuario.perfil;


    if (
      usuario.perfil ===
      'SUPER_USUARIO'
    ) {

      nomePerfil =
        'Super usuário';
    }


    if (
      usuario.perfil ===
      'ADMINISTRADOR'
    ) {

      nomePerfil =
        'Administrador';
    }


    if (
      usuario.perfil ===
      'USUARIO'
    ) {

      nomePerfil =
        'Usuário comum';
    }


    const empresaNome =
      usuario.empresa_id === null
        ? 'Acesso global'
        : mapaEmpresas[
        usuario.empresa_id
        ] ||
        'Empresa não encontrada';


    const status =
      usuario.ativo
        ? 'Ativo'
        : 'Inativo';


    linha.innerHTML = `

      <td>
        ${usuario.nome || ''}
      </td>

      <td>
        ${usuario.email || ''}
      </td>

      <td>
        ${usuario.cargo || '-'}
      </td>

      <td>
        ${nomePerfil}
      </td>

      <td>
        ${empresaNome}
      </td>

      <td>

        <span
          class="${usuario.ativo
        ? 'status-ativo'
        : 'status-inativo'
      }"
        >
          ${status}
        </span>

      </td>

      <td>

        <div class="acoes-usuario">

          <button
            type="button"
            class="btn-editar"
            data-id="${usuario.id}"
          >
            Editar
          </button>

          <button
            type="button"
            class="btn-status"
            data-id="${usuario.id}"
            data-ativo="${usuario.ativo}"
          >
            ${usuario.ativo
        ? 'Inativar'
        : 'Ativar'
      }
          </button>

        </div>

      </td>
    `;


    listaUsuarios.appendChild(linha);


    /* =====================================================
       BOTÃO EDITAR
    ===================================================== */

    linha
      .querySelector('.btn-editar')
      .addEventListener('click', () => {
        prepararEdicaoUsuario(usuario);
      });


    /* =====================================================
       BOTÃO ATIVAR / INATIVAR
    ===================================================== */

    linha
      .querySelector('.btn-status')
      .addEventListener('click', async () => {
        const novoStatus = !usuario.ativo;

        const acao = novoStatus
          ? 'ativar'
          : 'inativar';

        const confirmar = confirm(
          `Deseja realmente ${acao} o usuário "${usuario.nome}"?`
        );

        if (!confirmar) {
          return;
        }

        const {
          data: { session }
        } = await supabaseClient.auth.getSession();

        if (!session) {
          alert('Sua sessão expirou. Faça login novamente.');
          return;
        }

        const dadosAtualizacao = {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          telefone: usuario.telefone || null,
          cargo: usuario.cargo || null,
          empresa_id: usuario.empresa_id ?? null,
          perfil: usuario.perfil,
          senha: '',
          ativo: novoStatus
        };

        try {
          const resposta = await fetch(
            `${SUPABASE_URL}/functions/v1/atualizar-usuario`,
            {
              method: 'POST',

              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },

              body: JSON.stringify(dadosAtualizacao)
            }
          );

          const resultado = await resposta.json();

          if (!resposta.ok) {
            console.error(resultado);

            alert(
              resultado.erro ||
              'Erro ao alterar o status do usuário.'
            );

            return;
          }

          await carregarUsuarios();

        } catch (erro) {
          console.error(erro);

          alert(
            'Não foi possível comunicar com o servidor.'
          );
        }
      });

  });
}


/* =========================================================
   ATUALIZAR LISTA
========================================================= */

btnAtualizarUsuarios.addEventListener(
  'click',
  carregarUsuarios
);


/* =========================================================
   LOGOUT
========================================================= */

btnSair.addEventListener(
  'click',
  async (e) => {

    e.preventDefault();

    await supabaseClient.auth.signOut();

    window.location.href =
      'index.html';
  }
);


/* =========================================================
   INICIAR PÁGINA
========================================================= */

async function iniciarPagina() {

  const session =
    await verificarAcesso();


  if (!session) {
    return;
  }


  await carregarEmpresas();

  await carregarUsuarios();
}


iniciarPagina();