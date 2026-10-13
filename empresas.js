const SUPABASE_URL =
  'https://kvmayirfbdnexlzqnjvr.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================================================
   ELEMENTOS
========================================================= */

const formEmpresa =
  document.getElementById('formEmpresa');

const mensagem =
  document.getElementById('mensagem');

const listaEmpresas =
  document.getElementById('listaEmpresas');

const btnAtualizarEmpresas =
  document.getElementById('btnAtualizarEmpresas');

const btnSair =
  document.getElementById('btnSair');

const menuUsuarios =
  document.getElementById('menuUsuarios');

const logoEmpresaInput =
  document.getElementById('logo_empresa');

const previewLogoEmpresa =
  document.getElementById('previewLogoEmpresa');

const previewLogoEmpresaBox =
  document.getElementById('previewLogoEmpresaBox');


let empresaEditandoId = null;
let perfilUsuarioLogado = null;
let logoUrlAtual = null;


/* =========================================================
   AUXILIARES
========================================================= */

function somenteNumeros(valor) {
  return String(valor || '')
    .replace(/\D/g, '');
}


function normalizarDocumento(valor) {
  return String(valor || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}


function aplicarMascaraCnpj(valor) {

  const caracteres =
    normalizarDocumento(valor)
      .slice(0, 14);

  let resultado =
    caracteres;

  if (caracteres.length > 2) {
    resultado =
      caracteres.slice(0, 2) +
      '.' +
      caracteres.slice(2);
  }

  if (caracteres.length > 5) {
    resultado =
      caracteres.slice(0, 2) +
      '.' +
      caracteres.slice(2, 5) +
      '.' +
      caracteres.slice(5);
  }

  if (caracteres.length > 8) {
    resultado =
      caracteres.slice(0, 2) +
      '.' +
      caracteres.slice(2, 5) +
      '.' +
      caracteres.slice(5, 8) +
      '/' +
      caracteres.slice(8);
  }

  if (caracteres.length > 12) {
    resultado =
      caracteres.slice(0, 2) +
      '.' +
      caracteres.slice(2, 5) +
      '.' +
      caracteres.slice(5, 8) +
      '/' +
      caracteres.slice(8, 12) +
      '-' +
      caracteres.slice(12, 14);
  }

  return resultado;
}


function aplicarMascaraTelefone(valor) {

  const numeros =
    somenteNumeros(valor)
      .slice(0, 10);

  return numeros
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}


function aplicarMascaraCelular(valor) {

  const numeros =
    somenteNumeros(valor)
      .slice(0, 11);

  return numeros
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}


function aplicarMascaraCep(valor) {

  const numeros =
    somenteNumeros(valor)
      .slice(0, 8);

  return numeros
    .replace(/^(\d{5})(\d)/, '$1-$2');
}


function valorOuNull(id) {

  const campo =
    document.getElementById(id);

  if (!campo) {
    return null;
  }

  const valor =
    campo.value.trim();

  return valor || null;
}


function preencherCampo(
  id,
  valor
) {

  const campo =
    document.getElementById(id);

  if (!campo) {
    return;
  }

  campo.value =
    valor ?? '';
}


/* =========================================================
   MÁSCARAS
========================================================= */

const campoCpfCnpj =
  document.getElementById('cpf_cnpj');

const campoTelefone =
  document.getElementById('telefone');

const campoCelular =
  document.getElementById('celular_whatsapp');

const campoCep =
  document.getElementById('cep');

const campoEstado =
  document.getElementById('estado');


if (campoCpfCnpj) {

  campoCpfCnpj.addEventListener(
    'input',
    () => {

      campoCpfCnpj.value =
        aplicarMascaraCnpj(
          campoCpfCnpj.value
        );
    }
  );
}


if (campoTelefone) {

  campoTelefone.addEventListener(
    'input',
    () => {

      campoTelefone.value =
        aplicarMascaraTelefone(
          campoTelefone.value
        );
    }
  );
}


if (campoCelular) {

  campoCelular.addEventListener(
    'input',
    () => {

      campoCelular.value =
        aplicarMascaraCelular(
          campoCelular.value
        );
    }
  );
}


if (campoCep) {

  campoCep.addEventListener(
    'input',
    () => {

      campoCep.value =
        aplicarMascaraCep(
          campoCep.value
        );
    }
  );
}


if (campoEstado) {

  campoEstado.addEventListener(
    'input',
    () => {

      campoEstado.value =
        campoEstado.value
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 2);
    }
  );
}


/* =========================================================
   PRÉVIA DA LOGO
========================================================= */

function mostrarPreviewLogo(
  origem
) {

  if (
    !previewLogoEmpresa ||
    !previewLogoEmpresaBox
  ) {
    return;
  }

  if (!origem) {

    previewLogoEmpresa.src =
      '';

    previewLogoEmpresaBox.style.display =
      'none';

    return;
  }

  previewLogoEmpresa.src =
    origem;

  previewLogoEmpresaBox.style.display =
    'block';
}


if (logoEmpresaInput) {

  logoEmpresaInput.addEventListener(
    'change',
    () => {

      const arquivo =
        logoEmpresaInput
          .files?.[0] ||
        null;


      if (!arquivo) {

        mostrarPreviewLogo(
          logoUrlAtual
        );

        return;
      }


      if (
        !validarArquivoLogo(
          arquivo
        )
      ) {

        logoEmpresaInput.value =
          '';

        mostrarPreviewLogo(
          logoUrlAtual
        );

        return;
      }


      const urlTemporaria =
        URL.createObjectURL(
          arquivo
        );


      mostrarPreviewLogo(
        urlTemporaria
      );
    }
  );
}


/* =========================================================
   LOGO DA EMPRESA
========================================================= */

function validarArquivoLogo(
  arquivo
) {

  if (!arquivo) {
    return true;
  }

  const tiposPermitidos = [
    'image/png',
    'image/jpeg',
    'image/webp'
  ];

  if (
    !tiposPermitidos.includes(
      arquivo.type
    )
  ) {

    mensagem.style.color =
      '#a44f69';

    mensagem.textContent =
      'A logo deve ser PNG, JPG ou WEBP.';

    return false;
  }

  const limiteBytes =
    5 * 1024 * 1024;

  if (
    arquivo.size >
    limiteBytes
  ) {

    mensagem.style.color =
      '#a44f69';

    mensagem.textContent =
      'A logo deve ter no máximo 5 MB.';

    return false;
  }

  return true;
}


function extensaoArquivo(
  arquivo
) {

  const nome =
    arquivo.name || '';

  const partes =
    nome.split('.');

  if (
    partes.length > 1
  ) {

    return partes
      .pop()
      .toLowerCase();
  }

  if (
    arquivo.type ===
    'image/png'
  ) {
    return 'png';
  }

  if (
    arquivo.type ===
    'image/webp'
  ) {
    return 'webp';
  }

  return 'jpg';
}


async function enviarLogoEmpresa(
  arquivo,
  empresaId
) {

  if (!arquivo) {
    return logoUrlAtual;
  }


  if (
    !validarArquivoLogo(
      arquivo
    )
  ) {
    throw new Error(
      'Arquivo de logo inválido.'
    );
  }


  const extensao =
    extensaoArquivo(
      arquivo
    );


  const caminho =
    `${empresaId}/${Date.now()}.${extensao}`;


  const {
    error: uploadError
  } =
    await supabaseClient
      .storage
      .from('logos-empresas')
      .upload(
        caminho,
        arquivo,
        {
          cacheControl:
            '3600',

          upsert:
            false,

          contentType:
            arquivo.type
        }
      );


  if (uploadError) {
    throw uploadError;
  }


  const {
    data: publicUrlData
  } =
    supabaseClient
      .storage
      .from('logos-empresas')
      .getPublicUrl(
        caminho
      );


  const urlPublica =
    publicUrlData
      ?.publicUrl ||
    null;


  if (!urlPublica) {
    throw new Error(
      'Não foi possível gerar a URL pública da logo.'
    );
  }


  return urlPublica;
}


async function salvarLogoNoCadastro(
  empresaId,
  logoUrl
) {

  const {
    error
  } =
    await supabaseClient
      .from('empresas')
      .update({
        logo_url:
          logoUrl,

        updated_at:
          new Date()
            .toISOString()
      })
      .eq(
        'id',
        empresaId
      );


  if (error) {
    throw error;
  }
}



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
  } =
    await supabaseClient
      .auth
      .getSession();


  if (!session) {

    window.location.href =
      'index.html';

    return null;
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
        perfil,
        ativo
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

    await supabaseClient
      .auth
      .signOut();

    window.location.href =
      'index.html';

    return null;
  }


  perfilUsuarioLogado =
    perfil.perfil;

  mostrarUsuarioConectado(
    perfil.nome,
    perfil.perfil
  );


  if (
    ![
      'SUPER_USUARIO',
      'ADMINISTRADOR'
    ].includes(
      perfilUsuarioLogado
    )
  ) {

    alert(
      'Você não possui permissão para gerenciar empresas.'
    );

    window.location.href =
      'admin.html';

    return null;
  }


  if (menuUsuarios) {
    menuUsuarios.style.display =
      'block';
  }


  return session;
}


/* =========================================================
   VERIFICAR DUPLICIDADE
========================================================= */

async function empresaJaExiste(
  documento,
  ignorarId = null
) {

  const documentoNormalizado =
    normalizarDocumento(
      documento
    );


  const {
    data,
    error
  } =
    await supabaseClient
      .from('empresas')
      .select(`
        id,
        cpf_cnpj
      `);


  if (error) {
    throw error;
  }


  return (data || []).some(
    (empresa) =>

      empresa.id !==
        ignorarId &&

      normalizarDocumento(
        empresa.cpf_cnpj
      ) ===
        documentoNormalizado
  );
}


/* =========================================================
   CADASTRAR / ATUALIZAR
========================================================= */

formEmpresa.addEventListener(
  'submit',
  async (e) => {

    e.preventDefault();


    const razaoSocial =
      document
        .getElementById('razao_social')
        .value
        .trim();

    const documento =
      document
        .getElementById('cpf_cnpj')
        .value
        .trim();


    if (
      !razaoSocial ||
      !documento
    ) {

      mensagem.style.color =
        '#a44f69';

      mensagem.textContent =
        'Preencha os campos obrigatórios marcados com *.';

      return;
    }


    if (
      normalizarDocumento(
        documento
      ).length !== 14
    ) {

      mensagem.style.color =
        '#a44f69';

      mensagem.textContent =
        'Informe um CNPJ válido com 14 caracteres.';

      campoCpfCnpj.focus();

      return;
    }


    try {

      const duplicado =
        await empresaJaExiste(
          documento,
          empresaEditandoId
        );


      if (duplicado) {

        mensagem.style.color =
          '#a44f69';

        mensagem.textContent =
          'Já existe uma empresa cadastrada com este CNPJ.';

        return;
      }

    } catch (erro) {

      console.error(
        'Erro ao verificar duplicidade:',
        erro
      );

      mensagem.style.color =
        '#a44f69';

      mensagem.textContent =
        'Não foi possível validar o CNPJ.';

      return;
    }


    const dadosEmpresa = {

      razao_social:
        razaoSocial,

      nome_fantasia:
        valorOuNull(
          'nome_fantasia'
        ),

      cpf_cnpj:
        documento,

      inscricao_estadual:
        valorOuNull(
          'inscricao_estadual'
        ),

      responsavel:
        valorOuNull(
          'responsavel'
        ),

      telefone:
        valorOuNull(
          'telefone'
        ),

      celular_whatsapp:
        valorOuNull(
          'celular_whatsapp'
        ),

      email:
        valorOuNull(
          'email'
        ),

      endereco:
        valorOuNull(
          'endereco'
        ),

      numero:
        valorOuNull(
          'numero'
        ),

      complemento:
        valorOuNull(
          'complemento'
        ),

      bairro:
        valorOuNull(
          'bairro'
        ),

      cidade:
        valorOuNull(
          'cidade'
        ),

      estado:
        valorOuNull(
          'estado'
        )
          ?.toUpperCase() ||
        null,

      cep:
        valorOuNull(
          'cep'
        ),

      site:
        valorOuNull(
          'site'
        ),

      observacoes:
        valorOuNull(
          'observacoes'
        ),

      logo_url:
        logoUrlAtual,

      ativo:
        document
          .getElementById('ativo')
          .value === 'true',

      updated_at:
        new Date().toISOString()
    };


    mensagem.style.color =
      '#6e688f';


    if (
      empresaEditandoId !== null
    ) {

      mensagem.textContent =
        'Salvando alterações...';


      const {
        error
      } =
        await supabaseClient
          .from('empresas')
          .update(
            dadosEmpresa
          )
          .eq(
            'id',
            empresaEditandoId
          );


      if (error) {

        console.error(error);

        mensagem.style.color =
          '#a44f69';

        mensagem.textContent =
          error.code === '23505'
            ? 'Já existe uma empresa cadastrada com este CNPJ.'
            : (
                error.message ||
                'Erro ao atualizar empresa.'
              );

        return;
      }


      try {

        const arquivoLogo =
          logoEmpresaInput
            ?.files?.[0] ||
          null;


        if (arquivoLogo) {

          mensagem.style.color =
            '#6e688f';

          mensagem.textContent =
            'Enviando logo da empresa...';


          const novaLogoUrl =
            await enviarLogoEmpresa(
              arquivoLogo,
              empresaEditandoId
            );


          await salvarLogoNoCadastro(
            empresaEditandoId,
            novaLogoUrl
          );


          logoUrlAtual =
            novaLogoUrl;
        }


      } catch (erroLogo) {

        console.error(
          'Erro ao enviar logo:',
          erroLogo
        );


        mensagem.style.color =
          '#a44f69';

        mensagem.textContent =
          erroLogo.message ||
          'Empresa atualizada, mas não foi possível salvar a logo.';

        return;
      }


      mensagem.style.color =
        '#4f7a57';

      mensagem.textContent =
        'Empresa atualizada com sucesso.';


      finalizarEdicao();

      await carregarEmpresas();

      return;
    }


    mensagem.textContent =
      'Cadastrando empresa...';


    const {
      data: novaEmpresa,
      error
    } =
      await supabaseClient
        .from('empresas')
        .insert(
          dadosEmpresa
        )
        .select(`
          id
        `)
        .single();


    if (error) {

      console.error(error);

      mensagem.style.color =
        '#a44f69';

      mensagem.textContent =
        error.code === '23505'
          ? 'Já existe uma empresa cadastrada com este CNPJ.'
          : (
              error.message ||
              'Erro ao cadastrar empresa.'
            );

      return;
    }


    try {

      const arquivoLogo =
        logoEmpresaInput
          ?.files?.[0] ||
        null;


      if (
        arquivoLogo &&
        novaEmpresa?.id
      ) {

        mensagem.style.color =
          '#6e688f';

        mensagem.textContent =
          'Enviando logo da empresa...';


        const novaLogoUrl =
          await enviarLogoEmpresa(
            arquivoLogo,
            novaEmpresa.id
          );


        await salvarLogoNoCadastro(
          novaEmpresa.id,
          novaLogoUrl
        );
      }


    } catch (erroLogo) {

      console.error(
        'Erro ao enviar logo:',
        erroLogo
      );


      mensagem.style.color =
        '#a44f69';

      mensagem.textContent =
        erroLogo.message ||
        'Empresa cadastrada, mas não foi possível salvar a logo.';

      await carregarEmpresas();

      return;
    }


    mensagem.style.color =
      '#4f7a57';

    mensagem.textContent =
      'Empresa cadastrada com sucesso.';


    formEmpresa.reset();

    logoUrlAtual =
      null;

    mostrarPreviewLogo(
      null
    );

    await carregarEmpresas();
  }
);


/* =========================================================
   PREPARAR EDIÇÃO
========================================================= */

function prepararEdicao(
  empresa
) {

  empresaEditandoId =
    empresa.id;

  logoUrlAtual =
    empresa.logo_url ||
    null;

  mostrarPreviewLogo(
    logoUrlAtual
  );


  preencherCampo(
    'razao_social',
    empresa.razao_social
  );

  preencherCampo(
    'nome_fantasia',
    empresa.nome_fantasia
  );

  preencherCampo(
    'cpf_cnpj',
    aplicarMascaraCnpj(
      empresa.cpf_cnpj
    )
  );

  preencherCampo(
    'inscricao_estadual',
    empresa.inscricao_estadual
  );

  preencherCampo(
    'responsavel',
    empresa.responsavel
  );

  preencherCampo(
    'telefone',
    aplicarMascaraTelefone(
      empresa.telefone
    )
  );

  preencherCampo(
    'celular_whatsapp',
    aplicarMascaraCelular(
      empresa.celular_whatsapp
    )
  );

  preencherCampo(
    'email',
    empresa.email
  );

  preencherCampo(
    'endereco',
    empresa.endereco
  );

  preencherCampo(
    'numero',
    empresa.numero
  );

  preencherCampo(
    'complemento',
    empresa.complemento
  );

  preencherCampo(
    'bairro',
    empresa.bairro
  );

  preencherCampo(
    'cidade',
    empresa.cidade
  );

  preencherCampo(
    'estado',
    empresa.estado
  );

  preencherCampo(
    'cep',
    aplicarMascaraCep(
      empresa.cep
    )
  );

  preencherCampo(
    'site',
    empresa.site
  );

  preencherCampo(
    'observacoes',
    empresa.observacoes
  );


  document
    .getElementById('ativo')
    .value =
      empresa.ativo
        ? 'true'
        : 'false';


  const botao =
    formEmpresa.querySelector(
      'button[type="submit"]'
    );


  if (botao) {
    botao.textContent =
      'Salvar alterações';
  }


  mensagem.style.color =
    '#6e688f';

  mensagem.textContent =
    logoUrlAtual
      ? 'Editando empresa. Uma logo já está cadastrada. Selecione outra imagem apenas se quiser substituí-la.'
      : 'Editando empresa. Faça as alterações e clique em Salvar alterações.';


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* =========================================================
   FINALIZAR EDIÇÃO
========================================================= */

function finalizarEdicao() {

  empresaEditandoId =
    null;

  logoUrlAtual =
    null;

  formEmpresa.reset();

  mostrarPreviewLogo(
    null
  );


  const botao =
    formEmpresa.querySelector(
      'button[type="submit"]'
    );


  if (botao) {
    botao.textContent =
      'Cadastrar empresa';
  }
}


/* =========================================================
   CARREGAR EMPRESAS
========================================================= */

async function carregarEmpresas() {

  listaEmpresas.innerHTML = `
    <tr>
      <td colspan="8">
        Carregando empresas...
      </td>
    </tr>
  `;


  const {
    data,
    error
  } =
    await supabaseClient
      .from('empresas')
      .select(`
        id,
        codigo_empresa,
        razao_social,
        nome_fantasia,
        cpf_cnpj,
        inscricao_estadual,
        responsavel,
        telefone,
        celular_whatsapp,
        email,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        cep,
        site,
        observacoes,
        logo_url,
        ativo
      `)
      .order(
        'razao_social'
      );


  if (error) {

    console.error(error);

    listaEmpresas.innerHTML = `
      <tr>
        <td colspan="8">
          Erro ao carregar empresas.
        </td>
      </tr>
    `;

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

    listaEmpresas.innerHTML = `
      <tr>
        <td colspan="8">
          Nenhuma empresa cadastrada.
        </td>
      </tr>
    `;

    return;
  }


  listaEmpresas.innerHTML =
    '';


  data.forEach(
    (empresa) => {

      const linha =
        document.createElement(
          'tr'
        );


      const nome =
        empresa.nome_fantasia ||
        empresa.razao_social;


      const cidade =
        [
          empresa.cidade,
          empresa.estado
        ]
          .filter(Boolean)
          .join(' / ') ||
        '-';


      linha.innerHTML = `

        <td>
          ${empresa.nome_fantasia || '-'}
        </td>

        <td>
          ${empresa.razao_social || '-'}
        </td>

        <td>
          ${empresa.cpf_cnpj || '-'}
        </td>

        <td>
          ${cidade}
        </td>

        <td>
          ${empresa.telefone || '-'}
        </td>

        <td>
          ${empresa.email || '-'}
        </td>

        <td>
          <span
            class="${
              empresa.ativo
                ? 'status-ativo'
                : 'status-inativo'
            }"
          >
            ${
              empresa.ativo
                ? 'Ativo'
                : 'Inativo'
            }
          </span>
        </td>

        <td>
          <div class="acoes-usuario">

            <button
              type="button"
              class="btn-editar"
            >
              Editar
            </button>

            <button
              type="button"
              class="btn-status"
            >
              ${
                empresa.ativo
                  ? 'Inativar'
                  : 'Ativar'
              }
            </button>

          </div>
        </td>
      `;


      listaEmpresas.appendChild(
        linha
      );


      linha
        .querySelector(
          '.btn-editar'
        )
        .addEventListener(
          'click',
          () => {

            prepararEdicao(
              empresa
            );
          }
        );


      linha
        .querySelector(
          '.btn-status'
        )
        .addEventListener(
          'click',
          async () => {

            const novoStatus =
              !empresa.ativo;


            const acao =
              novoStatus
                ? 'ativar'
                : 'inativar';


            const confirmar =
              confirm(
                `Deseja realmente ${acao} a empresa "${nome}"?`
              );


            if (!confirmar) {
              return;
            }


            const {
              error
            } =
              await supabaseClient
                .from('empresas')
                .update({
                  ativo:
                    novoStatus,

                  updated_at:
                    new Date()
                      .toISOString()
                })
                .eq(
                  'id',
                  empresa.id
                );


            if (error) {

              console.error(error);

              alert(
                error.message ||
                'Erro ao alterar o status da empresa.'
              );

              return;
            }


            await carregarEmpresas();
          }
        );
    }
  );
}


/* =========================================================
   ATUALIZAR LISTA
========================================================= */

btnAtualizarEmpresas.addEventListener(
  'click',
  carregarEmpresas
);


/* =========================================================
   LOGOUT
========================================================= */

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


/* =========================================================
   INICIAR
========================================================= */

async function iniciarPagina() {

  const session =
    await verificarAcesso();

  if (!session) {
    return;
  }

  await carregarEmpresas();
}


iniciarPagina();
