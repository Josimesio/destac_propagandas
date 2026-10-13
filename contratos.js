const SUPABASE_URL =
  'https://kvmayirfbdnexlzqnjvr.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


const empresaId =
  document.getElementById(
    'empresaId'
  );

const clienteId =
  document.getElementById(
    'clienteId'
  );

const cabecalhoContrato =
  document.getElementById(
    'cabecalhoContrato'
  );

const mensagemContrato =
  document.getElementById(
    'mensagemContrato'
  );

const menuUsuarios =
  document.getElementById(
    'menuUsuarios'
  );

const btnSair =
  document.getElementById(
    'btnSair'
  );


const btnSalvarContrato =
  document.getElementById(
    'btnSalvarContrato'
  );

const numeroContratoExibicao =
  document.getElementById(
    'numeroContratoExibicao'
  );

const estadoSalvamentoContrato =
  document.getElementById(
    'estadoSalvamentoContrato'
  );


const arquivoAudioCliente =
  document.getElementById(
    'arquivoAudioCliente'
  );

const statusAudioCliente =
  document.getElementById(
    'statusAudioCliente'
  );

const previewAudioCliente =
  document.getElementById(
    'previewAudioCliente'
  );

let audioContratoUrl = null;
let audioContratoCaminho = null;
let audioContratoNome = null;
let audioContratoMime = null;

let contratoSalvoId = null;
let numeroContratoSalvo = null;
let contratoPossuiAlteracoes = false;
let salvandoContrato = false;
let modoEdicaoInicializando = false;


function nomeAmigavelPerfilLogado(
  perfil
) {

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


function textoOuTraco(
  valor
) {

  const texto =
    String(
      valor ?? ''
    ).trim();

  return texto || '-';
}


function montarEndereco(
  empresa
) {

  const linha1 = [
    empresa.endereco,
    empresa.numero
  ]
    .filter(Boolean)
    .join(', ');

  const linha2 = [
    empresa.bairro
  ]
    .filter(Boolean)
    .join(' - ');

  const partes = [
    linha1,
    linha2
  ]
    .filter(Boolean);

  return partes.join(' - ') || '-';
}



function dataPorExtensoPtBr(
  data
) {

  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];

  return `${String(data.getDate()).padStart(2, '0')} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
}


let empresaAtualParaAssinatura = null;
let assinanteEmpresaPersonalizado = false;

function nomeAssinantePadrao(empresa) {
  const ehDestac = /destac/i.test(
    `${empresa?.nome_fantasia || ''} ${empresa?.razao_social || ''}`
  );
  return ehDestac ? 'Celso Dondoni' : (empresa?.responsavel || empresa?.razao_social || '-');
}

function atualizarAssinaturaEmpresa(
  empresa
) {
  empresaAtualParaAssinatura = empresa;
  const campoAssinante = document.getElementById('assinanteEmpresaContrato');
  const nomePadrao = nomeAssinantePadrao(empresa);
  // Alterar a empresa atualiza o padrão apenas se ainda não for personalizado.
  if (campoAssinante && !assinanteEmpresaPersonalizado) {
    campoAssinante.value = nomePadrao;
  }

  const responsavel =
    document.getElementById(
      'assinaturaResponsavelEmpresa'
    );

  const nomeEmpresa =
    document.getElementById(
      'assinaturaNomeEmpresa'
    );

  const dataAssinatura =
    document.getElementById(
      'dataAssinaturaContrato'
    );


  if (responsavel) {

    responsavel.textContent = campoAssinante?.value.trim() || nomePadrao;
  }


  if (nomeEmpresa) {

    nomeEmpresa.textContent =
      empresa.nome_fantasia ||
      empresa.razao_social ||
      '-';
  }


  if (dataAssinatura) {

    const cidade =
      empresa.cidade ||
      'Cascavel';

    dataAssinatura.textContent =
      `${cidade}, ${dataPorExtensoPtBr(new Date())}.`;
  }
}


let clienteAtualParaAssinatura = null;

function atualizarAssinaturaCliente(
  cliente
) {

  clienteAtualParaAssinatura = cliente;
  const responsavelCliente = document.getElementById('assinaturaResponsavelCliente');
  if (responsavelCliente) {
    responsavelCliente.textContent =
      valorCampo('responsavelClienteContrato') ||
      cliente.contato || cliente.responsavel || '';
  }

  const assinaturaCliente =
    document.getElementById(
      'assinaturaCliente'
    );


  if (assinaturaCliente) {

    assinaturaCliente.textContent =
      cliente.nome_fantasia ||
      cliente.razao_social ||
      '-';
  }
}


function preencherCabecalho(
  empresa
) {

  document.getElementById(
    'razaoSocialEmpresa'
  ).textContent =
    textoOuTraco(
      empresa.razao_social
    );

  document.getElementById(
    'cnpjEmpresa'
  ).textContent =
    textoOuTraco(
      empresa.cpf_cnpj
    );

  document.getElementById(
    'enderecoEmpresa'
  ).textContent =
    montarEndereco(
      empresa
    );

  document.getElementById(
    'telefoneEmpresa'
  ).textContent =
    textoOuTraco(
      empresa.telefone
    );

  document.getElementById(
    'celularEmpresa'
  ).textContent =
    textoOuTraco(
      empresa.celular_whatsapp
    );

  document.getElementById(
    'emailEmpresa'
  ).textContent =
    textoOuTraco(
      empresa.email
    );

  const cidadeUfEmpresa =
    document.getElementById(
      'cidadeUfEmpresa'
    );

  if (cidadeUfEmpresa) {
    cidadeUfEmpresa.textContent =
      [
        empresa.cidade,
        empresa.estado
      ]
        .filter(Boolean)
        .join('-') || '-';
  }

  const emailEmpresaLink =
    document.getElementById(
      'emailEmpresaLink'
    );

  if (emailEmpresaLink) {
    emailEmpresaLink.href =
      empresa.email
        ? `mailto:${empresa.email}`
        : '#';
  }


  const logo =
    document.getElementById(
      'logoEmpresaContrato'
    );

  const semLogo =
    document.getElementById(
      'semLogoEmpresa'
    );


  if (
    empresa.logo_url
  ) {

    logo.src =
      empresa.logo_url;

    logo.style.display =
      'block';

    semLogo.style.display =
      'none';

  } else {

    logo.removeAttribute(
      'src'
    );

    logo.style.display =
      'none';

    semLogo.style.display =
      'block';
  }


  cabecalhoContrato.style.display =
    'block';

  atualizarAssinaturaEmpresa(
    empresa
  );
}


async function carregarEmpresas() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from('empresas')
      .select(`
        id,
        razao_social,
        nome_fantasia,
        cpf_cnpj,
        ativo
      `)
      .eq(
        'ativo',
        true
      )
      .order(
        'razao_social'
      );


  if (error) {

    console.error(
      error
    );

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Não foi possível carregar as empresas.';

    return;
  }


  empresaId.innerHTML =
    '<option value="">Selecione a empresa</option>';


  for (
    const empresa of data || []
  ) {

    const option =
      document.createElement(
        'option'
      );

    option.value =
      empresa.id;

    option.textContent =
      empresa.nome_fantasia
        ? `${empresa.nome_fantasia} — ${empresa.razao_social}`
        : empresa.razao_social;

    empresaId.appendChild(
      option
    );
  }
}


async function carregarClientesGlobais() {

  clienteId.disabled =
    true;

  clienteId.innerHTML =
    '<option value="">Carregando clientes...</option>';


  const {
    data,
    error
  } =
    await supabaseClient
      .from('clientes')
      .select(`
        id,
        razao_social,
        nome_fantasia,
        cpf_cnpj,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        telefone,
        celular_whatsapp,
        contato,
        responsavel,
        email,
        ativo
      `)
      .eq(
        'ativo',
        true
      )
      .order(
        'razao_social'
      );


  if (error) {

    console.error(
      error
    );

    clienteId.innerHTML =
      '<option value="">Erro ao carregar clientes</option>';

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Não foi possível carregar os clientes.';

    return;
  }


  clienteId.innerHTML =
    '<option value="">Selecione o cliente</option>';


  for (
    const cliente of [...(data || [])].sort((a, b) => {
        const nomeA = String(a.nome_fantasia || a.razao_social || '').trim();
        const nomeB = String(b.nome_fantasia || b.razao_social || '').trim();
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base', numeric: true }) ||
          String(a.razao_social || '').localeCompare(String(b.razao_social || ''), 'pt-BR', { sensitivity: 'base', numeric: true }) ||
          Number(a.id) - Number(b.id);
      })
  ) {

    const option =
      document.createElement(
        'option'
      );

    option.value =
      cliente.id;

    option.textContent =
      cliente.nome_fantasia
        ? `${cliente.nome_fantasia} — ${cliente.razao_social}`
        : cliente.razao_social;

    clienteId.appendChild(
      option
    );
  }


  clienteId.disabled =
    false;


  if (
    !data ||
    data.length === 0
  ) {

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Nenhum cliente ativo cadastrado.';
  }
}


async function carregarEmpresaSelecionada(
  empresaSelecionadaId
) {

  if (!empresaSelecionadaId) {

    cabecalhoContrato.style.display =
      'none';

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Selecione uma empresa para o contrato.';

    return;
  }


  mensagemContrato.style.color =
    '#6e688f';

  mensagemContrato.textContent =
    'Carregando dados da empresa...';


  const {
    data: empresa,
    error
  } =
    await supabaseClient
      .from('empresas')
      .select(`
        id,
        razao_social,
        nome_fantasia,
        cpf_cnpj,
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
        logo_url,
        ativo
      `)
      .eq(
        'id',
        empresaSelecionadaId
      )
      .single();


  if (
    error ||
    !empresa
  ) {

    console.error(
      error
    );

    cabecalhoContrato.style.display =
      'none';

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Não foi possível carregar os dados da empresa selecionada.';

    return;
  }


  preencherCabecalho(
    empresa
  );


  mensagemContrato.style.color =
    '#4f7a57';

  mensagemContrato.textContent =
    'Cabeçalho carregado automaticamente.';
}



function montarEnderecoCliente(
  cliente
) {

  const linha1 = [
    cliente.endereco,
    cliente.numero
  ]
    .filter(Boolean)
    .join(', ');

  const linha2 = [
    cliente.complemento,
    cliente.bairro,
    cliente.cidade,
    cliente.estado
  ]
    .filter(Boolean)
    .join(' - ');

  return [
    linha1,
    linha2
  ]
    .filter(Boolean)
    .join(' - ') || '-';
}


function preencherPreviewCliente(
  cliente
) {

  document.getElementById(
    'clienteRazaoSocial'
  ).textContent =
    textoOuTraco(
      cliente.razao_social
    );

  document.getElementById(
    'clienteCnpj'
  ).textContent =
    textoOuTraco(
      cliente.cpf_cnpj
    );

  document.getElementById(
    'clienteFantasia'
  ).textContent =
    textoOuTraco(
      cliente.nome_fantasia
    );

  document.getElementById(
    'clienteEndereco'
  ).textContent =
    montarEnderecoCliente(
      cliente
    );

  const telefoneCliente =
    [
      cliente.telefone,
      cliente.celular_whatsapp
    ]
      .filter(Boolean)
      .join(' / ');

  document.getElementById(
    'clienteTelefone'
  ).textContent =
    telefoneCliente || '-';

  document.getElementById(
    'clienteContato'
  ).textContent =
    textoOuTraco(
      cliente.contato ||
      cliente.responsavel
    );

  document.getElementById(
    'clienteEmail'
  ).textContent =
    textoOuTraco(
      cliente.email
    );

  document.getElementById(
    'blocoClienteContrato'
  ).style.display =
    'block';
}


async function carregarClienteSelecionado(
  clienteSelecionadoId
) {

  const {
    data: cliente,
    error
  } =
    await supabaseClient
      .from('clientes')
      .select(`
        id,
        razao_social,
        nome_fantasia,
        cpf_cnpj,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        telefone,
        celular_whatsapp,
        contato,
        responsavel,
        email,
        ativo
      `)
      .eq(
        'id',
        clienteSelecionadoId
      )
      .single();


  if (
    error ||
    !cliente
  ) {

    console.error(
      error
    );

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Não foi possível carregar os dados do cliente.';

    return;
  }


  preencherPreviewCliente(
    cliente
  );

  atualizarAssinaturaCliente(
    cliente
  );
}




const horariosPadraoSabadoDomingo = [
  '08:10',
  '08:45',
  '09:10',
  '09:45',
  '10:10',
  '10:45',
  '11:10',
  '11:45'
];

const horariosPadraoTercaQuinta = [
  '15:10',
  '15:45',
  '16:10',
  '16:45',
  '17:10',
  '17:45',
  '18:10',
  '18:45',
  '19:10',
  '19:45',
  '20:10',
  '20:45'
];


function renderizarCamposHorario(
  containerId,
  quantidade,
  prefixo,
  horariosPadrao
) {

  const container =
    document.getElementById(
      containerId
    );


  if (!container) {
    return;
  }


  const quantidadeNumerica =
    Math.max(
      0,
      Number(
        quantidade || 0
      )
    );


  // Ao alterar a quantidade de inserções, preserve os horários já editados.
  const horariosAtuais = Array.from(container.querySelectorAll('input[type="time"]'))
    .map(input => input.value);

  container.innerHTML =
    '';


  if (
    quantidadeNumerica === 0
  ) {

    const aviso =
      document.createElement(
        'div'
      );

    aviso.textContent =
      'Informe a quantidade de inserções acima.';

    aviso.style.gridColumn =
      '1 / -1';

    aviso.style.color =
      '#6e688f';

    aviso.style.fontSize =
      '13px';

    aviso.style.textAlign =
      'center';

    container.appendChild(
      aviso
    );

    return;
  }


  for (
    let i = 0;
    i < quantidadeNumerica;
    i++
  ) {

    const input =
      document.createElement(
        'input'
      );

    input.type =
      'time';

    input.id =
      `${prefixo}_${i + 1}`;

    input.name =
      `${prefixo}[]`;

    input.required =
      true;

    input.value =
      horariosAtuais[i] ?? horariosPadrao[i] ?? '';

    input.title =
      `Horário ${i + 1}`;

    const celula =
      document.createElement(
        'div'
      );

    celula.className =
      'celula-horario';

    celula.appendChild(
      input
    );

    container.appendChild(
      celula
    );
  }
}



function atualizarCamposHorarios() {

  const tercaQuinta =
    document.getElementById(
      'insercoesTercaQuinta'
    );

  const sabadoDomingo =
    document.getElementById(
      'insercoesSabadoDomingo'
    );

  const blocoHorarios =
    document.querySelector(
      '.horarios-insercoes'
    );

  const grupoSabadoDomingo =
    document.getElementById(
      'grupoSabadoDomingo'
    );

  const grupoTercaQuinta =
    document.getElementById(
      'grupoTercaQuinta'
    );

  const qtdSabadoDomingo =
    Number(
      sabadoDomingo?.value || 0
    );

  const qtdTercaQuinta =
    Number(
      tercaQuinta?.value || 0
    );

  const existeHorario =
    qtdSabadoDomingo > 0 ||
    qtdTercaQuinta > 0;


  if (blocoHorarios) {
    blocoHorarios.style.display =
      existeHorario
        ? 'block'
        : 'none';
  }


  if (
    grupoSabadoDomingo
  ) {
    grupoSabadoDomingo.style.display =
      qtdSabadoDomingo > 0
        ? 'block'
        : 'none';
  }

  if (
    grupoTercaQuinta
  ) {
    grupoTercaQuinta.style.display =
      qtdTercaQuinta > 0
        ? 'block'
        : 'none';
  }


  renderizarCamposHorario(
    'horariosSabadoDomingo',
    qtdSabadoDomingo,
    'horarioSabadoDomingo',
    horariosPadraoSabadoDomingo
  );


  renderizarCamposHorario(
    'horariosTercaQuinta',
    qtdTercaQuinta,
    'horarioTercaQuinta',
    horariosPadraoTercaQuinta
  );
}


function atualizarResumoInsercoes() {

  const tercaQuinta =
    document.getElementById(
      'insercoesTercaQuinta'
    );

  const sabadoDomingo =
    document.getElementById(
      'insercoesSabadoDomingo'
    );

  const resumo =
    document.getElementById(
      'resumoInsercoes'
    );


  if (
    !tercaQuinta ||
    !sabadoDomingo ||
    !resumo
  ) {
    return;
  }


  const qtdTercaQuinta =
    tercaQuinta.value.trim();

  const qtdSabadoDomingo =
    sabadoDomingo.value.trim();


  if (
    !qtdTercaQuinta &&
    !qtdSabadoDomingo
  ) {

    resumo.textContent =
      'Informe as duas quantidades de inserções.';

    return;
  }


  resumo.textContent =
    `${qtdTercaQuinta || 0}x às terças e quintas e ${qtdSabadoDomingo || 0}x aos sábados e domingos`;
}


for (
  const id of [
    'insercoesTercaQuinta',
    'insercoesSabadoDomingo'
  ]
) {

  const campo =
    document.getElementById(
      id
    );

  if (campo) {

    campo.addEventListener(
      'input',
      () => {

        atualizarResumoInsercoes();
        atualizarQuantidadeMensalSugerida();
        atualizarCamposHorarios();
      }
    );
  }
}


function formatarMoedaCampo(
  input
) {

  const numeros =
    input.value
      .replace(/\D/g, '');

  if (!numeros) {
    input.value = '';
    return;
  }

  const valor =
    Number(numeros) / 100;

  input.value =
    valor.toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL'
      }
    );
}


for (
  const id of [
    'valorMensal',
    'valorVista'
  ]
) {

  const campo =
    document.getElementById(
      id
    );

  if (campo) {

    campo.addEventListener(
      'input',
      () => {
        formatarMoedaCampo(
          campo
        );
      }
    );
  }
}


empresaId.addEventListener(
  'change',
  async () => {

    cabecalhoContrato.style.display =
      'none';

    clienteId.disabled =
      true;

    clienteId.innerHTML =
      '<option value="">Selecione primeiro a empresa</option>';

    mensagemContrato.textContent =
      '';


    if (
      !empresaId.value
    ) {
      return;
    }


    await carregarEmpresaSelecionada(
      empresaId.value
    );


    await carregarClientesGlobais();
  }
);


clienteId.addEventListener(
  'change',
  async () => {

    const blocoClienteContrato =
      document.getElementById(
        'blocoClienteContrato'
      );

    if (
      !clienteId.value
    ) {

      if (blocoClienteContrato) {
        blocoClienteContrato.style.display =
          'none';
      }

      return;
    }


    await carregarClienteSelecionado(
      clienteId.value
    );


    mensagemContrato.style.color =
      '#4f7a57';

    mensagemContrato.textContent =
      'Cliente carregado. Preencha os dados do contrato.';
  }
);




function moedaParaNumero(valor) {
  if (!valor) return null;

  const limpo = String(valor)
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  const numero = Number(limpo);

  return Number.isFinite(numero)
    ? numero
    : null;
}



// Precificação contratual: as quantidades da tabela são POR DIA.
// Base mensal comercial padrão: quatro semanas (ter/qui, sáb/dom).
// A quantidade mensal pode ser ajustada explicitamente pelo usuário.
let insercoesMensaisPersonalizadas = false;
let valorUnitarioInsercaoLegado = false;
// Não recalcular a distribuição de contratos legados só por abrir a edição.
let composicaoRecalculada = false;
let percentualDescontoLegado = false;
let descontoAlteradoManualmente = false;
let percentualPermutaOriginal = null;
// As quatro opções visuais são distintas das três modalidades persistidas no banco.
let tipoPagamentoSelecionado = 'VISTA';
const moedaBRInsercao = centavos => (centavos / 100).toLocaleString('pt-BR', {
  style:'currency', currency:'BRL'
});
function quantidadeMensalSugerida() {
  const t = Number(valorCampo('insercoesTercaQuinta'));
  const s = Number(valorCampo('insercoesSabadoDomingo'));
  if (!Number.isInteger(t) || t < 0 || !Number.isInteger(s) || s < 0) return 0;
  return (2*t + 2*s) * 4;
}
function atualizarQuantidadeMensalSugerida(forcar = false) {
  const campo = document.getElementById('insercoesMensais');
  if (!campo || (insercoesMensaisPersonalizadas && !forcar)) return;
  const qtd = quantidadeMensalSugerida();
  campo.value = qtd > 0 ? String(qtd) : '';
  if (forcar) insercoesMensaisPersonalizadas = false;
  recalcularPrecoPorInsercao();
}
function dadosPrecoInsercao() {
  const unitario = moedaParaNumero(valorCampo('valorUnitarioInsercao'));
  const qtd = Number(valorCampo('insercoesMensais'));
  const meses = Number(valorCampo('duracaoMeses'));
  const centavosUnitario = unitario === null ? 0 : Math.round(unitario*100);
  const valido = Number.isSafeInteger(centavosUnitario) && centavosUnitario > 0 &&
    Number.isSafeInteger(qtd) && qtd >= 1 && qtd <= 100000 &&
    Number.isInteger(meses) && meses >= 1 && meses <= 120;
  return {unitario, qtd, meses, valido,
    mensalCentavos: valido ? centavosUnitario*qtd : 0,
    totalCentavos: valido ? centavosUnitario*qtd*meses : 0};
}
// O percentual não representa uma cobrança: ele apenas divide o total comercial.
function lerPercentualPermuta() {
  const texto = valorCampo('percentualPermuta').trim().replace('%','').trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(texto)) return null;
  const numero = Number(texto.replace(',','.'));
  return Number.isFinite(numero) && numero > 0 && numero < 100 ? numero : null;
}
function recalcularPrecoPorInsercao(atualizarDivisao = true) {
  const preco = dadosPrecoInsercao();
  const campoMensal = document.getElementById('valorMensal');
  const ajuda = document.getElementById('ajudaCalculoInsercoes');
  const digitouValorUnitario = Boolean(valorCampo('valorUnitarioInsercao'));
  if (preco.valido) {
    if (campoMensal) campoMensal.value = moedaBRInsercao(preco.mensalCentavos);
    if (ajuda) ajuda.textContent = `${preco.qtd} inserções/mês × ${moedaBRInsercao(Math.round(preco.unitario*100))} = ${moedaBRInsercao(preco.mensalCentavos)}/mês. Vigência ${preco.meses} meses: ${moedaBRInsercao(preco.totalCentavos)} no contrato. A quantidade mensal usa 4 semanas como sugestão e pode ser ajustada.`;
    if (atualizarDivisao) {
      const modalidade = valorCampo('modalidadeContrato') || 'FINANCEIRO';
      const financeiro = document.getElementById('valorFinanceiroContrato');
      const permuta = document.getElementById('valorPermuta');
      if (modalidade === 'FINANCEIRO') {
        if (financeiro) financeiro.value = moedaBRInsercao(preco.totalCentavos);
        if (permuta) permuta.value = moedaBRInsercao(0);
      } else if (modalidade === 'PERMUTA') {
        if (financeiro) financeiro.value = moedaBRInsercao(0);
        if (permuta) permuta.value = moedaBRInsercao(preco.totalCentavos);
      } else if (modalidade === 'MISTO') {
        // O usuário escolhe o percentual; o valor da permuta é calculado em centavos.
        const percentual = lerPercentualPermuta();
        const permutaCentavos = percentual === null ? null :
          Math.round(preco.totalCentavos * Math.round(percentual*100) / 10000);
        if (permuta) permuta.value = permutaCentavos === null ? '' : moedaBRInsercao(permutaCentavos);
        if (financeiro) financeiro.value = permutaCentavos === null ? '' :
          moedaBRInsercao(preco.totalCentavos - permutaCentavos);
      }
      if (!modoEdicaoInicializando && preco.valido) composicaoRecalculada = true;
    }
  } else if (atualizarDivisao && contratoSalvoId && valorCampo('modalidadeContrato') === 'MISTO') {
    // Contrato antigo sem precificação por inserção: conservar o total salvo.
    const totalAntigo = moedaParaNumero(valorCampo('valorTotalContrato'));
    const percentual = lerPercentualPermuta();
    if (totalAntigo !== null && totalAntigo > 0) {
      const centavosTotal = Math.round(totalAntigo*100);
      const centavosPermuta = percentual === null ? null : Math.round(centavosTotal*Math.round(percentual*100)/10000);
      const campoPermuta = document.getElementById('valorPermuta');
      const campoFinanceiro = document.getElementById('valorFinanceiroContrato');
      if (campoPermuta) campoPermuta.value = centavosPermuta === null ? '' : moedaBRInsercao(centavosPermuta);
      if (campoFinanceiro) campoFinanceiro.value = centavosPermuta === null ? '' : moedaBRInsercao(centavosTotal-centavosPermuta);
      composicaoRecalculada = true;
    }
  } else if (digitouValorUnitario || !contratoSalvoId) {
    if (campoMensal) campoMensal.value = '';
    if (ajuda) ajuda.textContent = 'Informe valor unitário, quantidade mensal e duração para calcular o preço. Sugestão: quatro semanas por mês; ajuste a quantidade se necessário.';
  }
  if (typeof atualizarPreviaFinanceira === 'function') atualizarPreviaFinanceira();
}
for (const id of ['valorUnitarioInsercao', 'insercoesMensais']) {
  const campo = document.getElementById(id);
  if (campo) for (const evento of ['input','change']) campo.addEventListener(evento, () => {
    if (id === 'insercoesMensais' && !modoEdicaoInicializando) insercoesMensaisPersonalizadas = true;
    recalcularPrecoPorInsercao();
  });
}
document.getElementById('valorUnitarioInsercao')?.addEventListener('blur', () => {
  const campo = document.getElementById('valorUnitarioInsercao');
  const valor = moedaParaNumero(campo.value);
  if (Number.isFinite(valor) && valor > 0) campo.value = moedaBRInsercao(Math.round(valor*100));
});
document.getElementById('btnRestaurarInsercoesMensais')?.addEventListener('click', () => {
  atualizarQuantidadeMensalSugerida(true);
  marcarContratoComoAlterado();
});
// A porcentagem escolhida altera a composição do contrato, não o total comercial.
document.getElementById('modalidadeContrato')?.addEventListener('change', () => recalcularPrecoPorInsercao());
for (const evento of ['input','change']) document.getElementById('percentualPermuta')?.addEventListener(evento, () => {
  if (valorCampo('modalidadeContrato') === 'MISTO' && !modoEdicaoInicializando) {
    composicaoRecalculada = true;
    recalcularPrecoPorInsercao();
    marcarContratoComoAlterado();
  }
});

function marcarContratoComoAlterado() {
  if (salvandoContrato || modoEdicaoInicializando) return;

  contratoPossuiAlteracoes = true;

  if (estadoSalvamentoContrato) {
    estadoSalvamentoContrato.textContent = '• Alterações não salvas';
    estadoSalvamentoContrato.className = 'estado-nao-salvo';
  }

  const btnGerarWord = document.getElementById('btnGerarWord');
  const btnGerarPdf = document.getElementById('btnGerarPdf');

  if (btnGerarWord) btnGerarWord.disabled = true;
  if (btnGerarPdf) btnGerarPdf.disabled = true;
}


function marcarContratoComoSalvo(contrato) {
  contratoSalvoId = contrato.id;
  numeroContratoSalvo = contrato.numero_contrato;
  contratoPossuiAlteracoes = false;

  if (numeroContratoExibicao) {
    numeroContratoExibicao.textContent = numeroContratoSalvo;
  }

  if (estadoSalvamentoContrato) {
    estadoSalvamentoContrato.textContent = '• Salvo';
    estadoSalvamentoContrato.className = 'estado-salvo';
  }

  const btnGerarWord = document.getElementById('btnGerarWord');
  const btnGerarPdf = document.getElementById('btnGerarPdf');

  if (btnGerarWord) {
    btnGerarWord.disabled = false;
    btnGerarWord.title = '';
  }

  if (btnGerarPdf) {
    btnGerarPdf.disabled = false;
    btnGerarPdf.title = '';
  }
}


function obterHorariosDoGrupo(seletor) {
  return Array.from(
    document.querySelectorAll(seletor)
  )
    .map(campo => campo.value)
    .filter(Boolean);
}



function validarArquivoAudio(arquivo) {
  if (!arquivo) return true;

  const limiteBytes = 25 * 1024 * 1024;

  if (arquivo.size > limiteBytes) {
    if (statusAudioCliente) {
      statusAudioCliente.style.color = '#a44f69';
      statusAudioCliente.textContent =
        'O áudio deve ter no máximo 25 MB.';
    }

    return false;
  }

  return true;
}


function extensaoAudio(arquivo) {
  const nome = String(arquivo?.name || '');
  const partes = nome.split('.');

  if (partes.length > 1) {
    return partes.pop().toLowerCase();
  }

  return 'audio';
}


async function enviarAudioContrato(arquivo) {
  if (!arquivo) {
    return {
      url: audioContratoUrl,
      caminho: audioContratoCaminho,
      nome: audioContratoNome,
      mime: audioContratoMime
    };
  }

  if (!validarArquivoAudio(arquivo)) {
    throw new Error('Arquivo de áudio inválido.');
  }

  const extensao = extensaoAudio(arquivo);
  const pasta = contratoSalvoId || `novo_${Date.now()}`;
  const caminho = `${pasta}/${Date.now()}.${extensao}`;

  if (statusAudioCliente) {
    statusAudioCliente.style.color = '#6e688f';
    statusAudioCliente.textContent = 'Enviando áudio...';
  }

  const { error: uploadError } =
    await supabaseClient
      .storage
      .from('audios-contratos')
      .upload(
        caminho,
        arquivo,
        {
          cacheControl: '3600',
          upsert: false,
          contentType:
            arquivo.type ||
            'application/octet-stream'
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } =
    supabaseClient
      .storage
      .from('audios-contratos')
      .getPublicUrl(caminho);

  const url =
    publicUrlData?.publicUrl ||
    null;

  if (!url) {
    throw new Error(
      'Não foi possível obter a URL pública do áudio.'
    );
  }

  return {
    url,
    caminho,
    nome: arquivo.name || `audio.${extensao}`,
    mime: arquivo.type || null
  };
}


if (arquivoAudioCliente) {
  arquivoAudioCliente.addEventListener(
    'change',
    () => {
      const arquivo =
        arquivoAudioCliente.files?.[0] ||
        null;

      if (!arquivo) {
        if (previewAudioCliente) {
          previewAudioCliente.style.display = 'none';
          previewAudioCliente.removeAttribute('src');
        }

        return;
      }

      if (!validarArquivoAudio(arquivo)) {
        arquivoAudioCliente.value = '';
        return;
      }

      if (previewAudioCliente) {
        previewAudioCliente.src =
          URL.createObjectURL(arquivo);

        previewAudioCliente.style.display =
          'block';
      }

      if (statusAudioCliente) {
        statusAudioCliente.style.color = '#6e688f';
        statusAudioCliente.textContent =
          `Selecionado: ${arquivo.name}`;
      }
    }
  );
}



function atualizarAudioAtualEdicao() {
  const bloco = document.getElementById('audioAtualContrato');
  const link = document.getElementById('linkAudioAtualContrato');
  const remocao = document.getElementById('removerAudioContrato');
  if (!bloco || !link) return;
  bloco.style.display = audioContratoNome || audioContratoUrl ? 'block' : 'none';
  link.textContent = audioContratoNome || 'Ouvir áudio atual';
  if (audioContratoUrl && /^https?:\/\//i.test(audioContratoUrl)) {
    link.href = audioContratoUrl;
    link.style.display = 'inline';
  } else {
    link.removeAttribute('href');
    link.style.display = 'none';
  }
  if (remocao) remocao.checked = false;
}

// Vigência contratual: data de início + N meses - 1 dia, sempre usando UTC
// para evitar erros de fuso horário e de meses com menos de 31 dias.
// A duração é recuperada das datas ao editar: nenhuma coluna nova é exigida.
let parcelasAlteradasManualmente = false;
let vigenciaLegadaOriginal = null;
function calcularTerminoPorMeses(inicioISO, quantidadeMeses) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicioISO || '') ||
      !Number.isInteger(Number(quantidadeMeses)) ||
      Number(quantidadeMeses) < 1 || Number(quantidadeMeses) > 120) return '';
  const [ano, mes, dia] = inicioISO.split('-').map(Number);
  const origem = new Date(Date.UTC(ano, mes - 1, dia));
  if (origem.getUTCFullYear() !== ano || origem.getUTCMonth() !== mes - 1 ||
      origem.getUTCDate() !== dia) return '';
  const referencia = new Date(Date.UTC(ano, mes - 1 + Number(quantidadeMeses), 1));
  const ultimoDia = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1, 0)).getUTCDate();
  const aniversario = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), Math.min(dia, ultimoDia)));
  aniversario.setUTCDate(aniversario.getUTCDate() - 1);
  return aniversario.toISOString().slice(0, 10);
}
function mesesDasDatas(inicioISO, terminoISO) {
  if (!inicioISO || !terminoISO) return null;
  for (let meses = 1; meses <= 120; meses++) {
    if (calcularTerminoPorMeses(inicioISO, meses) === terminoISO) return meses;
  }
  return null;
}
function atualizarVigenciaContrato(alterouDuracao = false) {
  const inicio = valorCampo('dataInicio');
  const quantidade = document.getElementById('duracaoMeses');
  const termino = document.getElementById('dataTermino');
  const ajuda = document.getElementById('ajudaDuracaoContrato');
  if (!quantidade || !termino) return;
  const meses = Number(quantidade.value);
  const valido = quantidade.value.trim() !== '' && Number.isInteger(meses) && meses >= 1 && meses <= 120;
  const calculado = valido ? calcularTerminoPorMeses(inicio, meses) : '';
  // Nos contratos anteriores com vigência irregular, preservar o término antigo
  // até que o usuário informe explicitamente a nova duração.
  const preservarLegado = vigenciaLegadaOriginal && !quantidade.value.trim() &&
    inicio === vigenciaLegadaOriginal.inicio;
  if (preservarLegado) termino.value = vigenciaLegadaOriginal.termino;
  else termino.value = calculado;
  if (alterouDuracao && calculado) vigenciaLegadaOriginal = null;
  if (valido && tipoPagamentoSelecionado === 'MENSAL') {
    const parcelas = document.getElementById('quantidadeParcelas');
    if (parcelas) parcelas.value = String(meses);
    parcelasAlteradasManualmente = false;
  } else if (alterouDuracao && valido && !parcelasAlteradasManualmente) {
    const parcelas = document.getElementById('quantidadeParcelas');
    if (parcelas) parcelas.value = String(meses);
  }
  if (ajuda) {
    if (preservarLegado) ajuda.textContent = 'Contrato anterior: o término cadastrado não corresponde a um período fechado em meses. As datas originais foram preservadas. Informe a duração para recalcular.';
    else if (!inicio || !quantidade.value.trim()) ajuda.textContent = 'Informe a data inicial e a duração em meses. O término é calculado automaticamente; as parcelas são sugeridas, mas podem ser alteradas.';
    else if (!calculado) ajuda.textContent = 'Informe uma data de início válida e uma duração inteira entre 1 e 120 meses.';
    else ajuda.textContent = `Término calculado: ${calculado.split('-').reverse().join('/')}. ${tipoPagamentoSelecionado === 'MENSAL' ? `Contrato mensal com ${meses} parcela(s), sem desconto.` : parcelasAlteradasManualmente ? 'Quantidade de parcelas personalizada mantida.' : 'Parcelas sugeridas pela duração; você pode alterá-las.'}`;
  }
}
const campoDuracaoContrato = document.getElementById('duracaoMeses');
const campoInicioContrato = document.getElementById('dataInicio');
const campoParcelasDuracao = document.getElementById('quantidadeParcelas');
if (campoDuracaoContrato) for (const evento of ['input', 'change']) {
  campoDuracaoContrato.addEventListener(evento, () => { atualizarVigenciaContrato(true); recalcularPrecoPorInsercao(); });
}
if (campoInicioContrato) for (const evento of ['input', 'change']) {
  campoInicioContrato.addEventListener(evento, () => { atualizarVigenciaContrato(); atualizarPreviaFinanceira(); });
}
if (campoParcelasDuracao) for (const evento of ['input', 'change']) {
  campoParcelasDuracao.addEventListener(evento, () => {
    if (!modoEdicaoInicializando) parcelasAlteradasManualmente = true;
    atualizarVigenciaContrato();
  });
}

// Regras sincronizadas com o gatilho SQL: pagamento à vista substitui o total,
// entrada faz parte do valor total e os centavos são distribuídos sem diferença.
function proximoVencimentoMensal(iso, meses) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const [ano, mes, dia] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}
// Trabalha em centavos e com até duas casas decimais no percentual.
// Aceita 12,5 ou 12.5; não trata ponto decimal como separador de milhar.
function lerPercentualDesconto() {
  const s = valorCampo('percentualDescontoVista').trim().replace('%','').trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(s)) return null;
  const valor = Number(s.replace(',', '.'));
  return Number.isFinite(valor) ? valor : null;
}
function atualizarValorVistaPorPercentual() {
  const campoVista = document.getElementById('valorVista');
  if (!campoVista) return;
  const baseFinanceira = moedaParaNumero(valorCampo('valorFinanceiroContrato'));
  const valorBase = baseFinanceira === null ? null : Math.round(baseFinanceira*100);
  const condicao = valorCampo('condicaoPagamento');
  const descontoParcelado = tipoPagamentoSelecionado === 'PARCELADO_DESCONTO';
  if ((condicao !== 'AVISTA' && !descontoParcelado) || valorBase === null || valorBase < 0) {
    // Não apagar o valor histórico apenas por abrir a edição.
    if (!contratoSalvoId || composicaoRecalculada) campoVista.value = '';
    return;
  }
  const aplicaDesconto = ['VISTA_DESCONTO','PARCELADO_DESCONTO'].includes(tipoPagamentoSelecionado);
  const percentual = aplicaDesconto ? lerPercentualDesconto() : 0;
  if (percentual === null || percentual < 0 || percentual >= 100) {
    campoVista.value = '';
    return;
  }
  const novoTotal = Math.round(valorBase * (10000-Math.round(percentual*100))/10000);
  // O preço à vista legado sem percentual cadastrado permanece inalterado
  // até alguma condição financeira ser escolhida explicitamente.
  if (condicao === 'AVISTA' && percentualDescontoLegado && !descontoAlteradoManualmente && !composicaoRecalculada && contratoSalvoId) return;
  campoVista.value = moedaBRInsercao(novoTotal);
}
function controlarModalidadeContrato() {
  const modalidade = valorCampo('modalidadeContrato') || 'FINANCEIRO';
  document.querySelectorAll('input[name="tipoModalidadeVisual"]').forEach(radio => {
    radio.checked = radio.value === tipoPagamentoSelecionado;
  });
  const legado = document.getElementById('avisoModalidadeLegada');
  if (legado) legado.hidden = tipoPagamentoSelecionado !== 'LEGADO_PARCELADO';
  const temFinanceiro = modalidade !== 'PERMUTA';
  const temPermuta = modalidade !== 'FINANCEIRO';
  for (const id of ['grupoValorFinanceiro','dadosPagamentoFinanceiro','grupoFormaPagamento','grupoPrimeiroVencimento']) {
    const el = document.getElementById(id); if (el) el.hidden = !temFinanceiro;
  }
  for (const id of ['grupoValorPermuta','grupoDescricaoPermuta']) {
    const el = document.getElementById(id); if (el) el.hidden = !temPermuta;
  }
  const grupoPercentual = document.getElementById('grupoPercentualPermuta');
  if (grupoPercentual) grupoPercentual.hidden = modalidade !== 'MISTO';
  const valorPermuta = document.getElementById('valorPermuta');
  if (valorPermuta) {
    valorPermuta.readOnly = true;
    valorPermuta.setAttribute('aria-readonly', 'true');
  }
  const ajudaPermuta = document.getElementById('orientacaoPermuta');
  if (ajudaPermuta) ajudaPermuta.hidden = modalidade !== 'MISTO';
  const aVista = valorCampo('condicaoPagamento') === 'AVISTA';
  const mensal = tipoPagamentoSelecionado === 'MENSAL';
  const qtdMensal = document.getElementById('quantidadeParcelas');
  const mesesMensais = Number(valorCampo('duracaoMeses'));
  if (qtdMensal) {
    qtdMensal.readOnly = mensal;
    if (mensal) {
      qtdMensal.value = Number.isInteger(mesesMensais) && mesesMensais >= 1 && mesesMensais <= 120 ? String(mesesMensais) : '';
      parcelasAlteradasManualmente = false;
    }
  }
  const rotuloQtd = document.getElementById('rotuloQuantidadeParcelas');
  if (rotuloQtd) rotuloQtd.textContent = mensal ? 'Parcelas mensais (igual à duração) *' : 'Quantidade de parcelas * (sem contar a entrada)';
  const avisoQtd = document.getElementById('avisoParcelasMensais');
  if (avisoQtd) avisoQtd.hidden = !mensal;
  for (const id of ['grupoParcelas','grupoEntrada','grupoVencimentoEntrada']) {
    const el = document.getElementById(id);
    if (el) el.hidden = !temFinanceiro || aVista ||
      (mensal && id !== 'grupoParcelas') ||
      (id === 'grupoVencimentoEntrada' && !(moedaParaNumero(valorCampo('valorEntrada')) > 0));
  }
  const desconto = document.getElementById('grupoDescontoVista');
  const descontoAplicavel = ['VISTA_DESCONTO','PARCELADO_DESCONTO'].includes(tipoPagamentoSelecionado);
  if (desconto) desconto.hidden = !descontoAplicavel;
  const rotuloPercentual = document.getElementById('rotuloPercentualDesconto');
  if (rotuloPercentual) rotuloPercentual.textContent = tipoPagamentoSelecionado === 'PARCELADO_DESCONTO' ? 'Desconto no parcelamento (%) *' : 'Desconto à vista (%) *';
  const rotuloValorDesconto = document.getElementById('rotuloValorFinalDesconto');
  if (rotuloValorDesconto) rotuloValorDesconto.textContent = tipoPagamentoSelecionado === 'PARCELADO_DESCONTO' ? 'Total parcelado com desconto (R$)' : 'Valor final à vista (R$)';
  const textoAjudaDesconto = document.getElementById('ajudaDescontoVista');
  if (textoAjudaDesconto) textoAjudaDesconto.textContent = 'Informe desconto entre 0,01% e 99,99%. O sistema calcula as parcelas com o valor reduzido.';
  const condicaoGrupo = document.getElementById('grupoCondicaoPagamento');
  if (condicaoGrupo) condicaoGrupo.hidden = modalidade !== 'MISTO' && tipoPagamentoSelecionado !== 'LEGADO_PARCELADO';
  const data = document.getElementById('dataPrimeiroVencimento');
  const dia = document.getElementById('diaVencimento');
  if (dia) dia.value = temFinanceiro && data?.value ? Number(data.value.slice(-2)) : '';
  const lbl = document.getElementById('labelPrimeiroVencimento');
  if (lbl) lbl.textContent = aVista ? 'Data do pagamento à vista *' : 'Data do primeiro vencimento *';
  const op = document.querySelector('#condicaoPagamento option[value="AVISTA"]');
  if (op) op.textContent = 'À vista (sem desconto)';
}
function dadosFinanceirosDoFormulario() {
  atualizarValorVistaPorPercentual();
  const modalidade = valorCampo('modalidadeContrato') || 'FINANCEIRO';
  const temFinanceiro = modalidade !== 'PERMUTA';
  const temPermuta = modalidade !== 'FINANCEIRO';
  const condicao = temFinanceiro && valorCampo('condicaoPagamento') === 'AVISTA' ? 'AVISTA' : 'PARCELADO';
  const centavos = v => v === null || !Number.isFinite(v) ? NaN : Math.round(v*100);
  const financeiroCentavos = temFinanceiro ? centavos(moedaParaNumero(valorCampo('valorFinanceiroContrato'))) : 0;
  const permutaCentavos = temPermuta ? centavos(moedaParaNumero(valorCampo('valorPermuta'))) : 0;
  const comercialCentavos = financeiroCentavos + permutaCentavos;
  const valorVistaCentavos = centavos(moedaParaNumero(valorCampo('valorVista')));
  const percentual = lerPercentualDesconto();
  const percentualValido = percentual !== null && Number.isFinite(percentual) && percentual >= 0 && percentual < 100 &&
    Math.abs(Math.round(percentual * 100) - percentual * 100) < 0.00001;
  const totalCentavos = !temFinanceiro ? 0 :
    (condicao === 'AVISTA' || tipoPagamentoSelecionado === 'PARCELADO_DESCONTO')
      ? valorVistaCentavos : financeiroCentavos;
  const entradaCentavos = !temFinanceiro || condicao === 'AVISTA' ? 0 : centavos(moedaParaNumero(valorCampo('valorEntrada')) ?? 0);
  const saldoCentavos = totalCentavos - entradaCentavos;
  const qtd = !temFinanceiro ? 0 : condicao === 'AVISTA' ? 1 : Number(valorCampo('quantidadeParcelas'));
  const quantidadeMensal = saldoCentavos === 0 && entradaCentavos > 0 ? 0 : qtd;
  const baseCentavos = quantidadeMensal > 0 ? Math.floor(saldoCentavos / quantidadeMensal) : 0;
  const restoCentavos = quantidadeMensal > 0 ? saldoCentavos - baseCentavos*quantidadeMensal : 0;
  const primeiro = valorCampo('dataPrimeiroVencimento');
  const entradaData = valorCampo('dataVencimentoEntrada');
  const erro = [];
  if (!['FINANCEIRO','PERMUTA','MISTO'].includes(modalidade)) erro.push('modalidade inválida');
  if (['VISTA_DESCONTO','PARCELADO_DESCONTO'].includes(tipoPagamentoSelecionado) && (!percentualValido || percentual <= 0))
    erro.push('digite um desconto maior que 0 e menor que 100%');
  if (tipoPagamentoSelecionado === 'MISTO' &&
      (lerPercentualPermuta() === null || !Number.isFinite(permutaCentavos) ||
       !Number.isFinite(financeiroCentavos) || permutaCentavos <= 0 || financeiroCentavos <= 0))
    erro.push('informe um percentual de permuta maior que 0 e menor que 100%');
  if (!Number.isFinite(comercialCentavos) || comercialCentavos <= 0) erro.push('informe os valores da modalidade contratada');
  if (temPermuta && (!Number.isFinite(permutaCentavos) || permutaCentavos <= 0)) erro.push('informe o valor da permuta');
  if (temPermuta && !valorCampo('descricaoPermuta')) erro.push('descreva os bens ou serviços da permuta');
  if (temFinanceiro && (!Number.isFinite(financeiroCentavos) || financeiroCentavos <= 0)) erro.push('informe o valor financeiro');
  if (temFinanceiro) {
    if (tipoPagamentoSelecionado === 'MENSAL') {
      const meses = Number(valorCampo('duracaoMeses'));
      if (!Number.isInteger(meses) || meses < 1 || meses > 120 || qtd !== meses)
        erro.push('o contrato mensal deve ter exatamente uma parcela por mês de duração');
      if (entradaCentavos !== 0) erro.push('o contrato mensal não possui entrada separada');
      if (valorCampo('percentualDescontoVista') && Number(lerPercentualDesconto()) !== 0)
        erro.push('o contrato mensal não possui desconto');
    }
    if (tipoPagamentoSelecionado === 'PARCELADO_DESCONTO' &&
      (!Number.isFinite(totalCentavos) || totalCentavos <= 0 || totalCentavos >= financeiroCentavos))
      erro.push('o desconto parcelado deve reduzir o valor financeiro e manter saldo positivo');
    if (!valorCampo('formaPagamento')) erro.push('selecione a forma de pagamento financeiro');
    if (!primeiro) erro.push('informe o primeiro vencimento');
    if (condicao === 'AVISTA') {
      if (!percentualValido) erro.push('informe desconto percentual válido entre 0 e 99,99%');
      if (!Number.isFinite(valorVistaCentavos) || valorVistaCentavos <= 0) erro.push('informe o valor financeiro com desconto à vista');
      if (valorVistaCentavos > financeiroCentavos) erro.push('preço à vista não pode superar o valor financeiro');
    } else {
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > 120) erro.push('informe entre 1 e 120 parcelas');
      if (!Number.isFinite(entradaCentavos) || entradaCentavos < 0) erro.push('a entrada não pode ser negativa');
      if (entradaCentavos > totalCentavos) erro.push('a entrada não pode exceder o valor financeiro');
      if (entradaCentavos > 0 && !entradaData) erro.push('informe o vencimento da entrada');
      if (entradaCentavos > 0 && entradaData && primeiro && entradaData > primeiro) erro.push('a entrada não pode vencer após a primeira parcela');
    }
    if (Number.isFinite(saldoCentavos) && saldoCentavos > 0 && quantidadeMensal > saldoCentavos) erro.push('parcela abaixo de R$ 0,01');
  }
  // Orientação por etapas: não mostrar diversos erros derivados da mesma
  // ausência de valor da permuta. Primeiro peça o valor, depois os dados de cobrança.
  if (modalidade === 'MISTO' &&
      (!(permutaCentavos > 0) || !(financeiroCentavos > 0))) {
    erro.splice(0, erro.length, 'Informe o percentual de permuta (entre 0,01% e 99,99%)');
    if (!valorCampo('descricaoPermuta')) erro.push('descreva o que será entregue na permuta');
  }
  // Campo calculado sempre usa centavos inteiros para evitar divergências.
  const campoTotal = document.getElementById('valorTotalContrato');
  if (campoTotal) campoTotal.value = Number.isFinite(comercialCentavos) ? (comercialCentavos/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '';
  const cobrancas = [];
  if (temFinanceiro && !erro.length) {
    if (entradaCentavos > 0) cobrancas.push({nome:'Entrada',data:entradaData,centavos:entradaCentavos});
    for (let i=0;i<quantidadeMensal;i++) cobrancas.push({nome:condicao==='AVISTA'?'À vista':`Parcela ${i+1}/${quantidadeMensal}`,
      data:proximoVencimentoMensal(primeiro,i),centavos:baseCentavos+(i<restoCentavos?1:0)});
  }
  return {modalidade,condicao,temFinanceiro,temPermuta,financeiroCentavos,permutaCentavos,comercialCentavos,
    percentualDesconto: percentualValido ? percentual : null,
    totalCentavos,entradaCentavos,saldoCentavos,qtd,quantidadeMensal,cobrancas,erro};
}
// Mantém o resumo de valores em sincronia com a precificação e o pagamento.
// Total inclui a permuta; eventual desconto à vista reduz somente o financeiro.
function atualizarResumoQuatroValores(f) {
  const mensalNum = moedaParaNumero(valorCampo('valorMensal'));
  const mensalCentavos = mensalNum === null ? null : Math.round(mensalNum*100);
  const total = Number.isFinite(f.comercialCentavos) && f.comercialCentavos > 0 ? f.comercialCentavos : null;
  const tipo = tipoPagamentoSelecionado;
  const comDesconto = ['VISTA_DESCONTO','PARCELADO_DESCONTO'].includes(tipo);
  const permuta = tipo === 'PERMUTA';
  const misto = tipo === 'MISTO';
  const duracao = Number(valorCampo('duracaoMeses'));
  const descontoValido = comDesconto && f.percentualDesconto > 0 && Number.isFinite(f.totalCentavos) && f.totalCentavos > 0;
  const totalComDesconto = comDesconto ? (descontoValido ? f.totalCentavos : null) : total;
  const mensalComDesconto = comDesconto && Number.isInteger(duracao) && duracao > 0 && totalComDesconto !== null
    ? Math.round(totalComDesconto / duracao) : null;
  const formatar = centavos => Number.isFinite(centavos) && centavos >= 0 ? moedaBRInsercao(centavos) : '—';
  const itemMensalDesconto = document.getElementById('resumoItemMensalDesconto');
  const itemTotalDesconto = document.getElementById('resumoItemTotalDesconto');
  if (itemMensalDesconto) itemMensalDesconto.hidden = !comDesconto;
  if (itemTotalDesconto) itemTotalDesconto.hidden = !comDesconto;
  const tituloMensal = document.getElementById('rotuloResumoMensal');
  const tituloTotal = document.getElementById('rotuloResumoTotal');
  if (tituloMensal) tituloMensal.textContent = permuta ? 'Valor mensal (permuta)' : 'Valor Mensal';
  if (tituloTotal) tituloTotal.textContent = permuta ? 'Valor total (permuta)' : 'Valor Total';
  const resumoMisto = document.getElementById('resumoDivisaoMista');
  if (resumoMisto) resumoMisto.hidden = !misto;
  const preencher = (id, valor) => { const campo=document.getElementById(id);if(campo) campo.textContent=valor; };
  preencher('valorMensalComDesconto', formatar(mensalComDesconto));
  preencher('valorTotalSemDescontoResumo', formatar(total));
  preencher('valorTotalComDescontoResumo', formatar(totalComDesconto));
  preencher('resumoPercentualPermuta', misto ? (lerPercentualPermuta() === null ? '—' : `${lerPercentualPermuta().toLocaleString('pt-BR')}%`) : '—');
  preencher('resumoValorPermuta', misto ? formatar(f.permutaCentavos) : '—');
  preencher('resumoValorDinheiro', misto ? formatar(f.financeiroCentavos) : '—');
}

function atualizarPreviaFinanceira() {
  controlarModalidadeContrato();
  const f = dadosFinanceirosDoFormulario();
  atualizarResumoQuatroValores(f);
  const valorBR = v => Number.isFinite(v) ? (v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '—';
  const el = document.getElementById('resumoFinanceiroContrato');
  if (!el) return;
  const nomes = {VISTA:'À vista', VISTA_DESCONTO:'À vista com desconto', MENSAL:'Contrato Mensal — sem desconto', PARCELADO_DESCONTO:'Parcelado com desconto', MISTO:'Permuta + dinheiro', PERMUTA:'Somente permuta', LEGADO_PARCELADO:'Financeiro parcelado (contrato antigo)'};
  el.textContent = `${nomes[tipoPagamentoSelecionado] || 'Contrato'}. ` +
    `Total comercial: ${valorBR(f.comercialCentavos)}. ` +
    (f.temPermuta ? `Permuta: ${valorBR(f.permutaCentavos)}${tipoPagamentoSelecionado === 'MISTO' ? ` (${lerPercentualPermuta() ?? '—'}%)` : ''}. ` : '') +
    (f.temFinanceiro ? `Parte financeira: ${valorBR(f.financeiroCentavos)}. ` : '') +
    (['VISTA_DESCONTO','PARCELADO_DESCONTO'].includes(tipoPagamentoSelecionado) ? `Desconto: ${f.percentualDesconto ?? '—'}%. ` : '') +
    `A receber em dinheiro: ${valorBR(f.totalCentavos)}.`;
  const linhas = document.getElementById('linhasPreviaFinanceiro');
  if (linhas) { linhas.replaceChildren(); f.cobrancas.forEach(c => {
    const tr=document.createElement('tr');
    for(const campo of [c.nome,c.data?c.data.split('-').reverse().join('/'):'—',valorBR(c.centavos)]) {
      const td=document.createElement('td');td.textContent=campo;tr.appendChild(td);
    } linhas.appendChild(tr);
  }); }
  const statusContrato=valorCampo('statusContratoEdicao').trim().toUpperCase();
  const aviso=document.getElementById('avisoStatusFinanceiro');
  if(aviso) aviso.textContent=statusContrato==='ATIVO'
    ? f.temFinanceiro ? 'ATIVO: ao salvar gera ou atualiza somente as cobranças financeiras.' : 'ATIVO somente permuta: não gera contas a receber.'
    : statusContrato==='CANCELADO' ? 'CANCELADO: cancela apenas cobranças ainda não quitadas.'
    : 'Somente ATIVO gera cobranças no Financeiro.';
  const alerta=document.getElementById('alertasFinanceirosContrato');
  if(alerta) {
    alerta.textContent = statusContrato==='ATIVO'
      ? f.erro.length ? `Impossível ativar: ${f.erro.join('; ')}.`
      : f.temFinanceiro ? `${f.cobrancas.length} cobrança(s) prevista(s), somando ${valorBR(f.totalCentavos)}. A permuta não gera cobrança.`
      : 'Contrato em permuta: nenhuma cobrança financeira será gerada.'
      : 'Contrato não ATIVO: nenhuma nova cobrança será gerada.';
    alerta.classList.toggle('destac-alerta-financeiro',statusContrato==='ATIVO' && f.erro.length>0);
  }
}
// Seis escolhas visíveis; Contrato Mensal é FINANCEIRO/PARCELADO sem desconto.
document.querySelectorAll('input[name="tipoModalidadeVisual"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    tipoPagamentoSelecionado = radio.value;
    const campo = document.getElementById('modalidadeContrato');
    const condicao = document.getElementById('condicaoPagamento');
    if (!campo || !condicao) return;
    campo.value = tipoPagamentoSelecionado === 'PERMUTA' ? 'PERMUTA' :
      tipoPagamentoSelecionado === 'MISTO' ? 'MISTO' : 'FINANCEIRO';
    condicao.value = ['MISTO', 'PERMUTA', 'MENSAL', 'PARCELADO_DESCONTO'].includes(tipoPagamentoSelecionado)
      ? 'PARCELADO' : 'AVISTA';
    if (!['VISTA_DESCONTO','PARCELADO_DESCONTO'].includes(tipoPagamentoSelecionado)) {
      const percentual = document.getElementById('percentualDescontoVista');
      if (percentual) percentual.value = '0';
    }
    if (tipoPagamentoSelecionado === 'MISTO') {
      // Não presumir porcentagem: a pessoa informa a composição contratual.
      const percentual = document.getElementById('percentualPermuta');
      if (percentual) percentual.value = '';
      const permuta = document.getElementById('valorPermuta');
      if (permuta) permuta.value = '';
    }
    if (['PERMUTA', 'MENSAL'].includes(tipoPagamentoSelecionado)) {
      const entrada = document.getElementById('valorEntrada');
      if (entrada) entrada.value = '';
      const dataEntrada = document.getElementById('dataVencimentoEntrada');
      if (dataEntrada) dataEntrada.value = '';
    }
    if (tipoPagamentoSelecionado === 'MENSAL') {
      parcelasAlteradasManualmente = false;
      atualizarVigenciaContrato();
    }
    descontoAlteradoManualmente = true;
    composicaoRecalculada = true;
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    atualizarPreviaFinanceira();
    marcarContratoComoAlterado();
  });
});
for(const id of ['modalidadeContrato','valorFinanceiroContrato','valorPermuta','percentualPermuta','descricaoPermuta','valorMensal','valorVista','percentualDescontoVista','valorEntrada', 
  'dataVencimentoEntrada','quantidadeParcelas','formaPagamento','condicaoPagamento','dataPrimeiroVencimento','statusContratoEdicao']) {
  const campo=document.getElementById(id);
  if(campo) for(const evento of ['input','change']) campo.addEventListener(evento,atualizarPreviaFinanceira);
}
document.getElementById('percentualDescontoVista')?.addEventListener('input', () => {
  if (!modoEdicaoInicializando) descontoAlteradoManualmente = true;
});
atualizarPreviaFinanceira();

async function salvarContrato() {
  if (!validarContratoParaGerar()) return;

  const inicio = valorCampo('dataInicio');
  const termino = valorCampo('dataTermino');
  const duracaoInformada = valorCampo('duracaoMeses');
  const vigenciaLegadaSemAlteracao = Boolean(contratoSalvoId && vigenciaLegadaOriginal &&
    !duracaoInformada && vigenciaLegadaOriginal.inicio === inicio &&
    vigenciaLegadaOriginal.termino === termino);
  const terminoCalculado = calcularTerminoPorMeses(inicio, Number(duracaoInformada));
  if (!vigenciaLegadaSemAlteracao && (!duracaoInformada || !terminoCalculado || termino !== terminoCalculado)) {
    mensagemContrato.style.color = '#a44f69';
    mensagemContrato.textContent = 'Informe uma duração válida (1 a 120 meses) para calcular a data de término antes de salvar.';
    document.getElementById('duracaoMeses')?.focus();
    return;
  }

  if (inicio && termino && termino < inicio) {
    mensagemContrato.style.color = '#a44f69';
    mensagemContrato.textContent =
      'A data de término não pode ser anterior à data de início.';
    return;
  }

  const precoInsercao = dadosPrecoInsercao();
  // Os contratos anteriores sem preço unitário mantêm seus valores originais.
  // Novos contratos (inclusive pendentes) usam obrigatoriamente a precificação por inserção.
  const precisaPreco = !contratoSalvoId || Boolean(valorCampo('valorUnitarioInsercao'));
  if (precisaPreco && !precoInsercao.valido) {
    mensagemContrato.style.color = '#a44f69';
    mensagemContrato.textContent = 'Informe um valor unitário válido, a quantidade mensal de inserções e a duração do contrato.';
    document.getElementById('valorUnitarioInsercao')?.focus();
    return;
  }
  const financeiro = dadosFinanceirosDoFormulario();
  if (precoInsercao.valido && precoInsercao.totalCentavos !== financeiro.comercialCentavos) {
    mensagemContrato.style.color = '#a44f69';
    mensagemContrato.textContent = `A soma dos valores financeiro + permuta deve corresponder ao total calculado pelas inserções (${moedaBRInsercao(precoInsercao.totalCentavos)}).`;
    document.getElementById('valorFinanceiroContrato')?.focus();
    return;
  }
  if (valorCampo('statusContratoEdicao').trim().toUpperCase() === 'ATIVO' && financeiro.erro.length) {
    mensagemContrato.style.color = '#a44f69';
    mensagemContrato.textContent = `Complete o financeiro antes de salvar: ${financeiro.erro.join('; ')}.`;
    atualizarPreviaFinanceira();
    document.getElementById('previsaoFinanceiraContrato')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const removerAudio = document.getElementById('removerAudioContrato')?.checked === true;
  let dadosAudio = {
    url: removerAudio ? null : audioContratoUrl,
    caminho: removerAudio ? null : audioContratoCaminho,
    nome: removerAudio ? null : audioContratoNome,
    mime: removerAudio ? null : audioContratoMime
  };

  const arquivoAudio =
    arquivoAudioCliente?.files?.[0] ||
    null;

  if (arquivoAudio) {
    try {
      dadosAudio =
        await enviarAudioContrato(
          arquivoAudio
        );
    } catch (erroAudio) {
      const detalhe =
        erroAudio?.message ||
        String(erroAudio);

      if (statusAudioCliente) {
        statusAudioCliente.style.color =
          '#a44f69';

        statusAudioCliente.textContent =
          `Erro ao enviar áudio: ${detalhe}`;
      }

      mensagemContrato.style.color =
        '#a44f69';

      mensagemContrato.textContent =
        `Erro ao enviar áudio: ${detalhe}`;

      return;
    }
  }

  const { data: autenticacao } = await supabaseClient.auth.getUser();
  const usuarioId = autenticacao?.user?.id || null;
  const diaVencimento = valorCampo('dataPrimeiroVencimento') ? Number(valorCampo('dataPrimeiroVencimento').slice(-2)) : null;
  if (diaVencimento && (+diaVencimento < 1 || +diaVencimento > 31)) {
    mensagemContrato.textContent = 'O dia do vencimento deve estar entre 1 e 31.';
    return;
  }
  const parcelas = valorCampo('quantidadeParcelas');
  if (financeiro.temFinanceiro && valorCampo('condicaoPagamento') !== 'AVISTA' && parcelas && +parcelas < 1) {
    mensagemContrato.textContent = 'A quantidade de parcelas deve ser maior que zero.';
    return;
  }
  const complementares = {
    observacoes: valorCampo('observacoes') || null,
    data_assinatura: valorCampo('dataAssinatura') || null,
    responsavel_empresa: valorCampo('responsavelEmpresaContrato') || null,
    assinante_empresa: valorCampo('assinanteEmpresaContrato').trim() ||
      nomeAssinantePadrao(empresaAtualParaAssinatura),
    responsavel_cliente: valorCampo('responsavelClienteContrato') || null,
    forma_pagamento: financeiro.temFinanceiro ? (valorCampo('formaPagamento') || null) : null,
    dia_vencimento: financeiro.temFinanceiro ? (diaVencimento || null) : null,
    modalidade_contrato: financeiro.modalidade,
    percentual_permuta: (!contratoSalvoId || composicaoRecalculada) ?
      (financeiro.modalidade === 'MISTO' && financeiro.comercialCentavos > 0
        ? Math.round(financeiro.permutaCentavos / financeiro.comercialCentavos * 10000) / 100
        : financeiro.modalidade === 'PERMUTA' ? 100 : 0) :
      percentualPermutaOriginal,
    percentual_desconto_vista: financeiro.temFinanceiro && financeiro.condicao === 'AVISTA' &&
      (!percentualDescontoLegado || descontoAlteradoManualmente || composicaoRecalculada) ? financeiro.percentualDesconto : null,
    percentual_desconto_parcelado: tipoPagamentoSelecionado === 'PARCELADO_DESCONTO'
      ? financeiro.percentualDesconto : null,
    valor_financeiro: Number.isFinite(financeiro.financeiroCentavos) ? financeiro.financeiroCentavos / 100 : null,
    valor_permuta: Number.isFinite(financeiro.permutaCentavos) ? financeiro.permutaCentavos / 100 : 0,
    descricao_permuta: financeiro.temPermuta ? valorCampo('descricaoPermuta') : null,
    condicao_pagamento: financeiro.condicao,
    periodicidade_parcelas: 'MENSAL',
    quantidade_parcelas: !financeiro.temFinanceiro ? null : financeiro.condicao === 'AVISTA' ? 1 : (parcelas ? Number(parcelas) : null),
    valor_total_contrato: Number.isFinite(financeiro.comercialCentavos) && financeiro.comercialCentavos > 0 ? financeiro.comercialCentavos / 100 : null,
    valor_entrada: financeiro.entradaCentavos / 100,
    data_vencimento_entrada: !financeiro.temFinanceiro || financeiro.condicao === 'AVISTA' ? null : (valorCampo('dataVencimentoEntrada') || null),
    data_primeiro_vencimento: financeiro.temFinanceiro ? (valorCampo('dataPrimeiroVencimento') || null) : null,
    status_assinatura: valorCampo('statusAssinatura') || null,
    pdf_url: valorCampo('pdfUrl') || null,
    cancelado_em: valorCampo('canceladoEm') ? new Date(valorCampo('canceladoEm')).toISOString() : null,
    motivo_cancelamento: valorCampo('motivoCancelamento') || null,
    atualizado_por: usuarioId
  };

  // Ao editar, mantém o registro e seu número; não cria um novo contrato.
  const dados = {
    ...complementares,
    status: valorCampo('statusContratoEdicao').toUpperCase(),
    ...(!contratoSalvoId && usuarioId ? { created_by: usuarioId } : {}),
    empresa_id: Number(valorCampo('empresaId')),
    cliente_id: Number(valorCampo('clienteId')),
    veiculo_executor: valorCampo('veiculoExecutor'),
    data_inicio: inicio,
    data_termino: termino,
    insercoes_terca_quinta: Number(valorCampo('insercoesTercaQuinta')),
    insercoes_sabado_domingo: Number(valorCampo('insercoesSabadoDomingo')),
    valor_unitario_insercao: precoInsercao.valido ? precoInsercao.unitario : null,
    insercoes_mensais: precoInsercao.valido ? precoInsercao.qtd : null,
    horarios_terca_quinta:
      obterHorariosDoGrupo('#horariosTercaQuinta input[type="time"]'),
    horarios_sabado_domingo:
      obterHorariosDoGrupo('#horariosSabadoDomingo input[type="time"]'),
    valor_mensal: moedaParaNumero(valorCampo('valorMensal')),
    valor_vista: financeiro.temFinanceiro && financeiro.condicao === 'AVISTA' ? moedaParaNumero(valorCampo('valorVista')) : null,
    texto_audio_cliente:
      valorCampo('textoAudioCliente') || null,
    audio_url:
      dadosAudio.url,
    audio_caminho:
      dadosAudio.caminho,
    audio_nome:
      dadosAudio.nome,
    audio_mime:
      dadosAudio.mime,
    updated_at: new Date().toISOString()
  };

  const novoContrato = !contratoSalvoId;
  salvandoContrato = true;
  btnSalvarContrato.disabled = true;

  mensagemContrato.style.color = '#6e688f';
  mensagemContrato.textContent =
    contratoSalvoId
      ? 'Atualizando contrato...'
      : 'Salvando contrato...';

  try {
    let resultado;

    if (contratoSalvoId) {
      resultado = await supabaseClient
        .from('contratos')
        .update(dados)
        .eq('id', contratoSalvoId)
        .select('id, numero_contrato')
        .single();
    } else {
      resultado = await supabaseClient
        .from('contratos')
        .insert(dados)
        .select('id, numero_contrato')
        .single();
    }

    if (resultado.error) throw resultado.error;

    marcarContratoComoSalvo(resultado.data);

    audioContratoUrl =
      dadosAudio.url;

    audioContratoCaminho =
      dadosAudio.caminho;

    audioContratoNome =
      dadosAudio.nome;

    audioContratoMime =
      dadosAudio.mime;

    if (arquivoAudioCliente) {
      arquivoAudioCliente.value = '';
    }
    atualizarAudioAtualEdicao();

    if (statusAudioCliente && !audioContratoNome) {
      statusAudioCliente.textContent = '';
    }

    if (
      statusAudioCliente &&
      audioContratoNome
    ) {
      statusAudioCliente.style.color =
        '#4f7a57';

      statusAudioCliente.textContent =
        `Áudio salvo: ${audioContratoNome}`;
    }

    mensagemContrato.style.color = '#4f7a57';
    mensagemContrato.textContent =
      `Contrato ${resultado.data.numero_contrato} salvo com sucesso.`;
    if (dados.status === 'ATIVO' && novoContrato && financeiro.temFinanceiro) {
      // O trigger executa na mesma transação do INSERT; esta leitura verifica a persistência real.
      const conferencia = await supabaseClient.from('financeiro_contas_receber')
        .select('id, valor_original, parcela').eq('contrato_id', resultado.data.id).eq('origem','CONTRATO');
      const esperado = financeiro.cobrancas.length;
      if (conferencia.error) {
        mensagemContrato.textContent += ' Não foi possível verificar as cobranças. Consulte Contas a Receber.';
      } else if ((conferencia.data || []).length !== esperado) {
        mensagemContrato.style.color = '#a44f69';
        mensagemContrato.textContent += ` Atenção: esperado ${esperado} lançamento(s), encontrado(s) ${(conferencia.data || []).length}. Confira o Financeiro.`;
      } else {
        const conferido = (conferencia.data || []).reduce((s,c) => s + Math.round(Number(c.valor_original)*100),0);
        if (conferido !== financeiro.totalCentavos) {
          mensagemContrato.style.color = '#a44f69';
          mensagemContrato.textContent += ' Atenção: a soma das cobranças diverge do total. Confira o Financeiro.';
        } else mensagemContrato.textContent += ` ${esperado} cobrança(s) confirmada(s) no Financeiro.`;
      }
    } else if (dados.status === 'ATIVO' && !financeiro.temFinanceiro) {
      mensagemContrato.textContent += ' Contrato por permuta: sem contas a receber monetárias.';
    } else if (dados.status === 'ATIVO') {
      mensagemContrato.textContent += ' Confira os recebíveis; contratos antigos podem depender de conciliação.';
    } else {
      mensagemContrato.textContent += ' Nenhuma nova cobrança gerada para este status.';
    }

  } catch (erro) {
    console.error('Erro ao salvar contrato:', erro);

    mensagemContrato.style.color = '#a44f69';
    mensagemContrato.textContent =
      erro.message || 'Erro ao salvar contrato.';
  } finally {
    salvandoContrato = false;
    btnSalvarContrato.disabled = false;
  }
}


if (btnSalvarContrato) {
  btnSalvarContrato.addEventListener('click', salvarContrato);
}


const campoAssinanteEmpresa = document.getElementById('assinanteEmpresaContrato');
if (campoAssinanteEmpresa) {
  campoAssinanteEmpresa.addEventListener('input', () => {
    assinanteEmpresaPersonalizado = true;
    if (empresaAtualParaAssinatura) atualizarAssinaturaEmpresa(empresaAtualParaAssinatura);
  });
}

const campoResponsavelCliente = document.getElementById('responsavelClienteContrato');
if (campoResponsavelCliente) {
  campoResponsavelCliente.addEventListener('input', () => {
    if (clienteAtualParaAssinatura) atualizarAssinaturaCliente(clienteAtualParaAssinatura);
  });
}

const camposQueAlteramContrato = [
  'empresaId',
  'clienteId',
  'dataInicio',
  'duracaoMeses',
  'dataTermino',
  'veiculoExecutor',
  'statusContratoEdicao',
  'removerAudioContrato',
  'insercoesTercaQuinta',
  'insercoesSabadoDomingo',
  'valorMensal',
  'valorUnitarioInsercao',
  'insercoesMensais',
  'valorVista',
  'condicaoPagamento',
  'dataVencimentoEntrada',
  'textoAudioCliente',
  'arquivoAudioCliente',
  'observacoes',
  'dataAssinatura',
  'responsavelEmpresaContrato',
  'assinanteEmpresaContrato',
  'responsavelClienteContrato',
  'formaPagamento',
  'diaVencimento',
  'quantidadeParcelas',
  'valorTotalContrato',
  'modalidadeContrato',
  'valorFinanceiroContrato',
  'valorPermuta',
  'descricaoPermuta',
  'valorEntrada',
  'dataPrimeiroVencimento',
  'statusAssinatura',
  'pdfUrl',
  'canceladoEm',
  'motivoCancelamento'];

for (const id of camposQueAlteramContrato) {
  const campo = document.getElementById(id);

  if (campo) {
    campo.addEventListener('change', marcarContratoComoAlterado);
    campo.addEventListener('input', marcarContratoComoAlterado);
  }
}


document.addEventListener(
  'input',
  event => {
    if (
      event.target.matches(
        '#horariosSabadoDomingo input[type="time"], #horariosTercaQuinta input[type="time"]'
      )
    ) {
      marcarContratoComoAlterado();
    }
  }
);


window.addEventListener(
  'beforeunload',
  event => {
    if (!contratoPossuiAlteracoes) return;

    event.preventDefault();
    event.returnValue = '';
  }
);


document.addEventListener(
  'click',
  event => {
    const link = event.target.closest('a[href]');

    if (!link || !contratoPossuiAlteracoes) return;

    const href = link.getAttribute('href');

    if (!href || href === '#' || href.startsWith('javascript:')) {
      return;
    }

    const podeSair = window.confirm(
      'Existem alterações não salvas neste contrato. Deseja sair sem salvar?'
    );

    if (!podeSair) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true
);


function escaparHtml(
  valor
) {

  return String(
    valor ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    );
}


function valorTexto(
  id
) {

  const elemento =
    document.getElementById(
      id
    );

  return elemento
    ? elemento.textContent.trim()
    : '';
}


function valorCampo(
  id
) {

  const elemento =
    document.getElementById(
      id
    );

  return elemento
    ? elemento.value.trim()
    : '';
}


function formatarDataDocumento(
  valor
) {

  if (!valor) {
    return '';
  }

  const partes =
    valor.split('-');

  if (
    partes.length !== 3
  ) {
    return valor;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}


function coletarHorarios(
  seletor
) {

  return Array
    .from(
      document.querySelectorAll(
        seletor
      )
    )
    .map(
      campo => campo.value
    )
    .filter(Boolean);
}


function montarLinhasHorarios(
  horarios,
  colunas
) {

  if (!horarios.length) {
    return '';
  }

  const linhas = [];

  for (
    let i = 0;
    i < horarios.length;
    i += colunas
  ) {

    const parte =
      horarios.slice(
        i,
        i + colunas
      );

    linhas.push(
      `<tr>${
        parte
          .map(
            hora =>
              `<td style="border:1px solid #222;padding:3px 4px;text-align:center;font-size:11px;line-height:1.1;">${escaparHtml(hora)}</td>`
          )
          .join('')
      }${
        parte.length < colunas
          ? '<td style="border:1px solid #222;padding:3px 4px;"></td>'.repeat(colunas - parte.length)
          : ''
      }</tr>`
    );
  }

  return linhas.join('');
}


// Mostra somente os valores correspondentes à modalidade escolhida.
function valoresContratoParaImpressao() {
  const modalidade = valorCampo('modalidadeContrato');
  const modo = tipoPagamentoSelecionado;
  const mensal = valorCampo('valorMensal') || '—';
  const total = valorCampo('valorTotalContrato') || '—';
  const campos = modalidade === 'PERMUTA'
    ? [['Valor mensal (permuta)', mensal], ['Valor total (permuta)', total]]
    : ['VISTA_DESCONTO','PARCELADO_DESCONTO'].includes(modo)
      ? [['Valor mensal', mensal], ['Valor mensal com desconto', document.getElementById('valorMensalComDesconto')?.textContent || '—'],
         ['Valor total', total], ['Valor total com desconto', document.getElementById('valorTotalComDescontoResumo')?.textContent || '—']]
      : [['Valor mensal', mensal], ['Valor total', total]];
  if (modalidade === 'MISTO') {
    campos.push(['Percentual em permuta', `${lerPercentualPermuta() ?? '—'}%`]);
    campos.push(['Valor da permuta', valorCampo('valorPermuta') || '—']);
    campos.push(['Valor em dinheiro', valorCampo('valorFinanceiroContrato') || '—']);
  }
  return campos.map(([rotulo,valor]) => `<strong>${escaparHtml(rotulo)}:</strong> ${escaparHtml(valor)}<br>`).join('');
}

function montarCondicoesFinanceirasExportacao() {
  const campos = [
    ['Data da assinatura', formatarDataDocumento(valorCampo('dataAssinatura'))],
    ['Responsável pela empresa', valorCampo('responsavelEmpresaContrato')],
    ['Responsável pelo cliente', valorCampo('responsavelClienteContrato')],
    ['Modalidade contratual', tipoPagamentoSelecionado === 'MENSAL' ? 'Contrato Mensal (sem desconto)' : tipoPagamentoSelecionado === 'PARCELADO_DESCONTO' ? 'Parcelado com desconto' : valorCampo('modalidadeContrato') === 'MISTO' ? 'Permuta + dinheiro' : valorCampo('modalidadeContrato') === 'PERMUTA' ? 'Somente permuta' : (valorCampo('condicaoPagamento') === 'AVISTA' && Number(valorCampo('percentualDescontoVista').replace(',','.')) > 0 ? 'À vista com desconto' : 'À vista')],
    ['Desconto à vista (%)', tipoPagamentoSelecionado === 'VISTA_DESCONTO' ? `${valorCampo('percentualDescontoVista')}%` : ''],
    ['Desconto no parcelamento (%)', tipoPagamentoSelecionado === 'PARCELADO_DESCONTO' ? `${valorCampo('percentualDescontoVista')}%` : ''],
    ['Percentual em permuta', valorCampo('modalidadeContrato') === 'MISTO' ? `${lerPercentualPermuta() ?? '—'}%` : ''],
    ['Valor em permuta', valorCampo('modalidadeContrato') !== 'FINANCEIRO' ? valorCampo('valorPermuta') : ''],
    ['Descrição da permuta', valorCampo('modalidadeContrato') !== 'FINANCEIRO' ? valorCampo('descricaoPermuta') : ''],
    ['Valor financeiro', valorCampo('modalidadeContrato') !== 'PERMUTA' ? valorCampo('valorFinanceiroContrato') : ''],
    ['Total a receber', valorCampo('modalidadeContrato') === 'PERMUTA' ? 'R$ 0,00' : (['VISTA_DESCONTO','PARCELADO_DESCONTO'].includes(tipoPagamentoSelecionado) || valorCampo('condicaoPagamento') === 'AVISTA' ? valorCampo('valorVista') : valorCampo('valorFinanceiroContrato'))],
    ['Condição de cobrança', valorCampo('modalidadeContrato') === 'PERMUTA' ? 'Sem cobrança monetária' : tipoPagamentoSelecionado === 'MENSAL' ? 'Mensal sem desconto' : tipoPagamentoSelecionado === 'PARCELADO_DESCONTO' ? 'Parcelado com desconto' : valorCampo('condicaoPagamento') === 'AVISTA' ? (tipoPagamentoSelecionado === 'VISTA_DESCONTO' ? 'À vista com desconto' : 'À vista') : 'Parcelado'],
    ['Forma de pagamento', valorCampo('formaPagamento')],
    ['Dia do vencimento', valorCampo('diaVencimento')],
    ['Parcelas', valorCampo('quantidadeParcelas')],
    ['Valor total', valorCampo('valorTotalContrato')],
    ['Entrada', valorCampo('modalidadeContrato') === 'PERMUTA' || valorCampo('condicaoPagamento') === 'AVISTA' ? '0,00' : valorCampo('valorEntrada')],
    ['Vencimento da entrada', formatarDataDocumento(valorCampo('dataVencimentoEntrada'))],
    ['Primeiro vencimento', formatarDataDocumento(valorCampo('dataPrimeiroVencimento'))],
    ['Status da assinatura', valorCampo('statusAssinatura')],
    ['PDF assinado (URL)', valorCampo('pdfUrl')],
    ['Cancelado em', valorCampo('canceladoEm')],
    ['Motivo do cancelamento', valorCampo('motivoCancelamento')]
  ].filter(([, valor]) => String(valor ?? '').trim() && valor !== '-');
  const observacoes = valorCampo('observacoes');
  if (!campos.length && !observacoes) return '';
  const colunas = [campos.filter((_, i) => i % 2 === 0), campos.filter((_, i) => i % 2 !== 0)];
  const colunaHtml = lista => lista.map(([nome, valor]) =>
    `<div style="margin:0 0 2px;overflow-wrap:anywhere;"><strong>${escaparHtml(nome)}:</strong> ${escaparHtml(valor)}</div>`
  ).join('');
  return `
    <tr class="linha-complementares">
      <td colspan="2" style="border:1px solid #222;padding:7px 9px;font-size:10px;line-height:1.2;">
        <div style="text-align:center;font-size:12px;font-weight:800;margin-bottom:5px;">Condições contratuais e financeiras</div>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;">
          <tr>
            <td style="width:50%;padding:2px 6px;vertical-align:top;font-size:10px;">${colunaHtml(colunas[0])}</td>
            <td style="width:50%;padding:2px 6px;vertical-align:top;font-size:10px;">${colunaHtml(colunas[1])}</td>
          </tr>
        </table>
        ${observacoes ? `<div style="margin-top:5px;white-space:pre-wrap;overflow-wrap:anywhere;"><strong>Observações adicionais:</strong> ${escaparHtml(observacoes)}</div>` : ''}
      </td>
    </tr>`;
}

function montarHtmlContrato(incluirCondicoes = false) {

  const textoAudio =
    valorCampo('textoAudioCliente') || '';

  /*
   * O texto do áudio pode ser grande. Diminuímos apenas essa
   * parte progressivamente para preservar o restante do contrato.
   */
  const tamanhoFonteAudio =
    textoAudio.length > 2200
      ? 6
      : textoAudio.length > 1500
        ? 7
        : textoAudio.length > 900
          ? 8
          : textoAudio.length > 500
            ? 10
            : 12;

  const logo =
    document.getElementById(
      'logoEmpresaContrato'
    );

  const logoHtml =
    logo?.src
      ? `<img src="${escaparHtml(logo.src)}" style="max-width:100%;max-height:78px;object-fit:contain;">`
      : '';


  const horariosFimSemana =
    coletarHorarios(
      '#horariosSabadoDomingo input[type="time"]'
    );

  const horariosSemana =
    coletarHorarios(
      '#horariosTercaQuinta input[type="time"]'
    );


  const quantidadeTercaQuinta =
    valorCampo(
      'insercoesTercaQuinta'
    ) || '0';

  const quantidadeSabadoDomingo =
    valorCampo(
      'insercoesSabadoDomingo'
    ) || '0';


  return `
  <div class="contrato-exportacao">
    <table style="width:100%;border-collapse:collapse;border:1px solid #222;">
      <tr>
        <td style="width:42%;padding:7px 9px;border-top:1px solid #222;border-left:1px solid #222;border-bottom:1px solid #222;border-right:none;text-align:center;vertical-align:middle;">
          ${logoHtml}
        </td>

        <td style="width:58%;padding:7px 9px;border-top:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;border-left:none;text-align:right;vertical-align:middle;">
          <div style="font-size:15px;font-weight:800;margin-bottom:1px;line-height:1.05;">
            AUTORIZAÇÃO DE MÍDIA E SERVIÇOS
          </div>
          <div style="font-size:9px;font-weight:700;margin-bottom:3px;">
            Contrato nº ${escaparHtml(numeroContratoSalvo || 'NÃO SALVO')}
          </div>

          <div style="font-size:10px;line-height:1.15;">
            ${escaparHtml(valorTexto('razaoSocialEmpresa'))} - CNPJ: ${escaparHtml(valorTexto('cnpjEmpresa'))}<br>
            ${escaparHtml(valorTexto('enderecoEmpresa'))}<br>
            Telefones ${escaparHtml(valorTexto('telefoneEmpresa'))} / ${escaparHtml(valorTexto('celularEmpresa'))} - ${escaparHtml(valorTexto('cidadeUfEmpresa'))}<br>
            E-mail: ${escaparHtml(valorTexto('emailEmpresa'))}
          </div>
        </td>
      </tr>

      <tr>
        <td style="width:48%;padding:6px 8px;border:1px solid #222;vertical-align:top;font-size:10px;line-height:1.18;">
          <strong>Razão Social:</strong> ${escaparHtml(valorTexto('clienteRazaoSocial'))}<br>
          <strong>CNPJ:</strong> ${escaparHtml(valorTexto('clienteCnpj'))}<br>
          <strong>Fantasia:</strong> ${escaparHtml(valorTexto('clienteFantasia'))}<br>
          <strong>Endereço:</strong> ${escaparHtml(valorTexto('clienteEndereco'))}<br>
          <strong>Telefone:</strong> ${escaparHtml(valorTexto('clienteTelefone'))}<br>
          <strong>Contato:</strong> ${escaparHtml(valorTexto('clienteContato'))}<br>
          <strong>E-mail:</strong> ${escaparHtml(valorTexto('clienteEmail'))}
        </td>

        <td style="width:52%;padding:6px 8px;border:1px solid #222;vertical-align:top;font-size:10px;line-height:1.18;">
          <strong>Veículo Executor:</strong> ${escaparHtml(valorCampo('veiculoExecutor'))}<br><br>
          <strong>Início:</strong> ${escaparHtml(formatarDataDocumento(valorCampo('dataInicio')))}
          &nbsp;&nbsp;&nbsp;
          <strong>Término:</strong> ${escaparHtml(formatarDataDocumento(valorCampo('dataTermino')))}<br>
          <strong>Número de inserções:</strong>
          ${escaparHtml(quantidadeTercaQuinta)}x às terças e quintas e
          ${escaparHtml(quantidadeSabadoDomingo)}x aos sábados e domingos.<br>
          ${valorCampo('valorUnitarioInsercao') ? `<strong>Valor por inserção:</strong> ${escaparHtml(valorCampo('valorUnitarioInsercao'))}<br>` : ''}
          ${valorCampo('insercoesMensais') && valorCampo('valorUnitarioInsercao') ? `<strong>Inserções mensais:</strong> ${escaparHtml(valorCampo('insercoesMensais'))}<br>` : ''}
          ${valoresContratoParaImpressao()}
        </td>
      </tr>

      <tr>
        <td colspan="2" style="padding:6px 8px;border:1px solid #222;">
          <div style="text-align:center;font-size:12px;font-weight:800;">Horários das Inserções:</div>

          ${
            horariosFimSemana.length
              ? `
                <div style="text-align:center;font-size:11px;font-weight:800;margin:2px 0;">Sábados e Domingos</div>
                <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
                  ${montarLinhasHorarios(horariosFimSemana, 4)}
                </table>
              `
              : ''
          }

          ${
            horariosSemana.length
              ? `
                <div style="text-align:center;font-size:11px;font-weight:800;margin:2px 0;">Terças e Quintas</div>
                <table style="width:100%;border-collapse:collapse;">
                  ${montarLinhasHorarios(horariosSemana, 6)}
                </table>
              `
              : ''
          }
        </td>
      </tr>

      ${
        valorCampo('textoAudioCliente')
          ? `
      <tr class="contrato-linha-audio-texto" style="--pdf-audio-tamanho:${tamanhoFonteAudio}px;">
        <td colspan="2" style="padding:5px 8px;border:1px solid #222;font-size:${tamanhoFonteAudio}px;line-height:1.08;">
          <div style="font-size:10px;font-weight:800;margin-bottom:2px;">
            Texto do áudio enviado ao cliente:
          </div>
          <div style="white-space:pre-wrap;">
            ${escaparHtml(textoAudio)}
          </div>
        </td>
      </tr>
            `
          : ''
      }

      ${
        audioContratoNome
          ? `
      <tr>
        <td colspan="2" style="padding:4px 8px;border:1px solid #222;font-size:9px;line-height:1.08;">
          <strong>Arquivo de áudio:</strong> ${escaparHtml(audioContratoNome)}
        </td>
      </tr>
            `
          : ''
      }

      <tr>
        <td colspan="2" style="padding:5px 8px;border:1px solid #222;font-size:9px;line-height:1.12;">
          <div style="text-align:center;font-size:11px;font-weight:800;text-decoration:underline;margin-bottom:3px;">
            OBS:
          </div>

          <ul style="margin:0;padding-left:16px;">
            <li>Terças e quintas das 13:30h às 21h na praça Wilson Jofre.</li>
            <li>Sábados das 8h às 12h em frente à Prefeitura.</li>
            <li>Domingos das 8h às 12h na praça Wilson Jofre.</li>
            <li>
              A não publicação por motivo de força maior, não implicará em inadimplência contratual por parte da Destac Propagandas que comunicará por escrito, cessando os pagamentos subsequentes desde o momento em que deixar de ser veiculado o apoio contratado.
            </li>
          </ul>
        </td>
      </tr>

      ${incluirCondicoes ? montarCondicoesFinanceirasExportacao() : ''}

      <tr>
        <td colspan="2" style="height:92px;padding:8px 12px;border:1px solid #222;vertical-align:top;">
          <div style="text-align:right;font-size:10px;margin-bottom:38px;">
            ${escaparHtml(valorTexto('dataAssinaturaContrato'))}
          </div>

          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50%;text-align:center;vertical-align:bottom;">
                <div>${escaparHtml(valorTexto('assinaturaResponsavelEmpresa'))}</div>
                <div style="font-weight:800;">${escaparHtml(valorTexto('assinaturaNomeEmpresa'))}</div>
              </td>

              <td style="width:50%;text-align:center;vertical-align:bottom;">
                <div style="width:65%;margin:0 auto 6px;border-top:1px solid #222;"></div>
                <div>${escaparHtml(valorTexto('assinaturaResponsavelCliente'))}</div>
                <div style="font-weight:800;">${escaparHtml(valorTexto('assinaturaCliente'))}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;
}


function validarContratoParaGerar() {

  const obrigatorios = [
    ['empresaId', 'Empresa'],
    ['clienteId', 'Cliente'],
    ['veiculoExecutor', 'Veículo Executor'],
    ['statusContratoEdicao', 'Status do contrato'],
    ['dataInicio', 'Início'],
    ['dataTermino', 'Término'],
    ['insercoesTercaQuinta', 'Inserções de terça e quinta'],
    ['insercoesSabadoDomingo', 'Inserções de sábado e domingo'],
    ['valorMensal', 'Valor mensal']
  ];


  const faltando = [];

  for (
    const [
      id,
      nome
    ] of obrigatorios
  ) {

    const campo =
      document.getElementById(
        id
      );

    if (
      !campo ||
      !String(
        campo.value ?? ''
      ).trim()
    ) {
      faltando.push(
        nome
      );
    }
  }


  if (
    faltando.length
  ) {

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      `Preencha antes de gerar: ${faltando.join(', ')}.`;

    return false;
  }


  return true;
}



function validarContratoSalvoParaExportar() {
  if (!contratoSalvoId || !numeroContratoSalvo) {
    mensagemContrato.style.color = '#a44f69';
    mensagemContrato.textContent =
      'Salve o contrato antes de gerar Word ou PDF.';
    return false;
  }

  if (contratoPossuiAlteracoes) {
    mensagemContrato.style.color = '#a44f69';
    mensagemContrato.textContent =
      'Existem alterações não salvas. Salve novamente antes de gerar o documento.';
    return false;
  }

  return true;
}


function nomeArquivoContrato(
  extensao
) {

  const numero =
    String(
      numeroContratoSalvo ||
      'SEM_NUMERO'
    )
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '_'
      )
      .replace(
        /^_+|_+$/g,
        ''
      );


  const cliente =
    valorTexto(
      'clienteFantasia'
    ) ||
    valorTexto(
      'clienteRazaoSocial'
    ) ||
    'Cliente';


  const clienteSeguro =
    cliente
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '_'
      )
      .replace(
        /^_+|_+$/g,
        ''
      );


  return `${numero}_${clienteSeguro}.${extensao}`;
}


async function gerarWord() {

  if (
    !validarContratoParaGerar() ||
    !validarContratoSalvoParaExportar()
  ) {
    return;
  }

  if (!window.DestacOpcoesImpressao) {
    mensagemContrato.textContent = 'Opções de impressão indisponíveis. Atualize a página.';
    return;
  }
  const incluirCondicoes = await window.DestacOpcoesImpressao.perguntar();
  if (incluirCondicoes === null) return;

  const conteudo =
    montarHtmlContrato(incluirCondicoes);


  const documentoWord = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Contrato</title>
        <style>
          @page {
            size: A4;
            margin: 5mm;
          }

          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #000000;
            font-size: 8pt;
            line-height: 1.05;
          }

          .contrato-exportacao {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .contrato-exportacao table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: avoid !important;
          }

          .contrato-exportacao td {
            padding-top: 2pt !important;
            padding-bottom: 2pt !important;
            line-height: 1.05 !important;
          }

          .contrato-exportacao li {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
          }
        </style>
      </head>

      <body>
        ${conteudo}
      </body>
    </html>
  `;


  const blob =
    new Blob(
      [
        '\ufeff',
        documentoWord
      ],
      {
        type:
          'application/msword;charset=utf-8'
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      'a'
    );

  link.href =
    url;

  link.download =
    nomeArquivoContrato(
      'doc'
    );

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );


  mensagemContrato.style.color =
    '#4f7a57';

  mensagemContrato.textContent =
    'Contrato em Word gerado com sucesso.';
}


async function gerarPdf() {

  if (
    !validarContratoParaGerar() ||
    !validarContratoSalvoParaExportar()
  ) {
    return;
  }


  if (
    typeof html2pdf === 'undefined'
  ) {

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Não foi possível carregar o gerador de PDF. Atualize a página e tente novamente.';

    return;
  }


  if (!window.DestacOpcoesImpressao) {
    mensagemContrato.textContent = 'Opções de impressão indisponíveis. Atualize a página.';
    return;
  }
  const incluirCondicoes = await window.DestacOpcoesImpressao.perguntar();
  if (incluirCondicoes === null) return;

  const camada =
    document.createElement(
      'div'
    );

  camada.id =
    'renderPdfTemporario';

  /*
   * A4 em retrato: 210 x 297 mm, com margens de 5 mm.
   * O pequeno respiro interno evita pagina em branco por arredondamento
   * entre pixels do html2canvas e milimetros do jsPDF.
   */
  camada.style.width = '198mm';
  camada.style.position = 'absolute';
  camada.style.left = '0';
  camada.style.top = `${window.scrollY + document.documentElement.scrollHeight + 50}px`;
  camada.style.background = '#ffffff';
  camada.style.color = '#000000';
  camada.style.zIndex = '-1';
  camada.style.pointerEvents = 'none';

  camada.innerHTML = `
    <style>
      /* Estilos SOMENTE do PDF; nao alteram a tela de cadastro nem o Word. */
      #paginaPdfUnica, #paginaPdfUnica * {
        box-sizing: border-box;
      }
      #paginaPdfUnica .contrato-exportacao {
        width: 198mm !important;
        max-width: 198mm !important;
        margin: 0 !important;
        padding: 0 !important;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 12px !important;
        color: #000 !important;
      }
      #paginaPdfUnica .contrato-exportacao > table {
        width: 100% !important;
        table-layout: fixed;
        border-collapse: collapse !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr > td {
        font-size: 12px !important;
        line-height: 1.34 !important;
        padding: 9px 12px !important;
        overflow-wrap: break-word;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:not(:last-child) > td {
        vertical-align: middle !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:first-child > td:last-child > div:first-child {
        font-size: 16px !important;
        line-height: 1.15 !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:first-child > td:last-child > div:last-child {
        font-size: 11px !important;
        line-height: 1.32 !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:first-child img {
        max-height: 95px !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:nth-child(3) > td > div:first-child {
        font-size: 15px !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:nth-child(3) table td {
        font-size: 12px !important;
        padding: 7px 3px !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr.contrato-linha-audio-texto > td {
        font-size: var(--pdf-audio-tamanho, 12px) !important;
        line-height: 1.19 !important;
        padding: 6px 12px !important;
      }
      #paginaPdfUnica .contrato-linha-audio-texto > td > div:last-child {
        font-size: inherit !important;
        line-height: inherit !important;
        overflow-wrap: anywhere;
      }
      #paginaPdfUnica .contrato-exportacao li {
        font-size: 11.5px !important;
        line-height: 1.34 !important;
        margin: 3px 0 !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:last-child > td {
        vertical-align: middle !important;
        padding: 12px 15px !important;
        font-size: 13px !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:last-child > td > div:first-child {
        font-size: 12px !important;
        margin-bottom: 42px !important;
      }
      #paginaPdfUnica .contrato-exportacao > table > tbody > tr:last-child table td {
        font-size: 13px !important;
        line-height: 1.4 !important;
      }
    </style>
    <div
      id="paginaPdfUnica"
      style="
        width:198mm;
        height:284mm;
        overflow:hidden;
        box-sizing:border-box;
        background:#ffffff;
      "
    >
      <div
        id="conteudoPdfUnico"
        style="
          width:198mm;
          transform-origin:top left;
          background:#ffffff;
        "
      >
        ${montarHtmlContrato(incluirCondicoes)}
      </div>
    </div>
  `;


  document.body.appendChild(
    camada
  );


  const paginaPdf =
    camada.querySelector(
      '#paginaPdfUnica'
    );

  const elemento =
    camada.querySelector(
      '#conteudoPdfUnico'
    );


  if (!paginaPdf || !elemento) {

    camada.remove();

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Não foi possível montar o conteúdo do PDF.';

    return;
  }


  mensagemContrato.style.color =
    '#6e688f';

  mensagemContrato.textContent =
    'Gerando PDF...';


  try {

    await new Promise(
      resolve =>
        requestAnimationFrame(
          () =>
            requestAnimationFrame(
              resolve
            )
        )
    );


    const imagens =
      Array.from(
        elemento.querySelectorAll(
          'img'
        )
      );


    await Promise.all(
      imagens.map(
        imagem =>
          new Promise(
            resolve => {

              if (
                imagem.complete
              ) {
                resolve();
                return;
              }


              const finalizar =
                () => resolve();


              imagem.addEventListener(
                'load',
                finalizar,
                {
                  once:
                    true
                }
              );

              imagem.addEventListener(
                'error',
                finalizar,
                {
                  once:
                    true
                }
              );


              setTimeout(
                finalizar,
                3000
              );
            }
          )
      )
    );


    /*
     * Primeiro distribui o espaço livre entre as LINHAS do contrato.
     * Apenas ampliar o documento com transform:scale() faria a largura
     * passar do limite do A4. As secoes passam a preencher a pagina.
     *
     * Se houver muito texto de audio, mantemos a altura natural e
     * aplicamos reducao uniforme, sem cortar dados e sem pagina extra.
     */
    const larguraDisponivel = paginaPdf.clientWidth;
    const alturaDisponivel = paginaPdf.clientHeight;
    const tabelaPrincipal = elemento.querySelector('.contrato-exportacao > table');

    if (!tabelaPrincipal) {
      throw new Error('Tabela principal do contrato nao encontrada.');
    }

    const linhas = Array.from(tabelaPrincipal.rows);
    const alturaAlvo = alturaDisponivel - 4; // margem de seguranca de 4px

    // Mantém o texto do áudio legível no maior tamanho que couber.
    // O cálculo antigo já começava em 6px para roteiros longos, mesmo
    // quando havia espaço disponível na página A4.
    const linhaTextoAudio = tabelaPrincipal.querySelector('.contrato-linha-audio-texto');
    if (linhaTextoAudio) {
      const definirFonteAudio = tamanho => {
        linhaTextoAudio.style.setProperty('--pdf-audio-tamanho', `${tamanho}px`);
      };
      definirFonteAudio(12);
      if (tabelaPrincipal.getBoundingClientRect().height > alturaAlvo) {
        let menor = 4.5;
        let maior = 12;
        definirFonteAudio(menor);
        if (tabelaPrincipal.getBoundingClientRect().height <= alturaAlvo) {
          // Busca binária para não reduzir a fonte mais do que o necessário.
          for (let tentativa = 0; tentativa < 12; tentativa++) {
            const meio = (menor + maior) / 2;
            definirFonteAudio(meio);
            if (tabelaPrincipal.getBoundingClientRect().height <= alturaAlvo) {
              menor = meio;
            } else {
              maior = meio;
            }
          }
        }
        definirFonteAudio(menor);
      }
    }

    const alturaNatural = tabelaPrincipal.getBoundingClientRect().height;
    const alturasAtualizadas = linhas.map(linha => linha.getBoundingClientRect().height);

    if (alturaNatural < alturaAlvo && linhas.length) {
      const sobra = alturaAlvo - alturaNatural;
      const pesos = linhas.map((linha, indice) => {
        if (indice === 0) return 1.0;             // logo e cabecalho
        if (indice === 1) return 1.15;            // dados do cliente/contrato
        if (indice === 2) return 1.55;            // horarios
        if (indice === linhas.length - 1) return 1.70; // assinaturas
        if (linha.textContent.includes('OBS:')) return 1.0;
        return 0.35;                             // audio e outros detalhes
      });
      const somaPesos = pesos.reduce((total, peso) => total + peso, 0);

      linhas.forEach((linha, indice) => {
        linha.style.height = `${alturasAtualizadas[indice] + sobra * pesos[indice] / somaPesos}px`;
      });
      tabelaPrincipal.style.height = `${alturaAlvo}px`;
    }

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const larguraConteudo = Math.max(
      elemento.scrollWidth,
      elemento.offsetWidth,
      tabelaPrincipal.scrollWidth
    );
    const alturaConteudo = Math.max(
      elemento.scrollHeight,
      elemento.offsetHeight,
      tabelaPrincipal.getBoundingClientRect().height
    );

    const escalaPagina = Math.min(
      1,
      (larguraDisponivel - 2) / Math.max(larguraConteudo, 1),
      (alturaDisponivel - 2) / Math.max(alturaConteudo, 1)
    );
    elemento.style.transform = `scale(${escalaPagina})`;

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));


    await html2pdf()
      .set({
        margin:
          [5, 5, 5, 5],

        filename:
          nomeArquivoContrato(
            'pdf'
          ),

        image: {
          type:
            'jpeg',

          quality:
            0.98
        },

        html2canvas: {
          scale:
            2,

          useCORS:
            true,

          allowTaint:
            true,

          logging:
            false,

          backgroundColor:
            '#ffffff',

          scrollX:
            0,

          scrollY:
            0
        },

        jsPDF: {
          unit:
            'mm',

          format:
            'a4',

          orientation:
            'portrait'
        },

      })
      .from(
        paginaPdf
      )
      .save();


    mensagemContrato.style.color =
      '#4f7a57';

    mensagemContrato.textContent =
      'Contrato em PDF gerado com sucesso.';

  } catch (erro) {

    console.error(
      'Erro ao gerar PDF:',
      erro
    );

    mensagemContrato.style.color =
      '#a44f69';

    mensagemContrato.textContent =
      'Erro ao gerar o PDF. Verifique o console do navegador.';

  } finally {

    camada.remove();
  }
}


const btnGerarWord =
  document.getElementById(
    'btnGerarWord'
  );

const btnGerarPdf =
  document.getElementById(
    'btnGerarPdf'
  );


if (btnGerarWord) {

  btnGerarWord.addEventListener(
    'click',
    gerarWord
  );
}


if (btnGerarPdf) {

  btnGerarPdf.addEventListener(
    'click',
    gerarPdf
  );
}


async function iniciarPagina() {

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

    return;
  }


  mostrarUsuarioConectado(
    perfil.nome,
    perfil.perfil
  );


  const podeGerenciarUsuarios =
    perfil.perfil === 'SUPER_USUARIO' ||
    perfil.perfil === 'ADMINISTRADOR';


  if (menuUsuarios) {

    menuUsuarios.style.display =
      podeGerenciarUsuarios
        ? 'block'
        : 'none';
  }


  await carregarEmpresas();
  const editarId = new URLSearchParams(window.location.search).get('id');
  if (editarId && /^\d+$/.test(editarId)) {
    modoEdicaoInicializando = true;
    try {
      const { data: contrato, error: erroConsulta } = await supabaseClient
        .from('contratos').select('*').eq('id', Number(editarId)).single();
      if (erroConsulta || !contrato) throw new Error(erroConsulta?.message || 'Contrato não encontrado.');

      // Empresas inativas também podem ter contratos a serem editados.
      // E a lista do Supabase pode ser paginada: garantir opção para registro existente.
      const selecionarCadastro = async (tabela, seletor, id) => {
        let opcao = [...seletor.options].find(o => o.value === String(id));
        if (!opcao) {
          const { data, error } = await supabaseClient.from(tabela)
            .select('id, razao_social, nome_fantasia').eq('id', id).single();
          if (error || !data) throw new Error(`Não foi possível carregar ${tabela} do contrato.`);
          opcao = document.createElement('option');
          opcao.value = String(data.id);
          opcao.textContent = data.nome_fantasia
            ? `${data.nome_fantasia} — ${data.razao_social}` : data.razao_social;
          seletor.appendChild(opcao);
        }
        seletor.disabled = false;
        seletor.value = String(id);
      };

      await selecionarCadastro('empresas', empresaId, contrato.empresa_id);
      await carregarEmpresaSelecionada(contrato.empresa_id);
      await carregarClientesGlobais();
      await selecionarCadastro('clientes', clienteId, contrato.cliente_id);
      await carregarClienteSelecionado(contrato.cliente_id);

      const definir = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.value = valor ?? '';
      };
      for (const [id, campo] of Object.entries({
        veiculoExecutor:'veiculo_executor',statusContratoEdicao:'status',
        dataInicio:'data_inicio',dataTermino:'data_termino',
        insercoesTercaQuinta:'insercoes_terca_quinta',
        insercoesSabadoDomingo:'insercoes_sabado_domingo',
        valorMensal:'valor_mensal',valorVista:'valor_vista',
        valorUnitarioInsercao:'valor_unitario_insercao',insercoesMensais:'insercoes_mensais',
        textoAudioCliente:'texto_audio_cliente',observacoes:'observacoes',
        dataAssinatura:'data_assinatura',responsavelEmpresaContrato:'responsavel_empresa',
        responsavelClienteContrato:'responsavel_cliente',formaPagamento:'forma_pagamento',
        diaVencimento:'dia_vencimento',quantidadeParcelas:'quantidade_parcelas',
        condicaoPagamento:'condicao_pagamento',dataVencimentoEntrada:'data_vencimento_entrada',
        valorTotalContrato:'valor_total_contrato',valorEntrada:'valor_entrada',
        modalidadeContrato:'modalidade_contrato',valorFinanceiroContrato:'valor_financeiro',
        percentualDescontoVista:'percentual_desconto_vista',
        valorPermuta:'valor_permuta',descricaoPermuta:'descricao_permuta',
        dataPrimeiroVencimento:'data_primeiro_vencimento',statusAssinatura:'status_assinatura',
        pdfUrl:'pdf_url',motivoCancelamento:'motivo_cancelamento'
      })) definir(id, contrato[campo]);
      // Contratos antigos não possuem assinante_empresa: a DESTAC usa Celso,
      // independentemente do antigo responsável administrativo.
      assinanteEmpresaPersonalizado = Boolean(contrato.assinante_empresa?.trim());
      definir('assinanteEmpresaContrato',
        contrato.assinante_empresa?.trim() || nomeAssinantePadrao(empresaAtualParaAssinatura));
      if (empresaAtualParaAssinatura) atualizarAssinaturaEmpresa(empresaAtualParaAssinatura);
      if (!contrato.status) definir('statusContratoEdicao', 'PENDENTE');
      if (!contrato.condicao_pagamento) definir('condicaoPagamento', 'PARCELADO');
      if (!contrato.modalidade_contrato) definir('modalidadeContrato', 'FINANCEIRO');
      if (contrato.valor_financeiro == null) definir('valorFinanceiroContrato', contrato.valor_total_contrato || '');
      tipoPagamentoSelecionado = contrato.modalidade_contrato === 'PERMUTA' ? 'PERMUTA' :
        contrato.modalidade_contrato === 'MISTO' ? 'MISTO' :
        contrato.condicao_pagamento === 'PARCELADO' ?
          Number(contrato.percentual_desconto_parcelado || 0) > 0 ? 'PARCELADO_DESCONTO' :
          contrato.modalidade_contrato === 'FINANCEIRO' &&
            Number(contrato.valor_entrada || 0) === 0 &&
            Number(contrato.quantidade_parcelas) > 0 &&
            Number(contrato.quantidade_parcelas) === mesesDasDatas(contrato.data_inicio, contrato.data_termino)
            ? 'MENSAL' : 'LEGADO_PARCELADO' :
        Number(contrato.percentual_desconto_vista || 0) > 0 ||
          (Number(contrato.valor_vista || 0)>0 && Number(contrato.valor_vista) < Number(contrato.valor_financeiro || contrato.valor_total_contrato))
          ? 'VISTA_DESCONTO' : 'VISTA';
      percentualPermutaOriginal = contrato.percentual_permuta ?? null;
      if (tipoPagamentoSelecionado === 'MISTO') {
        const percentualArmazenado = Number(contrato.percentual_permuta);
        const totalComercial = Number(contrato.valor_total_contrato);
        const percentualEstimado = totalComercial > 0 ? Number(contrato.valor_permuta || 0) * 100 / totalComercial : 0;
        const percentualVisual = contrato.percentual_permuta != null && Number.isFinite(percentualArmazenado)
          ? percentualArmazenado : percentualEstimado;
        definir('percentualPermuta', percentualVisual > 0 && percentualVisual < 100
          ? percentualVisual.toFixed(2).replace('.',',') : '');
      } else definir('percentualPermuta', '');
      if (tipoPagamentoSelecionado === 'PARCELADO_DESCONTO') {
        definir('percentualDescontoVista', contrato.percentual_desconto_parcelado);
      }
      percentualDescontoLegado = contrato.percentual_desconto_vista == null;
      descontoAlteradoManualmente = false;
      composicaoRecalculada = false;
      if (percentualDescontoLegado && contrato.condicao_pagamento === 'AVISTA' &&
          Number(contrato.valor_financeiro) > 0 && Number(contrato.valor_vista) > 0) {
        const estimado = (1 - Number(contrato.valor_vista)/Number(contrato.valor_financeiro))*100;
        definir('percentualDescontoVista', Math.max(0, Math.min(99.99, estimado)).toFixed(2).replace('.',','));
      } else if (contrato.percentual_desconto_vista == null && tipoPagamentoSelecionado !== 'PARCELADO_DESCONTO') {
        definir('percentualDescontoVista', '0');
      }
      const duracaoExistente = mesesDasDatas(contrato.data_inicio, contrato.data_termino);
      definir('duracaoMeses', duracaoExistente ?? '');
      vigenciaLegadaOriginal = duracaoExistente === null
        ? { inicio: contrato.data_inicio, termino: contrato.data_termino }
        : null;
      // Não sobrescrever parcelamentos personalizados ao editar contratos antigos.
      parcelasAlteradasManualmente = duracaoExistente !== null &&
        Number(contrato.quantidade_parcelas) > 0 &&
        Number(contrato.quantidade_parcelas) !== duracaoExistente;
      atualizarVigenciaContrato();

      // Mostrar sempre a moeda em pt-BR para não multiplicar valores no salvamento.
      for (const id of ['valorMensal','valorUnitarioInsercao','valorVista','valorTotalContrato','valorFinanceiroContrato','valorPermuta','valorEntrada']) {
        const campo = document.getElementById(id);
        if (campo && campo.value !== '') {
          campo.value = Number(campo.value).toLocaleString('pt-BR', {
            style: 'currency', currency: 'BRL'
          });
        }
      }
      definir('canceladoEm', contrato.cancelado_em ? contrato.cancelado_em.substring(0,16) : '');
      // Sem preço unitário, preservar o valor mensal legado sem recalcular.
      // Se já existe preço unitário salvo, manter a quantidade mensal registrada.
      insercoesMensaisPersonalizadas = contrato.insercoes_mensais != null;
      if (!insercoesMensaisPersonalizadas) atualizarQuantidadeMensalSugerida();
      recalcularPrecoPorInsercao(false);
      atualizarPreviaFinanceira();
      atualizarResumoInsercoes();
      atualizarCamposHorarios();
      const definirHorarios = (seletor, lista) => {
        const inputs = document.querySelectorAll(seletor);
        let horas = lista;
        if (typeof horas === 'string') {
          try { horas = JSON.parse(horas); } catch (_) { horas = []; }
        }
        (Array.isArray(horas) ? horas : []).forEach((hora, i) => {
          if (inputs[i]) inputs[i].value = typeof hora === 'string' ? hora : (hora?.horario || '');
        });
      };
      definirHorarios('#horariosTercaQuinta input[type="time"]', contrato.horarios_terca_quinta);
      definirHorarios('#horariosSabadoDomingo input[type="time"]', contrato.horarios_sabado_domingo);
      if (clienteAtualParaAssinatura) atualizarAssinaturaCliente(clienteAtualParaAssinatura);

      audioContratoUrl = contrato.audio_url || null;
      audioContratoCaminho = contrato.audio_caminho || null;
      audioContratoNome = contrato.audio_nome || null;
      audioContratoMime = contrato.audio_mime || null;
      atualizarAudioAtualEdicao();
      marcarContratoComoSalvo(contrato);
      document.getElementById('tituloModoContrato').textContent = 'Editar contrato';
      document.getElementById('btnSalvarContrato').textContent = 'Salvar alterações';
      document.getElementById('btnVoltarConsultaEdicao').style.display = 'inline-flex';
      document.getElementById('avisoClienteGlobalEdicao').style.display = 'block';
      mensagemContrato.style.color = '#4f7a57';
      mensagemContrato.textContent = `Contrato ${contrato.numero_contrato} aberto para edição. Todos os campos do contrato estão disponíveis.`;
    } catch (erro) {
      console.error('Erro ao abrir edição:', erro);
      mensagemContrato.style.color = '#a44f69';
      mensagemContrato.textContent = `Não foi possível abrir a edição: ${erro.message}`;
      btnSalvarContrato.disabled = true;
    } finally {
      modoEdicaoInicializando = false;
    }
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


atualizarCamposHorarios();

iniciarPagina();
