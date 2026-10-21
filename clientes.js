const SUPABASE_URL =
  'https://kvmayirfbdnexlzqnjvr.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


const formCliente =
  document.getElementById('formCliente');

const mensagem =
  document.getElementById('mensagem');

const listaClientes =
  document.getElementById('listaClientes');

const btnAtualizarClientes =
  document.getElementById('btnAtualizarClientes');

const btnImportarCSV =
  document.getElementById('btnImportarCSV');

const arquivoCSV =
  document.getElementById('arquivoCSV');

const mensagemImportacao =
  document.getElementById('mensagemImportacao');

const btnSair =
  document.getElementById('btnSair');

const menuUsuarios =
  document.getElementById('menuUsuarios');

const btnBuscarCnpj =
  document.getElementById('btnBuscarCnpj');

const statusCnpj =
  document.getElementById('statusCnpj');

const pesquisaCliente = document.getElementById('pesquisaCliente');
const itensPorPagina = document.getElementById('itensPorPagina');
const infoPaginacao = document.getElementById('infoPaginacao');
const paginaAtualTexto = document.getElementById('paginaAtualTexto');
const btnPaginaAnterior = document.getElementById('btnPaginaAnterior');
const btnProximaPagina = document.getElementById('btnProximaPagina');
const contadorClientes = document.getElementById('contadorClientes');
const tabConsulta = document.getElementById('tabConsulta');
const tabNovo = document.getElementById('tabNovo');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
const btnVoltarConsulta = document.getElementById('btnVoltarConsulta');
const tituloFormularioCliente = document.getElementById('tituloFormularioCliente');

let todosClientes = [];
let paginaAtual = 1;
let termoPesquisaCliente = '';

let perfilUsuarioLogado = null;
let empresaUsuarioLogado = null;
let dadosCnpjConsultado = null;
let clienteEditandoId = null;

// Permissões obtidas do servidor; na dúvida, negar a edição.
let permissaoEditarClientes = false;
async function conferirEdicaoClientes() {
  try {
    const { data, error } = await supabaseClient.rpc('destac_tem_permissao', {
      p_modulo: 'clientes', p_acao: 'editar'
    });
    permissaoEditarClientes = !error && data === true;
    return permissaoEditarClientes;
  } catch (erro) {
    console.error('Permissão de edição de clientes:', erro);
    permissaoEditarClientes = false;
    return false;
  }
}
function avisarEdicaoRestrita() {
  alert('Acesso restrito: seu usuário não possui permissão para editar clientes.');
}
// Verificar no carregamento e atualizar os botões, sem liberar acesso durante a consulta.
conferirEdicaoClientes().then(() => renderizarClientes());


function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mostrarAbaClientes(alvo) {
  document.querySelectorAll('.clientes-view').forEach(secao => {
    secao.classList.toggle('active', secao.id === alvo);
  });

  document.querySelectorAll('.clientes-tab').forEach(botao => {
    botao.classList.toggle('active', botao.dataset.target === alvo);
  });

  if (window.history && window.history.replaceState) {
    const hash = alvo === 'novoCliente' ? '#novo' : '#consulta';
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }
}

function atualizarModoFormulario(editando = false) {
  const botaoSalvar = formCliente?.querySelector('button[type="submit"]');
  if (tituloFormularioCliente) {
    tituloFormularioCliente.textContent = editando ? 'Editar cliente' : 'Cadastrar cliente';
  }
  if (botaoSalvar) {
    botaoSalvar.textContent = editando ? 'Salvar alterações' : 'Cadastrar cliente';
  }
  if (btnCancelarEdicao) {
    btnCancelarEdicao.style.display = editando ? '' : 'none';
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
    .select(`
      id,
      user_id,
      nome,
      perfil,
      ativo,
      empresa_id
    `)
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

  perfilUsuarioLogado =
    perfil.perfil;

  empresaUsuarioLogado =
    perfil.empresa_id;

  mostrarUsuarioConectado(
    perfil.nome,
    perfil.perfil
  );

  if (
    perfilUsuarioLogado === 'SUPER_USUARIO' ||
    perfilUsuarioLogado === 'ADMINISTRADOR'
  ) {
    if (menuUsuarios) {
      menuUsuarios.style.display = 'block';
    }
  }

  return session;
}


/* =========================================================
   NORMALIZAR / VALIDAR CPF-CNPJ
========================================================= */

function normalizarCpfCnpj(valor) {

  return String(valor || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}


async function clienteJaExiste(
  cpfCnpj,
  ignorarId = null
) {

  const documentoNormalizado =
    normalizarCpfCnpj(cpfCnpj);

  if (!documentoNormalizado) {
    return false;
  }

  const {
    data,
    error
  } = await supabaseClient
    .from('clientes')
    .select(`
      id,
      cpf_cnpj
    `);

  if (error) {
    console.error(
      'Erro ao verificar duplicidade:',
      error
    );

    throw error;
  }

  return (data || []).some(
    (cliente) =>
      cliente.id !== ignorarId &&
      normalizarCpfCnpj(
        cliente.cpf_cnpj
      ) === documentoNormalizado
  );
}



/* =========================================================
   CÓDIGO AUTOMÁTICO DO CLIENTE
   Mantém o padrão já existente no banco.
========================================================= */

function criarGeradorCodigoCliente(codigosExistentes) {
  const usados = new Set(
    (codigosExistentes || [])
      .map(c => String(c || '').trim().toUpperCase())
      .filter(Boolean)
  );

  let maiorNumero = 0;

  usados.forEach(codigo => {
    const match = codigo.match(/^CLI-(\d{6})$/i);
    if (!match) return;
    const numero = Number(match[1]);
    if (Number.isFinite(numero)) maiorNumero = Math.max(maiorNumero, numero);
  });

  let proximo = maiorNumero + 1;

  return function gerar() {
    while (true) {
      const codigo = `CLI-${String(proximo).padStart(6, '0')}`;
      proximo += 1;

      if (!usados.has(codigo)) {
        usados.add(codigo);
        return codigo;
      }
    }
  };
}

async function obterGeradorCodigoCliente() {
  const codigos = [];
  const tamanhoPagina = 1000;
  let inicio = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('codigo_cliente')
      .range(inicio, inicio + tamanhoPagina - 1);

    if (error) throw error;

    (data || []).forEach(item => {
      if (item.codigo_cliente !== undefined && item.codigo_cliente !== null && String(item.codigo_cliente).trim() !== '') {
        codigos.push(String(item.codigo_cliente).trim());
      }
    });

    if (!data || data.length < tamanhoPagina) break;
    inicio += tamanhoPagina;
  }

  return criarGeradorCodigoCliente(codigos);
}

/* =========================================================
   MÁSCARA CPF / CNPJ
========================================================= */

function aplicarMascaraCPF(valor) {

  const numeros =
    String(valor || '')
      .replace(/\D/g, '')
      .slice(0, 11);

  return numeros
    .replace(
      /^(\d{3})(\d)/,
      '$1.$2'
    )
    .replace(
      /^(\d{3})\.(\d{3})(\d)/,
      '$1.$2.$3'
    )
    .replace(
      /\.(\d{3})(\d)/,
      '.$1-$2'
    );
}


function aplicarMascaraCNPJ(valor) {

  /*
   * Mantém letras e números para suportar
   * também o novo CNPJ alfanumérico.
   */
  const caracteres =
    String(valor || '')
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
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


function atualizarMascaraCpfCnpj() {

  const campo =
    document.getElementById(
      'cpf_cnpj'
    );

  const tipoPessoa =
    document.getElementById(
      'tipo_pessoa'
    );

  if (
    !campo ||
    !tipoPessoa
  ) {
    return;
  }


  if (
    tipoPessoa.value ===
    'FISICA'
  ) {

    campo.value =
      aplicarMascaraCPF(
        campo.value
      );

    campo.maxLength =
      14;

    campo.placeholder =
      '000.000.000-00';

    return;
  }


  if (
    tipoPessoa.value ===
    'JURIDICA'
  ) {

    campo.value =
      aplicarMascaraCNPJ(
        campo.value
      );

    campo.maxLength =
      18;

    campo.placeholder =
      '00.000.000/0000-00';

    return;
  }


  /*
   * Se o tipo de pessoa ainda não foi selecionado,
   * CPF é usado até 11 caracteres numéricos.
   * Acima disso, aplica o formato de CNPJ.
   */
  const valorLimpo =
    normalizarCpfCnpj(
      campo.value
    );

  if (
    /^[0-9]+$/.test(
      valorLimpo
    ) &&
    valorLimpo.length <= 11
  ) {

    campo.value =
      aplicarMascaraCPF(
        campo.value
      );

    campo.maxLength =
      14;

  } else {

    campo.value =
      aplicarMascaraCNPJ(
        campo.value
      );

    campo.maxLength =
      18;
  }
}


const campoCpfCnpj =
  document.getElementById(
    'cpf_cnpj'
  );

const campoTipoPessoa =
  document.getElementById(
    'tipo_pessoa'
  );


if (campoCpfCnpj) {

  campoCpfCnpj.addEventListener(
    'input',
    atualizarMascaraCpfCnpj
  );

  campoCpfCnpj.addEventListener(
    'blur',
    () => {
      atualizarMascaraCpfCnpj();
      atualizarAutorizacaoCnpjInvalido();
    }
  );
}


if (campoTipoPessoa) {

  campoTipoPessoa.addEventListener(
    'change',
    () => {

      if (campoCpfCnpj) {
        campoCpfCnpj.value = '';
      }

      ajustarBotaoDocumento();
      atualizarMascaraCpfCnpj();
      ocultarAutorizacaoCnpjInvalido();

      if (campoCpfCnpj) {
        campoCpfCnpj.focus();
      }
    }
  );
}


/* =========================================================
   CAMPOS COMPLEMENTARES DO CNPJ
========================================================= */

function limparCamposComplementaresCnpj() {

  dadosCnpjConsultado = null;

  const ids = [
    'situacao_cadastral',
    'data_inicio_atividade',
    'natureza_juridica',
    'porte',
    'capital_social',
    'cnae_principal',
    'matriz_filial',
    'socios'
  ];

  ids.forEach((id) => {

    const campo =
      document.getElementById(id);

    if (campo) {
      campo.value = '';
    }
  });
}


function formatarSocios(socios) {

  if (
    !Array.isArray(socios) ||
    socios.length === 0
  ) {
    return '';
  }

  return socios
    .map((socio) => {

      const nome =
        socio.nome_socio ||
        socio.nome ||
        '';

      const qualificacao =
        socio.qualificacao_socio ||
        socio.qualificacao ||
        '';

      if (
        nome &&
        qualificacao
      ) {
        return `${nome} - ${qualificacao}`;
      }

      return nome ||
        qualificacao ||
        '';
    })
    .filter(Boolean)
    .join('\n');
}


function preencherCampoSeHouver(
  id,
  valor
) {

  const campo =
    document.getElementById(id);

  if (
    !campo ||
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
  ) {
    return;
  }

  campo.value =
    String(valor);
}


/* =========================================================
   VALIDAÇÕES E MÁSCARAS ADICIONAIS
========================================================= */

function somenteNumeros(valor) {
  return String(valor || '')
    .replace(/\D/g, '');
}

function aplicarMascaraTelefone(valor) {
  const numeros = somenteNumeros(valor).slice(0, 10);
  return numeros
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function aplicarMascaraCelular(valor) {
  const numeros = somenteNumeros(valor).slice(0, 11);
  return numeros
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function aplicarMascaraCep(valor) {
  const numeros = somenteNumeros(valor).slice(0, 8);
  return numeros
    .replace(/^(\d{5})(\d)/, '$1-$2');
}

function validarCPF(cpf) {
  const numeros = somenteNumeros(cpf);

  if (numeros.length !== 11 || /^(\d)\1{10}$/.test(numeros)) {
    return false;
  }

  let soma = 0;

  for (let i = 0; i < 9; i++) {
    soma += Number(numeros[i]) * (10 - i);
  }

  let digito1 = (soma * 10) % 11;
  if (digito1 === 10) digito1 = 0;

  if (digito1 !== Number(numeros[9])) {
    return false;
  }

  soma = 0;

  for (let i = 0; i < 10; i++) {
    soma += Number(numeros[i]) * (11 - i);
  }

  let digito2 = (soma * 10) % 11;
  if (digito2 === 10) digito2 = 0;

  return digito2 === Number(numeros[10]);
}

function validarCNPJNumerico(cnpj) {
  const numeros = somenteNumeros(cnpj);

  if (numeros.length !== 14 || /^(\d)\1{13}$/.test(numeros)) {
    return false;
  }

  const calc = (base, pesos) => {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) {
      soma += Number(base[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = calc(numeros.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const d2 = calc(numeros.slice(0, 12) + d1, [6,5,4,3,2,9,8,7,6,5,4,3,2]);

  return Number(numeros[12]) === d1 && Number(numeros[13]) === d2;
}

function obterAutorizacaoCnpjInvalido() {
  return {
    caixa:
      document.getElementById(
        'autorizacaoCnpjInvalido'
      ),
    checkbox:
      document.getElementById(
        'autorizarCnpjInvalido'
      ),
    status:
      document.getElementById(
        'statusCnpj'
      )
  };
}


function mostrarAutorizacaoCnpjInvalido() {
  const {
    caixa,
    status
  } =
    obterAutorizacaoCnpjInvalido();

  if (caixa) {
    caixa.style.display =
      'block';
  }

  if (status) {
    status.style.color =
      '#a44f69';

    status.textContent =
      'CNPJ inválido. Se quiser cadastrar este cliente mesmo assim, marque a autorização abaixo.';
  }
}


function ocultarAutorizacaoCnpjInvalido() {
  const {
    caixa,
    checkbox
  } =
    obterAutorizacaoCnpjInvalido();

  if (caixa) {
    caixa.style.display =
      'none';
  }

  if (checkbox) {
    checkbox.checked =
      false;
  }
}


function cnpjInvalidoAutorizado() {
  const {
    checkbox
  } =
    obterAutorizacaoCnpjInvalido();

  return Boolean(
    checkbox &&
    checkbox.checked
  );
}


function atualizarAutorizacaoCnpjInvalido() {
  const tipo =
    document.getElementById(
      'tipo_pessoa'
    )?.value;

  const campo =
    document.getElementById(
      'cpf_cnpj'
    );

  if (
    tipo !== 'JURIDICA' ||
    !campo
  ) {
    ocultarAutorizacaoCnpjInvalido();
    return false;
  }

  const limpo =
    normalizarCpfCnpj(
      campo.value
    );

  const cnpjNumericoCompleto =
    /^[0-9]{14}$/.test(
      limpo
    );

  const invalido =
    cnpjNumericoCompleto &&
    !validarCNPJNumerico(
      campo.value
    );

  if (invalido) {
    mostrarAutorizacaoCnpjInvalido();
    return true;
  }

  ocultarAutorizacaoCnpjInvalido();
  return false;
}


function validarDocumentoPorTipo() {
  const tipo =
    document.getElementById(
      'tipo_pessoa'
    )?.value;

  const campo =
    document.getElementById(
      'cpf_cnpj'
    );

  if (
    !campo ||
    !campo.value.trim()
  ) {
    return false;
  }

  if (
    tipo === 'FISICA' &&
    !validarCPF(
      campo.value
    )
  ) {
    ocultarAutorizacaoCnpjInvalido();

    mensagem.style.color =
      '#a44f69';

    mensagem.textContent =
      'CPF inválido. Verifique o número informado.';

    campo.focus();

    return false;
  }

  if (
    tipo === 'JURIDICA'
  ) {
    const limpo =
      normalizarCpfCnpj(
        campo.value
      );

    if (
      /^[0-9]+$/.test(
        limpo
      )
    ) {
      if (
        !validarCNPJNumerico(
          campo.value
        )
      ) {
        mostrarAutorizacaoCnpjInvalido();

        if (
          cnpjInvalidoAutorizado()
        ) {
          mensagem.style.color =
            '#8a5a13';

          mensagem.textContent =
            'CNPJ inválido autorizado manualmente. O cadastro será realizado mesmo assim.';

          return true;
        }

        mensagem.style.color =
          '#a44f69';

        mensagem.textContent =
          'CNPJ inválido. Marque a autorização abaixo para permitir o cadastro deste cliente.';

        const checkbox =
          document.getElementById(
            'autorizarCnpjInvalido'
          );

        if (checkbox) {
          checkbox.focus();
        } else {
          campo.focus();
        }

        return false;
      }

      ocultarAutorizacaoCnpjInvalido();

    } else if (
      limpo.length !== 14
    ) {
      ocultarAutorizacaoCnpjInvalido();

      mensagem.style.color =
        '#a44f69';

      mensagem.textContent =
        'CNPJ alfanumérico inválido. Informe 14 caracteres.';

      campo.focus();

      return false;
    }
  }

  return true;
}

function destacarCamposObrigatorios() {
  const obrigatorios = ['razao_social','tipo_pessoa','cpf_cnpj'];
  let primeiroInvalido = null;

  obrigatorios.forEach((id) => {
    const campo = document.getElementById(id);
    if (!campo) return;

    const vazio = !String(campo.value || '').trim();
    campo.style.borderColor = vazio ? '#c85d78' : '';

    if (vazio && !primeiroInvalido) primeiroInvalido = campo;
  });

  if (primeiroInvalido) {
    mensagem.style.color = '#a44f69';
    mensagem.textContent = 'Preencha todos os campos obrigatórios marcados com *.';
    primeiroInvalido.focus();
    return false;
  }

  return true;
}

const campoTelefone = document.getElementById('telefone');
const campoCelular = document.getElementById('celular_whatsapp');
const campoCep = document.getElementById('cep');

if (campoTelefone) {
  campoTelefone.addEventListener('input', () => {
    campoTelefone.value = aplicarMascaraTelefone(campoTelefone.value);
  });
}

if (campoCelular) {
  campoCelular.addEventListener('input', () => {
    campoCelular.value = aplicarMascaraCelular(campoCelular.value);
  });
}

if (campoCep) {
  campoCep.addEventListener('input', () => {
    campoCep.value = aplicarMascaraCep(campoCep.value);
  });
}

/* =========================================================
   BOTÃO DINÂMICO CPF / CNPJ
========================================================= */

function ajustarBotaoDocumento() {

  const tipoPessoa =
    document.getElementById('tipo_pessoa');

  const campoDocumento =
    document.getElementById('cpf_cnpj');

  if (
    !tipoPessoa ||
    !campoDocumento ||
    !btnBuscarCnpj
  ) {
    return;
  }

  if (
    tipoPessoa.value === 'FISICA'
  ) {

    btnBuscarCnpj.textContent =
      '✓ Validar CPF';

    campoDocumento.placeholder =
      '000.000.000-00';

    campoDocumento.maxLength =
      14;

  } else if (
    tipoPessoa.value === 'JURIDICA'
  ) {

    btnBuscarCnpj.textContent =
      '🔎 Buscar CNPJ';

    campoDocumento.placeholder =
      '00.000.000/0000-00';

    campoDocumento.maxLength =
      18;

  } else {

    btnBuscarCnpj.textContent =
      'Validar documento';

    campoDocumento.placeholder =
      '';
  }

  if (statusCnpj) {
    statusCnpj.textContent = '';
  }
}

/* =========================================================
   MÁSCARA INSCRIÇÃO ESTADUAL
   A máscara varia conforme a UF.
========================================================= */

function aplicarMascaraInscricaoEstadual(
  valor,
  uf
) {

  const numeros =
    String(valor || '')
      .replace(/\D/g, '');

  const estado =
    String(uf || '')
      .trim()
      .toUpperCase();


  switch (estado) {

    case 'PR':
      return numeros
        .slice(0, 10)
        .replace(
          /^(\d{3})(\d)/,
          '$1.$2'
        )
        .replace(
          /^(\d{3})\.(\d{5})(\d)/,
          '$1.$2-$3'
        );


    case 'SP':
      return numeros
        .slice(0, 12)
        .replace(
          /^(\d{3})(\d)/,
          '$1.$2'
        )
        .replace(
          /^(\d{3})\.(\d{3})(\d)/,
          '$1.$2.$3'
        )
        .replace(
          /^(\d{3})\.(\d{3})\.(\d{3})(\d)/,
          '$1.$2.$3.$4'
        );


    case 'SC':
      return numeros
        .slice(0, 9)
        .replace(
          /^(\d{3})(\d)/,
          '$1.$2'
        )
        .replace(
          /^(\d{3})\.(\d{3})(\d)/,
          '$1.$2.$3'
        );


    case 'RS':
      return numeros
        .slice(0, 10)
        .replace(
          /^(\d{3})(\d)/,
          '$1/$2'
        );


    case 'MG':
      return numeros
        .slice(0, 13)
        .replace(
          /^(\d{3})(\d)/,
          '$1.$2'
        )
        .replace(
          /^(\d{3})\.(\d{3})(\d)/,
          '$1.$2.$3'
        )
        .replace(
          /^(\d{3})\.(\d{3})\.(\d{3})(\d)/,
          '$1.$2.$3/$4'
        );


    case 'RJ':
      return numeros
        .slice(0, 8)
        .replace(
          /^(\d{2})(\d)/,
          '$1.$2'
        )
        .replace(
          /^(\d{2})\.(\d{3})(\d)/,
          '$1.$2.$3'
        )
        .replace(
          /^(\d{2})\.(\d{3})\.(\d{2})(\d)/,
          '$1.$2.$3-$4'
        );


    case 'GO':
      return numeros
        .slice(0, 9)
        .replace(
          /^(\d{2})(\d)/,
          '$1.$2'
        )
        .replace(
          /^(\d{2})\.(\d{3})(\d)/,
          '$1.$2.$3'
        )
        .replace(
          /^(\d{2})\.(\d{3})\.(\d{3})(\d)/,
          '$1.$2.$3-$4'
        );


    case 'ES':
    case 'CE':
    case 'PB':
    case 'SE':
      return numeros
        .slice(0, 9)
        .replace(
          /^(\d{8})(\d)/,
          '$1-$2'
        );


    case 'MS':
      return numeros
        .slice(0, 9);


    case 'MT':
      return numeros
        .slice(0, 11)
        .replace(
          /^(\d{10})(\d)/,
          '$1-$2'
        );


    case 'DF':
      return numeros
        .slice(0, 13)
        .replace(
          /^(\d{2})(\d)/,
          '$1.$2'
        )
        .replace(
          /^(\d{2})\.(\d{3})(\d)/,
          '$1.$2.$3'
        )
        .replace(
          /^(\d{2})\.(\d{3})\.(\d{3})(\d)/,
          '$1.$2.$3/$4'
        )
        .replace(
          /(\d{4})(\d{2})$/,
          '$1-$2'
        );


    case 'AM':
      return numeros
        .slice(0, 9)
        .replace(
          /^(\d{2})(\d)/,
          '$1.$2'
        )
        .replace(
          /^(\d{2})\.(\d{3})(\d)/,
          '$1.$2.$3'
        )
        .replace(
          /^(\d{2})\.(\d{3})\.(\d{3})(\d)/,
          '$1.$2.$3-$4'
        );


    default:
      return String(valor || '')
        .trim()
        .toUpperCase();
  }
}


function atualizarMascaraInscricaoEstadual() {

  const campoIE =
    document.getElementById(
      'inscricao_estadual'
    );

  const campoUF =
    document.getElementById(
      'estado'
    );

  if (
    !campoIE ||
    !campoUF
  ) {
    return;
  }

  campoIE.value =
    aplicarMascaraInscricaoEstadual(
      campoIE.value,
      campoUF.value
    );
}


const campoInscricaoEstadual =
  document.getElementById(
    'inscricao_estadual'
  );

const campoEstado =
  document.getElementById(
    'estado'
  );


if (campoInscricaoEstadual) {

  campoInscricaoEstadual.addEventListener(
    'input',
    atualizarMascaraInscricaoEstadual
  );

  campoInscricaoEstadual.addEventListener(
    'blur',
    atualizarMascaraInscricaoEstadual
  );
}


if (campoEstado) {

  campoEstado.addEventListener(
    'change',
    atualizarMascaraInscricaoEstadual
  );

  campoEstado.addEventListener(
    'blur',
    atualizarMascaraInscricaoEstadual
  );
}


/* =========================================================
   CONSULTAR CNPJ
========================================================= */

if (btnBuscarCnpj) {

  btnBuscarCnpj.addEventListener(
    'click',
    async () => {

      const campoCnpj =
        document.getElementById('cpf_cnpj');

      const tipoPessoa =
        document.getElementById('tipo_pessoa')?.value;


      if (!tipoPessoa) {

        statusCnpj.style.color =
          '#a44f69';

        statusCnpj.textContent =
          'Selecione primeiro o tipo de pessoa.';

        return;
      }


      /* =================================================
         PESSOA FÍSICA - VALIDAR CPF
      ================================================= */

      if (
        tipoPessoa === 'FISICA'
      ) {

        if (
          !validarCPF(
            campoCnpj.value
          )
        ) {

          statusCnpj.style.color =
            '#a44f69';

          statusCnpj.textContent =
            'CPF inválido. Verifique o número informado.';

          campoCnpj.focus();

          return;
        }


        statusCnpj.style.color =
          '#4f7a57';

        statusCnpj.textContent =
          'CPF válido.';

        return;
      }


      /* =================================================
         PESSOA JURÍDICA - BUSCAR CNPJ
      ================================================= */

      const cnpjInformado =
        normalizarCpfCnpj(
          campoCnpj.value
        );

      limparCamposComplementaresCnpj();


      if (
        cnpjInformado.length !== 14
      ) {

        ocultarAutorizacaoCnpjInvalido();

        statusCnpj.style.color =
          '#a44f69';

        statusCnpj.textContent =
          'Informe um CNPJ válido com 14 caracteres.';

        campoCnpj.focus();

        return;
      }


      if (
        /^[0-9]{14}$/.test(
          cnpjInformado
        ) &&
        !validarCNPJNumerico(
          campoCnpj.value
        )
      ) {

        mostrarAutorizacaoCnpjInvalido();

        return;
      }


      ocultarAutorizacaoCnpjInvalido();


      const {
        data: { session }
      } =
        await supabaseClient
          .auth
          .getSession();


      if (!session) {

        statusCnpj.style.color =
          '#a44f69';

        statusCnpj.textContent =
          'Sua sessão expirou. Faça login novamente.';

        return;
      }


      btnBuscarCnpj.disabled =
        true;

      statusCnpj.style.color =
        '#6e688f';

      statusCnpj.textContent =
        'Consultando CNPJ...';


      try {

        const resposta =
          await fetch(
            `${SUPABASE_URL}/functions/v1/consultar-cnpj`,
            {
              method:
                'POST',

              headers: {

                'Content-Type':
                  'application/json',

                'Authorization':
                  `Bearer ${session.access_token}`
              },

              body:
                JSON.stringify({
                  cnpj:
                    cnpjInformado
                })
            }
          );


        const resultado =
          await resposta.json();


        if (!resposta.ok) {

          statusCnpj.style.color =
            '#a44f69';

          statusCnpj.textContent =
            resultado.erro ||
            'Não foi possível consultar o CNPJ.';

          return;
        }


        /* =================================================
           PREENCHER FORMULÁRIO
        ================================================= */

        document
          .getElementById('tipo_pessoa')
          .value =
            'JURIDICA';


        document
          .getElementById('cpf_cnpj')
          .value =
            aplicarMascaraCNPJ(
              resultado.cnpj ||
              cnpjInformado
            );


        document
          .getElementById('razao_social')
          .value =
            resultado.razao_social ||
            '';


        document
          .getElementById('nome_fantasia')
          .value =
            resultado.nome_fantasia ||
            '';

        document
          .getElementById('inscricao_estadual')
          .value =
            aplicarMascaraInscricaoEstadual(
              resultado.inscricao_estadual ||
              '',
              resultado.inscricao_estadual_uf ||
              resultado.endereco?.estado ||
              ''
            );


        document
          .getElementById('email')
          .value =
            resultado.contato?.email ||
            '';


        document
          .getElementById('telefone')
          .value =
            aplicarMascaraTelefone(
              resultado.contato?.telefone ||
              ''
            );


        document
          .getElementById('endereco')
          .value =
            resultado.endereco?.logradouro ||
            '';


        document
          .getElementById('numero')
          .value =
            resultado.endereco?.numero ||
            '';


        document
          .getElementById('complemento')
          .value =
            resultado.endereco?.complemento ||
            '';


        document
          .getElementById('bairro')
          .value =
            resultado.endereco?.bairro ||
            '';


        document
          .getElementById('cidade')
          .value =
            resultado.endereco?.cidade ||
            '';


        document
          .getElementById('estado')
          .value =
            resultado.endereco?.estado ||
            '';


        document
          .getElementById('cep')
          .value =
            aplicarMascaraCep(
              resultado.endereco?.cep ||
              ''
            );


        /* =================================================
           CAMPOS COMPLEMENTARES
           Só são preenchidos quando a consulta retornar dado.
        ================================================= */

        dadosCnpjConsultado =
          resultado;

        preencherCampoSeHouver(
          'situacao_cadastral',
          resultado.situacao_cadastral
        );

        preencherCampoSeHouver(
          'data_inicio_atividade',
          resultado.data_inicio_atividade
        );

        preencherCampoSeHouver(
          'natureza_juridica',
          resultado.natureza_juridica
        );

        preencherCampoSeHouver(
          'porte',
          resultado.porte
        );

        preencherCampoSeHouver(
          'capital_social',
          resultado.capital_social
        );

        const cnaePrincipal =
          [
            resultado.atividade_principal?.codigo,
            resultado.atividade_principal?.descricao
          ]
            .filter(Boolean)
            .join(' - ');

        preencherCampoSeHouver(
          'cnae_principal',
          cnaePrincipal
        );

        preencherCampoSeHouver(
          'matriz_filial',
          resultado.matriz_filial
        );

        const sociosFormatados =
          formatarSocios(
            resultado.socios
          );

        preencherCampoSeHouver(
          'socios',
          sociosFormatados
        );


        /* =================================================
           VERIFICAR SE O CLIENTE JÁ EXISTE GLOBALMENTE
        ================================================= */

        try {

          const duplicado =
            await clienteJaExiste(
              resultado.cnpj ||
              cnpjInformado
            );

          if (duplicado) {

            statusCnpj.style.color =
              '#a44f69';

            statusCnpj.textContent =
              'CNPJ encontrado, porém este cliente já está cadastrado.';

            return;
          }

        } catch (erro) {

          console.error(
            'Erro ao validar duplicidade após consulta:',
            erro
          );
        }


        statusCnpj.style.color =
          '#4f7a57';


        const situacao =
          resultado.situacao_cadastral
            ? ` Situação: ${resultado.situacao_cadastral}.`
            : '';


        statusCnpj.textContent =
          `CNPJ encontrado. Dados preenchidos automaticamente.${situacao}`;


      } catch (erro) {

        console.error(
          'Erro ao consultar CNPJ:',
          erro
        );


        statusCnpj.style.color =
          '#a44f69';


        statusCnpj.textContent =
          'Não foi possível comunicar com o serviço de consulta de CNPJ.';


      } finally {

        btnBuscarCnpj.disabled =
          false;
      }
    }
  );
}


/* =========================================================
   PREPARAR EDIÇÃO DE CLIENTE
========================================================= */

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


function prepararEdicaoCliente(
  cliente
) {
  if (!permissaoEditarClientes) {
    avisarEdicaoRestrita();
    return;
  }

  clienteEditandoId =
    cliente.id;

  mostrarAbaClientes('novoCliente');
  atualizarModoFormulario(true);

  preencherCampo(
    'razao_social',
    cliente.razao_social
  );

  preencherCampo(
    'nome_fantasia',
    cliente.nome_fantasia
  );

  preencherCampo(
    'tipo_pessoa',
    cliente.tipo_pessoa
  );

  preencherCampo(
    'cpf_cnpj',
    cliente.cpf_cnpj
  );

  atualizarMascaraCpfCnpj();

  preencherCampo(
    'inscricao_estadual',
    aplicarMascaraInscricaoEstadual(
      cliente.inscricao_estadual,
      cliente.estado
    )
  );

  preencherCampo(
    'responsavel',
    cliente.responsavel
  );

  preencherCampo(
    'contato',
    cliente.contato
  );

  preencherCampo(
    'telefone',
    aplicarMascaraTelefone(
      cliente.telefone
    )
  );

  preencherCampo(
    'celular_whatsapp',
    aplicarMascaraCelular(
      cliente.celular_whatsapp
    )
  );

  preencherCampo(
    'email',
    cliente.email
  );

  preencherCampo(
    'endereco',
    cliente.endereco
  );

  preencherCampo(
    'numero',
    cliente.numero
  );

  preencherCampo(
    'complemento',
    cliente.complemento
  );

  preencherCampo(
    'bairro',
    cliente.bairro
  );

  preencherCampo(
    'cidade',
    cliente.cidade
  );

  preencherCampo(
    'estado',
    cliente.estado
  );

  preencherCampo(
    'cep',
    aplicarMascaraCep(
      cliente.cep
    )
  );

  preencherCampo(
    'situacao_cadastral',
    cliente.situacao_cadastral
  );

  preencherCampo(
    'data_inicio_atividade',
    cliente.data_inicio_atividade
  );

  preencherCampo(
    'natureza_juridica',
    cliente.natureza_juridica
  );

  preencherCampo(
    'porte',
    cliente.porte
  );

  preencherCampo(
    'capital_social',
    cliente.capital_social
  );

  preencherCampo(
    'cnae_principal',
    cliente.cnae_principal
  );

  preencherCampo(
    'matriz_filial',
    cliente.matriz_filial
  );

  const sociosTexto =
    Array.isArray(
      cliente.socios
    )
      ? formatarSocios(
          cliente.socios
        )
      : '';

  preencherCampo(
    'socios',
    sociosTexto
  );

  dadosCnpjConsultado =
    cliente.socios
      ? {
          socios:
            cliente.socios
        }
      : null;

  document
    .getElementById('ativo')
    .value =
      cliente.ativo
        ? 'true'
        : 'false';


  const botao =
    formCliente.querySelector(
      'button[type="submit"]'
    );

  if (botao) {
    botao.textContent =
      'Salvar alterações';
  }


  mensagem.style.color =
    '#6e688f';

  mensagem.textContent =
    'Editando cliente. Faça as alterações e clique em Salvar alterações.';


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* =========================================================
   FINALIZAR EDIÇÃO
========================================================= */

function finalizarEdicaoCliente() {

  clienteEditandoId =
    null;

  formCliente.reset();

  limparCamposComplementaresCnpj();

  atualizarModoFormulario(false);
  ocultarAutorizacaoCnpjInvalido();
  atualizarMascaraCpfCnpj();
}


/* =========================================================
   CADASTRAR CLIENTE
========================================================= */

formCliente.addEventListener(
  'submit',
  async (e) => {

    e.preventDefault();

    // Verificação atual no servidor antes de qualquer atualização.
    if (clienteEditandoId !== null && !(await conferirEdicaoClientes())) {
      avisarEdicaoRestrita();
      return;
    }

    if (!destacarCamposObrigatorios()) {
      return;
    }

    if (!validarDocumentoPorTipo()) {
      return;
    }

    mensagem.style.color =
      '#6e688f';

    mensagem.textContent =
      'Cadastrando cliente...';

    const dadosCliente = {

      razao_social:
        document
          .getElementById('razao_social')
          .value
          .trim(),

      nome_fantasia:
        valorOuNull('nome_fantasia'),

      tipo_pessoa:
        document
          .getElementById('tipo_pessoa')
          .value,

      cpf_cnpj:
        valorOuNull('cpf_cnpj'),

      inscricao_estadual:
        valorOuNull('inscricao_estadual'),

      responsavel:
        valorOuNull('responsavel'),

      contato:
        valorOuNull('contato'),

      telefone:
        valorOuNull('telefone'),

      celular_whatsapp:
        valorOuNull('celular_whatsapp'),

      email:
        valorOuNull('email'),

      endereco:
        valorOuNull('endereco'),

      numero:
        valorOuNull('numero'),

      complemento:
        valorOuNull('complemento'),

      bairro:
        valorOuNull('bairro'),

      cidade:
        valorOuNull('cidade'),

      estado:
        (
          document
            .getElementById('estado')
            .value
            .trim()
            .toUpperCase()
        ) || null,

      cep:
        valorOuNull('cep'),

      situacao_cadastral:
        valorOuNull('situacao_cadastral'),

      data_inicio_atividade:
        valorOuNull('data_inicio_atividade'),

      natureza_juridica:
        valorOuNull('natureza_juridica'),

      porte:
        valorOuNull('porte'),

      capital_social:
        valorOuNull('capital_social')
          ? Number(
              valorOuNull('capital_social')
            )
          : null,

      cnae_principal:
        valorOuNull('cnae_principal'),

      matriz_filial:
        valorOuNull('matriz_filial'),

      socios:
        dadosCnpjConsultado &&
        Array.isArray(
          dadosCnpjConsultado.socios
        ) &&
        dadosCnpjConsultado.socios.length > 0
          ? dadosCnpjConsultado.socios
          : null,

      ativo:
        document
          .getElementById('ativo')
          .value === 'true'
    };

    if (
      !dadosCliente.cpf_cnpj ||
      normalizarCpfCnpj(
        dadosCliente.cpf_cnpj
      ).length === 0
    ) {

      mensagem.style.color =
        '#a44f69';

      mensagem.textContent =
        'CPF / CNPJ é obrigatório.';

      return;
    }


    try {

      const duplicado =
        await clienteJaExiste(
          dadosCliente.cpf_cnpj,
          clienteEditandoId
        );

      if (duplicado) {

        mensagem.style.color =
          '#a44f69';

        mensagem.textContent =
          'Este cliente já está cadastrado.';

        return;
      }

    } catch (erro) {

      mensagem.style.color =
        '#a44f69';

      mensagem.textContent =
        'Não foi possível validar se o cliente já está cadastrado.';

      return;
    }


    if (
      clienteEditandoId !== null
    ) {

      const {
        error: erroAtualizacao
      } = await supabaseClient
        .from('clientes')
        .update({
          ...dadosCliente,
          updated_at:
            new Date().toISOString()
        })
        .eq(
          'id',
          clienteEditandoId
        );


      if (erroAtualizacao) {

        console.error(
          erroAtualizacao
        );

        mensagem.style.color =
          '#a44f69';

        if (
          erroAtualizacao.code ===
          '23505'
        ) {

          mensagem.textContent =
            'Este CPF / CNPJ já está cadastrado para outro cliente.';

        } else {

          mensagem.textContent =
            erroAtualizacao.message ||
            'Erro ao atualizar cliente.';
        }

        return;
      }


      mensagem.style.color =
        '#4f7a57';

      mensagem.textContent =
        'Cliente atualizado com sucesso.';


      finalizarEdicaoCliente();

      await carregarClientes();
      mostrarAbaClientes('consultaClientes');

      return;
    }


    try {
      const gerarCodigoCliente = await obterGeradorCodigoCliente();
      dadosCliente.codigo_cliente = gerarCodigoCliente();
    } catch (erroCodigo) {
      console.error('Erro ao gerar código do cliente:', erroCodigo);
      mensagem.style.color = '#a44f69';
      mensagem.textContent = 'Não foi possível gerar o código automático do cliente.';
      return;
    }

    const {
      error
    } = await supabaseClient
      .from('clientes')
      .insert(dadosCliente);

    if (error) {

      console.error(error);

      mensagem.style.color =
        '#a44f69';

      if (
        error.code === '23505'
      ) {

        mensagem.textContent =
          'Este cliente já está cadastrado.';

      } else {

        mensagem.textContent =
          error.message ||
          'Erro ao cadastrar cliente.';
      }

      return;
    }

    mensagem.style.color =
      '#4f7a57';

    mensagem.textContent =
      'Cliente cadastrado com sucesso.';

    formCliente.reset();

    limparCamposComplementaresCnpj();
    ocultarAutorizacaoCnpjInvalido();
    atualizarModoFormulario(false);

    await carregarClientes();
    mostrarAbaClientes('consultaClientes');
  }
);


function valorOuNull(id) {
  const elemento =
    document.getElementById(id);

  if (!elemento) {
    return null;
  }

  const valor =
    elemento.value.trim();

  return valor || null;
}


/* =========================================================
   IMPORTAR CSV
========================================================= */

btnImportarCSV.addEventListener(
  'click',
  () => {
    mensagemImportacao.textContent = '';
    arquivoCSV.value = '';
    arquivoCSV.click();
  }
);


arquivoCSV.addEventListener(
  'change',
  () => {

    const arquivo =
      arquivoCSV.files[0];

    if (!arquivo) {
      return;
    }

    if (
      typeof Papa === 'undefined'
    ) {
      mensagemImportacao.style.color =
        '#a44f69';

      mensagemImportacao.textContent =
        'Biblioteca de importação não carregada.';

      return;
    }

    mensagemImportacao.style.color =
      '#6e688f';

    mensagemImportacao.textContent =
      'Lendo arquivo CSV...';

    Papa.parse(
      arquivo,
      {
        header: true,
        skipEmptyLines: true,
        delimiter: '',
        transformHeader: (header) =>
          normalizarCabecalho(header),

        complete: async (resultado) => {

          if (
            resultado.errors &&
            resultado.errors.length > 0
          ) {
            console.error(
              'Erros CSV:',
              resultado.errors
            );
          }

          await importarClientesCSV(
            resultado.data
          );
        },

        error: (erro) => {

          console.error(
            'Erro ao ler CSV:',
            erro
          );

          mensagemImportacao.style.color =
            '#a44f69';

          mensagemImportacao.textContent =
            'Não foi possível ler o arquivo CSV.';
        }
      }
    );
  }
);


function normalizarCabecalho(texto) {

  return String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\\ -]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}


function limparValor(valor) {

  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const texto =
    String(valor).trim();

  return texto === ''
    ? null
    : texto;
}


function converterAtivo(valor) {

  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
  ) {
    return true;
  }

  const v =
    String(valor)
      .trim()
      .toLowerCase();

  return [
    'true',
    '1',
    'sim',
    's',
    'ativo'
  ].includes(v);
}


function mapearLinhaCSV(linha) {

  const razaoSocial =
    limparValor(
      linha.razao_social ??
      linha.razaosocial ??
      linha.cliente ??
      linha.nome
    );

  const tipoPessoaRaw =
    limparValor(
      linha.tipo_pessoa
    );

  let tipoPessoa =
    tipoPessoaRaw;

  if (tipoPessoaRaw) {

    const tp =
      tipoPessoaRaw
        .toUpperCase();

    if (
      tp === 'PJ' ||
      tp === 'JURIDICA' ||
      tp === 'PESSOA JURIDICA'
    ) {
      tipoPessoa =
        'JURIDICA';
    }

    if (
      tp === 'PF' ||
      tp === 'FISICA' ||
      tp === 'PESSOA FISICA'
    ) {
      tipoPessoa =
        'FISICA';
    }
  }

  return {

    razao_social:
      razaoSocial,

    nome_fantasia:
      limparValor(
        linha.nome_fantasia
      ),

    tipo_pessoa:
      tipoPessoa,

    cpf_cnpj:
      limparValor(
        linha.cpf_cnpj ??
        linha.cpfcnpj ??
        linha.cnpj ??
        linha.cpf
      ),

    inscricao_estadual:
      limparValor(
        linha.inscricao_estadual
      ),

    responsavel:
      limparValor(
        linha.responsavel
      ),

    contato:
      limparValor(
        linha.contato
      ),

    telefone:
      limparValor(
        linha.telefone
      ),

    celular_whatsapp:
      limparValor(
        linha.celular_whatsapp ??
        linha.whatsapp ??
        linha.celular
      ),

    email:
      limparValor(
        linha.email
      ),

    endereco:
      limparValor(
        linha.endereco
      ),

    numero:
      limparValor(
        linha.numero
      ),

    complemento:
      limparValor(
        linha.complemento
      ),

    bairro:
      limparValor(
        linha.bairro
      ),

    cidade:
      limparValor(
        linha.cidade
      ),

    estado:
      limparValor(
        linha.estado ??
        linha.uf
      )
        ?.toUpperCase() || null,

    cep:
      limparValor(
        linha.cep
      ),

    observacoes:
      limparValor(
        linha.observacoes
      ),

    ativo:
      converterAtivo(
        linha.ativo
      )
  };
}


async function importarClientesCSV(
  linhas
) {

  if (
    !linhas ||
    linhas.length === 0
  ) {

    mensagemImportacao.style.color =
      '#a44f69';

    mensagemImportacao.textContent =
      'O arquivo CSV não possui registros.';

    return;
  }

  const clientesValidos = [];
  const erros = [];
  const documentosDoArquivo =
    new Set();

  linhas.forEach(
    (linha, indice) => {

      const cliente =
        mapearLinhaCSV(linha);

      const numeroLinha =
        indice + 2;

      if (
        !cliente.razao_social
      ) {
        erros.push(
          `Linha ${numeroLinha}: razão social não informada.`
        );

        return;
      }

      if (
        !cliente.cpf_cnpj ||
        normalizarCpfCnpj(
          cliente.cpf_cnpj
        ).length === 0
      ) {
        erros.push(
          `Linha ${numeroLinha}: CPF / CNPJ é obrigatório.`
        );

        return;
      }

      if (
        ![
          'JURIDICA',
          'FISICA'
        ].includes(
          cliente.tipo_pessoa
        )
      ) {
        erros.push(
          `Linha ${numeroLinha}: tipo_pessoa deve ser JURIDICA ou FISICA.`
        );

        return;
      }

      const chaveDuplicidade =
        normalizarCpfCnpj(
          cliente.cpf_cnpj
        );

      if (
        documentosDoArquivo.has(
          chaveDuplicidade
        )
      ) {
        erros.push(
          `Linha ${numeroLinha}: cliente duplicado dentro do próprio CSV.`
        );

        return;
      }

      documentosDoArquivo.add(
        chaveDuplicidade
      );

      clientesValidos.push(
        cliente
      );
    }
  );

  if (
    clientesValidos.length === 0
  ) {

    mensagemImportacao.style.color =
      '#a44f69';

    mensagemImportacao.textContent =
      erros.length
        ? erros.slice(0, 5).join(' | ')
        : 'Nenhum registro válido para importar.';

    return;
  }


  const clientesSemDuplicidade = [];

  for (
    const cliente of clientesValidos
  ) {

    try {

      const duplicado =
        await clienteJaExiste(
          cliente.cpf_cnpj
        );

      if (duplicado) {

        erros.push(
          `Cliente com CPF/CNPJ ${cliente.cpf_cnpj} já cadastrado.`
        );

        continue;
      }

      clientesSemDuplicidade.push(
        cliente
      );

    } catch (erro) {

      mensagemImportacao.style.color =
        '#a44f69';

      mensagemImportacao.textContent =
        'Não foi possível validar duplicidades antes da importação.';

      return;
    }
  }


  if (
    clientesSemDuplicidade.length === 0
  ) {

    mensagemImportacao.style.color =
      '#a44f69';

    mensagemImportacao.textContent =
      'Nenhum cliente novo para importar. Todos já existem ou possuem erro.';

    return;
  }


  try {
    const gerarCodigoCliente = await obterGeradorCodigoCliente();
    clientesSemDuplicidade.forEach(cliente => {
      cliente.codigo_cliente = gerarCodigoCliente();
    });
  } catch (erroCodigo) {
    console.error('Erro ao gerar códigos da importação CSV:', erroCodigo);
    mensagemImportacao.style.color = '#a44f69';
    mensagemImportacao.textContent = 'Não foi possível gerar os códigos automáticos dos clientes.';
    return;
  }

  const confirmar =
    confirm(
      `Foram encontrados ${clientesSemDuplicidade.length} clientes novos para importar.` +
      (
        erros.length
          ? ` ${erros.length} linha(s) serão ignoradas por erro.`
          : ''
      ) +
      '\n\nDeseja continuar?'
    );

  if (!confirmar) {
    return;
  }

  mensagemImportacao.style.color =
    '#6e688f';

  mensagemImportacao.textContent =
    `Importando ${clientesValidos.length} clientes...`;

  const tamanhoLote =
    200;

  let importados =
    0;

  for (
    let inicio = 0;
    inicio < clientesSemDuplicidade.length;
    inicio += tamanhoLote
  ) {

    const lote =
      clientesSemDuplicidade.slice(
        inicio,
        inicio + tamanhoLote
      );

    const {
      error
    } = await supabaseClient
      .from('clientes')
      .insert(lote);

    if (error) {

      console.error(
        'Erro na importação:',
        error
      );

      mensagemImportacao.style.color =
        '#a44f69';

      mensagemImportacao.textContent =
        `A importação parou após ${importados} cliente(s). Erro: ${error.message}`;

      return;
    }

    importados +=
      lote.length;

    mensagemImportacao.textContent =
      `Importando... ${importados}/${clientesSemDuplicidade.length}`;
  }

  mensagemImportacao.style.color =
    '#4f7a57';

  mensagemImportacao.textContent =
    `${importados} cliente(s) importado(s) com sucesso.` +
    (
      erros.length
        ? ` ${erros.length} linha(s) foram ignoradas.`
        : ''
    );

  await carregarClientes();
}


/* =========================================================
   CARREGAR / CONSULTAR / PAGINAR CLIENTES
========================================================= */

async function buscarTodosClientes() {
  const campos = `
    id,
    codigo_cliente,
    razao_social,
    nome_fantasia,
    tipo_pessoa,
    cpf_cnpj,
    inscricao_estadual,
    responsavel,
    contato,
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
    observacoes,
    situacao_cadastral,
    data_inicio_atividade,
    natureza_juridica,
    porte,
    capital_social,
    cnae_principal,
    matriz_filial,
    socios,
    ativo
  `;

  const resultado = [];
  const lote = 1000;
  let inicio = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select(campos)
      .order('razao_social', { ascending: true })
      .range(inicio, inicio + lote - 1);

    if (error) throw error;
    resultado.push(...(data || []));
    if (!data || data.length < lote) break;
    inicio += lote;
  }

  return resultado;
}

async function garantirCodigosClientes(clientes) {
  const semCodigo = (clientes || []).filter(cliente =>
    !cliente.codigo_cliente || !String(cliente.codigo_cliente).trim()
  );

  if (!semCodigo.length) return;

  const gerarCodigo = criarGeradorCodigoCliente(
    (clientes || []).map(cliente => cliente.codigo_cliente)
  );

  for (const cliente of semCodigo) {
    const codigo = gerarCodigo();
    const { error } = await supabaseClient
      .from('clientes')
      .update({
        codigo_cliente: codigo,
        updated_at: new Date().toISOString()
      })
      .eq('id', cliente.id);

    if (error) {
      console.error(`Não foi possível preencher o código do cliente ${cliente.id}:`, error);
      continue;
    }

    cliente.codigo_cliente = codigo;
  }
}

function normalizarPesquisa(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function clientesFiltrados() {
  const termo = normalizarPesquisa(termoPesquisaCliente);
  if (!termo) return [...todosClientes];

  return todosClientes.filter(cliente => {
    const base = [
      cliente.codigo_cliente,
      cliente.nome_fantasia,
      cliente.razao_social,
      cliente.cpf_cnpj,
      cliente.contato,
      cliente.responsavel,
      cliente.telefone,
      cliente.celular_whatsapp,
      cliente.email,
      cliente.cidade,
      cliente.estado
    ].map(normalizarPesquisa).join(' | ');

    return base.includes(termo);
  });
}

// Ordenação da lista completa, antes da paginação.
let colunaOrdenacaoClientes = null;
let direcaoOrdenacaoClientes = 1;
const comparadorClientes = new Intl.Collator('pt-BR', {numeric:true, sensitivity:'base'});
function valorOrdenacaoCliente(cliente, coluna) {
  switch(coluna) {
    case 'codigo': return cliente.codigo_cliente || '';
    case 'cliente': return cliente.nome_fantasia || cliente.razao_social || '';
    case 'razao': return cliente.razao_social || '';
    case 'documento': return String(cliente.cpf_cnpj || '').replace(/\D/g, '');
    case 'contato': return cliente.contato || cliente.responsavel || cliente.telefone || cliente.celular_whatsapp || '';
    case 'cidade': return [cliente.cidade,cliente.estado].filter(Boolean).join(' / ');
    case 'status': return cliente.ativo === true ? 'Ativo' : 'Inativo';
    default: return '';
  }
}
function atualizarIndicadoresOrdenacaoClientes() {
  document.querySelectorAll('[data-ordenar-cliente]').forEach(botao => {
    const ativo = botao.dataset.ordenarCliente === colunaOrdenacaoClientes;
    const th = botao.closest('th');
    if(th) th.setAttribute('aria-sort', ativo ? (direcaoOrdenacaoClientes === 1 ? 'ascending':'descending') : 'none');
    const seta = botao.querySelector('.destac-seta-ordem');
    if(seta) seta.textContent = ativo ? (direcaoOrdenacaoClientes === 1 ? '↑':'↓') : '↕';
  });
}
document.querySelectorAll('[data-ordenar-cliente]').forEach(botao => {
  botao.addEventListener('click', () => {
    const coluna = botao.dataset.ordenarCliente;
    direcaoOrdenacaoClientes = colunaOrdenacaoClientes === coluna ? -direcaoOrdenacaoClientes : 1;
    colunaOrdenacaoClientes = coluna;
    paginaAtual = 1;
    renderizarClientes();
  });
});

function obterTamanhoPagina(total) {
  if (!itensPorPagina || itensPorPagina.value === 'all') {
    return Math.max(total, 1);
  }
  const valor = Number(itensPorPagina.value);
  return Number.isFinite(valor) && valor > 0 ? valor : 10;
}

function renderizarClientes() {
  if (!listaClientes) return;

  const filtrados = clientesFiltrados();
  if (colunaOrdenacaoClientes) {
    filtrados.sort((a,b) => direcaoOrdenacaoClientes * comparadorClientes.compare(
      valorOrdenacaoCliente(a,colunaOrdenacaoClientes), valorOrdenacaoCliente(b,colunaOrdenacaoClientes)));
  }
  atualizarIndicadoresOrdenacaoClientes();
  const total = filtrados.length;
  const tamanho = obterTamanhoPagina(total);
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));

  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
  if (paginaAtual < 1) paginaAtual = 1;

  const inicio = total ? (paginaAtual - 1) * tamanho : 0;
  const fim = itensPorPagina?.value === 'all' ? total : Math.min(inicio + tamanho, total);
  const pagina = filtrados.slice(inicio, fim);

  listaClientes.innerHTML = '';

  if (!pagina.length) {
    listaClientes.innerHTML = '<tr><td colspan="8">Nenhum cliente encontrado.</td></tr>';
  } else {
    pagina.forEach(cliente => {
      const linha = document.createElement('tr');
      const cidade = [cliente.cidade, cliente.estado].filter(Boolean).join(' / ') || '-';
      const contato = cliente.contato || cliente.responsavel || cliente.telefone || cliente.celular_whatsapp || '-';

      linha.innerHTML = `
        <td>${escaparHtml(cliente.codigo_cliente || '-')}</td>
        <td>${escaparHtml(cliente.nome_fantasia || cliente.razao_social || '-')}</td>
        <td>${escaparHtml(cliente.razao_social || '-')}</td>
        <td>${escaparHtml(cliente.cpf_cnpj || '-')}</td>
        <td>${escaparHtml(contato)}</td>
        <td>${escaparHtml(cidade)}</td>
        <td>
          <span class="${cliente.ativo ? 'status-ativo' : 'status-inativo'}">
            ${cliente.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>
          <div class="acoes-usuario">
            ${permissaoEditarClientes ? '<button type="button" class="btn-editar">Editar</button>' : '<span class="destac-edicao-restrita" title="Acesso restrito: sem permissão para editar clientes" style="font-size:12px;opacity:.7">Acesso restrito</span>'}
            ${permissaoEditarClientes ? `<button type="button" class="btn-status">${cliente.ativo ? 'Inativar' : 'Ativar'}</button>` : ''}
          </div>
        </td>
      `;

      const btnEditar = linha.querySelector('.btn-editar');
      btnEditar?.addEventListener('click', async () => {
        if (!(await conferirEdicaoClientes())) {
          avisarEdicaoRestrita();
          renderizarClientes();
          return;
        }
        prepararEdicaoCliente(cliente);
      });

      const btnStatus = linha.querySelector('.btn-status');
      btnStatus?.addEventListener('click', async () => {
        if (!(await conferirEdicaoClientes())) {
          avisarEdicaoRestrita();
          renderizarClientes();
          return;
        }
        const novoStatus = !cliente.ativo;
        const acao = novoStatus ? 'ativar' : 'inativar';
        const nome = cliente.nome_fantasia || cliente.razao_social || cliente.codigo_cliente || 'cliente';

        if (!confirm(`Deseja realmente ${acao} o cliente "${nome}"?`)) return;

        btnStatus.disabled = true;
        btnStatus.textContent = novoStatus ? 'Ativando...' : 'Inativando...';

        const { error } = await supabaseClient
          .from('clientes')
          .update({ ativo: novoStatus, updated_at: new Date().toISOString() })
          .eq('id', cliente.id);

        if (error) {
          console.error('Erro ao alterar status do cliente:', error);
          alert(error.message || 'Erro ao alterar o status do cliente.');
          btnStatus.disabled = false;
          btnStatus.textContent = cliente.ativo ? 'Inativar' : 'Ativar';
          return;
        }

        cliente.ativo = novoStatus;
        if (clienteEditandoId === cliente.id) {
          const campoAtivo = document.getElementById('ativo');
          if (campoAtivo) campoAtivo.value = novoStatus ? 'true' : 'false';
        }
        renderizarClientes();
      });

      listaClientes.appendChild(linha);
    });
  }

  if (contadorClientes) {
    contadorClientes.textContent = `${total} ${total === 1 ? 'cliente' : 'clientes'}`;
  }

  if (infoPaginacao) {
    if (!total) {
      infoPaginacao.textContent = 'Exibindo 0 de 0 clientes';
    } else if (itensPorPagina?.value === 'all') {
      infoPaginacao.textContent = `Exibindo todos os ${total} clientes`;
    } else {
      infoPaginacao.textContent = `Exibindo ${inicio + 1}-${fim} de ${total} clientes`;
    }
  }

  if (paginaAtualTexto) {
    paginaAtualTexto.textContent = itensPorPagina?.value === 'all'
      ? 'Todos os clientes'
      : `Página ${paginaAtual} de ${totalPaginas}`;
  }

  if (btnPaginaAnterior) {
    btnPaginaAnterior.disabled = paginaAtual <= 1 || itensPorPagina?.value === 'all';
  }
  if (btnProximaPagina) {
    btnProximaPagina.disabled = paginaAtual >= totalPaginas || itensPorPagina?.value === 'all';
  }
}

async function carregarClientes() {
  if (!listaClientes) return;

  listaClientes.innerHTML = '<tr><td colspan="8">Carregando clientes...</td></tr>';

  try {
    todosClientes = await buscarTodosClientes();
    await garantirCodigosClientes(todosClientes);
    renderizarClientes();
  } catch (error) {
    console.error('Erro ao carregar clientes:', error);
    listaClientes.innerHTML = `
      <tr><td colspan="8">Erro ao carregar clientes: ${escaparHtml(error.message || 'erro desconhecido')}</td></tr>
    `;
  }
}

/* =========================================================
   ATUALIZAR LISTA
========================================================= */

if (btnAtualizarClientes) {
  btnAtualizarClientes.addEventListener('click', carregarClientes);
}

if (pesquisaCliente) {
  pesquisaCliente.addEventListener('input', () => {
    termoPesquisaCliente = pesquisaCliente.value;
    paginaAtual = 1;
    renderizarClientes();
  });
}

if (itensPorPagina) {
  itensPorPagina.addEventListener('change', () => {
    paginaAtual = 1;
    renderizarClientes();
  });
}

btnPaginaAnterior?.addEventListener('click', () => {
  if (paginaAtual > 1) {
    paginaAtual -= 1;
    renderizarClientes();
  }
});

btnProximaPagina?.addEventListener('click', () => {
  paginaAtual += 1;
  renderizarClientes();
});

tabConsulta?.addEventListener('click', () => mostrarAbaClientes('consultaClientes'));
tabNovo?.addEventListener('click', () => {
  if (clienteEditandoId === null) {
    atualizarModoFormulario(false);
  }
  mostrarAbaClientes('novoCliente');
});

btnVoltarConsulta?.addEventListener('click', () => mostrarAbaClientes('consultaClientes'));
btnCancelarEdicao?.addEventListener('click', () => {
  finalizarEdicaoCliente();
  if (mensagem) mensagem.textContent = '';
  mostrarAbaClientes('consultaClientes');
});


/* =========================================================
   LOGOUT
========================================================= */

if (btnSair) btnSair.addEventListener(
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

  await carregarClientes();

  ajustarBotaoDocumento();
  atualizarModoFormulario(false);

  if (window.location.hash === '#novo') {
    mostrarAbaClientes('novoCliente');
  } else if (window.location.hash === '#consulta') {
    mostrarAbaClientes('consultaClientes');
  } // Sem fragmento: apresenta os cartões da página inicial de Clientes.
}

iniciarPagina();
