const SUPABASE_URL = 'https://kvmayirfbdnexlzqnjvr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const arquivosInput = document.getElementById('arquivos');
const dropZone = document.getElementById('dropZone');
const btnSelecionar = document.getElementById('btnSelecionar');
const btnAnalisar = document.getElementById('btnAnalisar');
const btnImportar = document.getElementById('btnImportar');
const btnLimpar = document.getElementById('btnLimpar');
const btnCorrigirCodigos = document.getElementById('btnCorrigirCodigos');
const resumoCorrecao = document.getElementById('resumoCorrecao');
const listaArquivos = document.getElementById('listaArquivos');
const statusEl = document.getElementById('status');
const barra = document.getElementById('barra');
const tabelaResultados = document.getElementById('tabelaResultados');
const qtdArquivos = document.getElementById('qtdArquivos');
const qtdLidos = document.getElementById('qtdLidos');
const qtdNovos = document.getElementById('qtdNovos');
const qtdExistentes = document.getElementById('qtdExistentes');
const qtdSemCodigo = document.getElementById('qtdSemCodigo');
const qtdErros = document.getElementById('qtdErros');
const nomeUsuario = document.getElementById('nomeUsuario');
const perfilUsuario = document.getElementById('perfilUsuario');
const menuUsuarios = document.getElementById('menuUsuarios');
const btnSair = document.getElementById('btnSair');

let arquivosSelecionados = [];
let registros = [];
let perfilLogado = null;

const COLUNAS_CLIENTE = [
  'codigo_cliente', 'razao_social', 'nome_fantasia', 'tipo_pessoa', 'cpf_cnpj',
  'inscricao_estadual', 'responsavel', 'contato', 'telefone', 'celular_whatsapp',
  'email', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep',
  'observacoes', 'situacao_cadastral', 'data_inicio_atividade', 'natureza_juridica',
  'porte', 'capital_social', 'cnae_principal', 'matriz_filial', 'socios', 'ativo'
];

function nomeAmigavelPerfil(perfil) {
  if (perfil === 'SUPER_USUARIO') return 'Super usuário';
  if (perfil === 'ADMINISTRADOR') return 'Administrador';
  return 'Usuário';
}

async function verificarAcesso() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return false;
  }

  const { data: perfil, error } = await supabaseClient
    .from('perfis_usuario')
    .select('nome, perfil, ativo')
    .eq('user_id', session.user.id)
    .single();

  if (error || !perfil || perfil.ativo !== true) {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
    return false;
  }

  perfilLogado = perfil.perfil;
  nomeUsuario.textContent = perfil.nome || 'Usuário';
  perfilUsuario.textContent = nomeAmigavelPerfil(perfil.perfil);

  if (!['SUPER_USUARIO', 'ADMINISTRADOR'].includes(perfil.perfil)) {
    menuUsuarios.style.display = 'none';
  }

  return true;
}

function normalizarCabecalho(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\\ -]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizarDocumento(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').trim();
}

function limparValor(valor) {
  if (valor === undefined || valor === null) return null;
  const v = String(valor).trim();
  return v === '' ? null : v;
}

function converterAtivo(valor) {
  if (typeof valor === 'boolean') return valor;
  if (valor === undefined || valor === null || String(valor).trim() === '') return true;
  const v = String(valor).trim().toLowerCase();
  return ['true', '1', 'sim', 's', 'ativo', 'atv', 'yes'].includes(v);
}

function converterCapitalSocial(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  if (typeof valor === 'number') return valor;
  const texto = String(valor).trim().replace(/\s/g, '');
  let normalizado = texto;
  if (texto.includes(',') && texto.includes('.')) {
    normalizado = texto.replace(/\./g, '').replace(',', '.');
  } else if (texto.includes(',')) {
    normalizado = texto.replace(',', '.');
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function converterSocios(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;

  if (Array.isArray(valor)) return valor;

  if (typeof valor === 'object') return valor;

  const texto = String(valor).trim();

  try {
    const json = JSON.parse(texto);
    if (Array.isArray(json) || (json && typeof json === 'object')) return json;
  } catch (_) {}

  const itens = texto
    .split(/\s*\|\s*|\r?\n+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const partes = item.split(' - ');
      if (partes.length >= 2) {
        return {
          nome: partes.shift().trim(),
          qualificacao: partes.join(' - ').trim()
        };
      }
      return { nome: item, qualificacao: '' };
    });

  return itens.length ? itens : null;
}

function normalizarTipoPessoa(valor, documento) {
  const v = String(valor || '').trim().toUpperCase();
  if (['PJ', 'JURIDICA', 'PESSOA JURIDICA'].includes(v)) return 'JURIDICA';
  if (['PF', 'FISICA', 'PESSOA FISICA'].includes(v)) return 'FISICA';
  const doc = normalizarDocumento(documento);
  if (doc.length === 14) return 'JURIDICA';
  if (doc.length === 11) return 'FISICA';
  return null;
}

function mapearLinha(linhaOriginal) {
  const linha = {};
  Object.entries(linhaOriginal || {}).forEach(([chave, valor]) => {
    linha[normalizarCabecalho(chave)] = valor;
  });

  const cpfCnpj = limparValor(linha.cpf_cnpj ?? linha.cpfcnpj ?? linha.cnpj ?? linha.cpf);
  const razaoSocial = limparValor(linha.razao_social ?? linha.razaosocial ?? linha.cliente ?? linha.nome);

  return {
    codigo_cliente: limparValor(linha.codigo_cliente),
    razao_social: razaoSocial,
    nome_fantasia: limparValor(linha.nome_fantasia),
    tipo_pessoa: normalizarTipoPessoa(linha.tipo_pessoa, cpfCnpj),
    cpf_cnpj: cpfCnpj,
    inscricao_estadual: limparValor(linha.inscricao_estadual),
    responsavel: limparValor(linha.responsavel),
    contato: limparValor(linha.contato),
    telefone: limparValor(linha.telefone),
    celular_whatsapp: limparValor(linha.celular_whatsapp ?? linha.whatsapp ?? linha.celular),
    email: limparValor(linha.email),
    endereco: limparValor(linha.endereco),
    numero: limparValor(linha.numero),
    complemento: limparValor(linha.complemento),
    bairro: limparValor(linha.bairro),
    cidade: limparValor(linha.cidade),
    estado: limparValor(linha.estado ?? linha.uf)?.toUpperCase() || null,
    cep: limparValor(linha.cep),
    observacoes: limparValor(linha.observacoes),
    situacao_cadastral: limparValor(linha.situacao_cadastral),
    data_inicio_atividade: limparValor(linha.data_inicio_atividade),
    natureza_juridica: limparValor(linha.natureza_juridica),
    porte: limparValor(linha.porte),
    capital_social: converterCapitalSocial(linha.capital_social),
    cnae_principal: limparValor(linha.cnae_principal),
    matriz_filial: limparValor(linha.matriz_filial),
    socios: converterSocios(linha.socios),
    ativo: converterAtivo(linha.ativo)
  };
}

function atualizarListaArquivos() {
  qtdArquivos.textContent = arquivosSelecionados.length;
  if (!arquivosSelecionados.length) {
    listaArquivos.textContent = 'Nenhum arquivo selecionado.';
    btnAnalisar.disabled = true;
    return;
  }

  listaArquivos.textContent = arquivosSelecionados
    .map((arquivo, i) => `${i + 1}. ${arquivo.name}`)
    .join('\n');
  btnAnalisar.disabled = false;
}

function definirArquivos(fileList) {
  const permitidos = /\.(xlsx|xls|csv)$/i;
  arquivosSelecionados = Array.from(fileList || []).filter(a => permitidos.test(a.name));
  registros = [];
  btnImportar.disabled = true;
  barra.style.width = '0%';
  tabelaResultados.innerHTML = '<tr><td colspan="9">Clique em “Analisar arquivos”.</td></tr>';
  zerarResumo(false);
  atualizarListaArquivos();
  statusEl.textContent = arquivosSelecionados.length
    ? `${arquivosSelecionados.length} arquivo(s) selecionado(s). Clique em “Analisar arquivos”.`
    : 'Nenhum arquivo XLSX/XLS/CSV válido foi selecionado.';
}

function zerarResumo(incluirArquivos = true) {
  if (incluirArquivos) qtdArquivos.textContent = '0';
  qtdLidos.textContent = '0';
  qtdNovos.textContent = '0';
  qtdExistentes.textContent = '0';
  qtdSemCodigo.textContent = '0';
  qtdErros.textContent = '0';
}

async function lerArquivo(arquivo) {
  const buffer = await arquivo.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  if (!wb.SheetNames.length) throw new Error('Arquivo sem abas.');

  const nomeAba = wb.SheetNames.find(nome => normalizarCabecalho(nome) === 'importacao_clientes') || wb.SheetNames[0];
  const ws = wb.Sheets[nomeAba];
  const linhas = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  return { nomeAba, linhas };
}

async function carregarBaseClientesExistentes() {
  const porDocumento = new Map();
  const codigos = [];
  const tamanhoPagina = 1000;
  let inicio = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('id,cpf_cnpj,codigo_cliente')
      .range(inicio, inicio + tamanhoPagina - 1);

    if (error) throw error;

    (data || []).forEach(item => {
      const doc = normalizarDocumento(item.cpf_cnpj);
      if (doc) {
        porDocumento.set(doc, {
          id: item.id,
          codigo_cliente: limparValor(item.codigo_cliente)
        });
      }

      const codigo = limparValor(item.codigo_cliente);
      if (codigo) codigos.push(String(codigo));
    });

    if (!data || data.length < tamanhoPagina) break;
    inicio += tamanhoPagina;
  }

  return { porDocumento, codigos };
}

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

function classeStatus(status) {
  if (status === 'NOVO') return 'tag tag-novo';
  if (status === 'JÁ CADASTRADO') return 'tag tag-ja';
  if (status === 'DUPLICADO NOS ARQUIVOS') return 'tag tag-dup';
  if (status === 'IMPORTADO' || status === 'CÓDIGO CORRIGIDO') return 'tag tag-importado';
  if (status === 'SEM CÓDIGO') return 'tag tag-semcodigo';
  if (status === 'ERRO IMPORTAÇÃO') return 'tag tag-erro';
  return 'tag tag-erro';
}

function escapeHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderizarTabela() {
  if (!registros.length) {
    tabelaResultados.innerHTML = '<tr><td colspan="9">Nenhum registro encontrado.</td></tr>';
    return;
  }

  tabelaResultados.innerHTML = registros.map((r, i) => {
    const c = r.cliente || {};
    const cidadeUf = [c.cidade, c.estado].filter(Boolean).join('/');
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.arquivo)}</td>
        <td><strong>${escapeHtml(c.codigo_cliente || '')}</strong></td>
        <td>${escapeHtml(c.cpf_cnpj || '')}</td>
        <td>${escapeHtml(c.razao_social || '')}</td>
        <td>${escapeHtml(c.nome_fantasia || '')}</td>
        <td>${escapeHtml(cidadeUf)}</td>
        <td><span class="${classeStatus(r.status)}">${escapeHtml(r.status)}</span></td>
        <td>${escapeHtml(r.observacao || '')}</td>
      </tr>`;
  }).join('');
}

function atualizarResumo() {
  qtdLidos.textContent = registros.length;
  qtdNovos.textContent = registros.filter(r => r.status === 'NOVO').length;
  qtdExistentes.textContent = registros.filter(r => r.status === 'JÁ CADASTRADO').length;
  qtdSemCodigo.textContent = registros.filter(r => r.status === 'SEM CÓDIGO').length;
  qtdErros.textContent = registros.filter(r => ['ERRO', 'DUPLICADO NOS ARQUIVOS', 'ERRO IMPORTAÇÃO'].includes(r.status)).length;
}

async function analisarArquivos() {
  if (!arquivosSelecionados.length) return;
  if (typeof XLSX === 'undefined') {
    statusEl.textContent = 'Biblioteca XLSX não carregada.';
    return;
  }

  btnAnalisar.disabled = true;
  btnImportar.disabled = true;
  btnSelecionar.disabled = true;
  registros = [];
  renderizarTabela();
  barra.style.width = '0%';

  try {
    statusEl.textContent = 'Carregando clientes e preparando a sequência de códigos...';
    const base = await carregarBaseClientesExistentes();
    const gerarCodigoCliente = criarGeradorCodigoCliente(base.codigos);
    const vistosNosArquivos = new Set();

    for (let i = 0; i < arquivosSelecionados.length; i++) {
      const arquivo = arquivosSelecionados[i];
      statusEl.textContent = `Analisando arquivo ${i + 1} de ${arquivosSelecionados.length}: ${arquivo.name}`;
      barra.style.width = `${Math.round(((i + 1) / arquivosSelecionados.length) * 100)}%`;

      try {
        const { nomeAba, linhas } = await lerArquivo(arquivo);
        if (!linhas.length) {
          registros.push({ arquivo: arquivo.name, cliente: {}, status: 'ERRO', observacao: `A aba ${nomeAba} está vazia.` });
          continue;
        }

        linhas.forEach((linha, indice) => {
          const cliente = mapearLinha(linha);
          const doc = normalizarDocumento(cliente.cpf_cnpj);
          let status = 'NOVO';
          let observacao = '';

          if (!cliente.razao_social) {
            status = 'ERRO';
            observacao = `Linha ${indice + 2}: razão social não informada.`;
          } else if (!doc) {
            status = 'ERRO';
            observacao = `Linha ${indice + 2}: CPF/CNPJ não informado.`;
          } else if (!['JURIDICA', 'FISICA'].includes(cliente.tipo_pessoa)) {
            status = 'ERRO';
            observacao = `Linha ${indice + 2}: tipo de pessoa não identificado.`;
          } else if (vistosNosArquivos.has(doc)) {
            status = 'DUPLICADO NOS ARQUIVOS';
            observacao = 'Este CPF/CNPJ já apareceu em outro registro selecionado.';
          } else if (base.porDocumento.has(doc)) {
            const existente = base.porDocumento.get(doc);

            if (existente.codigo_cliente) {
              cliente.codigo_cliente = existente.codigo_cliente;
              status = 'JÁ CADASTRADO';
              observacao = 'Cliente já cadastrado e já possui código.';
            } else {
              cliente.codigo_cliente = gerarCodigoCliente();
              status = 'SEM CÓDIGO';
              observacao = `Cliente já existe. O código ${cliente.codigo_cliente} será preenchido.`;
            }
          } else {
            cliente.codigo_cliente = gerarCodigoCliente();
            observacao = `Novo cliente receberá o código ${cliente.codigo_cliente}.`;
          }

          if (doc) vistosNosArquivos.add(doc);
          const existente = doc ? base.porDocumento.get(doc) : null;
          registros.push({
            arquivo: arquivo.name,
            cliente,
            clienteExistenteId: existente?.id || null,
            status,
            observacao
          });
        });
      } catch (erroArquivo) {
        registros.push({ arquivo: arquivo.name, cliente: {}, status: 'ERRO', observacao: erroArquivo.message || 'Falha ao ler arquivo.' });
      }

      renderizarTabela();
      atualizarResumo();
    }

    const novos = registros.filter(r => r.status === 'NOVO').length;
    const semCodigo = registros.filter(r => r.status === 'SEM CÓDIGO').length;
    const acionaveis = novos + semCodigo;
    statusEl.textContent = acionaveis
      ? `Análise concluída. ${novos} novo(s) e ${semCodigo} cliente(s) já cadastrado(s) sem código.`
      : 'Análise concluída. Nenhum cliente novo ou sem código para tratar.';
    btnImportar.disabled = acionaveis === 0;
  } catch (erro) {
    console.error(erro);
    statusEl.textContent = `Erro na análise: ${erro.message || erro}`;
  } finally {
    btnAnalisar.disabled = false;
    btnSelecionar.disabled = false;
  }
}

function objetoParaInsert(cliente) {
  const obj = {};
  COLUNAS_CLIENTE.forEach(campo => {
    if (Object.prototype.hasOwnProperty.call(cliente, campo)) {
      const valor = cliente[campo];
      if (valor !== undefined) obj[campo] = valor;
    }
  });
  return obj;
}

async function importarClientes() {
  const novos = registros.filter(r => r.status === 'NOVO');
  const semCodigo = registros.filter(r => r.status === 'SEM CÓDIGO');
  const totalAcoes = novos.length + semCodigo.length;
  if (!totalAcoes) return;

  const confirmar = confirm(
    `Serão tratados ${totalAcoes} cliente(s):\n` +
    `• ${novos.length} cliente(s) novo(s)\n` +
    `• ${semCodigo.length} cliente(s) já cadastrado(s) que receberão código\n\n` +
    'Clientes já cadastrados com código e duplicados serão ignorados.\n\nDeseja continuar?'
  );
  if (!confirmar) return;

  btnImportar.disabled = true;
  btnAnalisar.disabled = true;
  btnSelecionar.disabled = true;
  btnLimpar.disabled = true;

  const tamanhoLote = 30;
  let concluidos = 0;
  let importados = 0;
  let codigosCorrigidos = 0;

  const atualizarProgresso = () => {
    barra.style.width = `${Math.round((concluidos / totalAcoes) * 100)}%`;
    renderizarTabela();
    atualizarResumo();
  };

  try {
    // Primeiro corrige clientes que já existem, mas ficaram sem codigo_cliente.
    for (const item of semCodigo) {
      statusEl.textContent = `Gerando códigos para clientes já cadastrados — ${concluidos + 1}/${totalAcoes}`;

      const { error } = await supabaseClient
        .from('clientes')
        .update({
          codigo_cliente: item.cliente.codigo_cliente,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.clienteExistenteId)
        .is('codigo_cliente', null);

      if (error) {
        item.status = 'ERRO IMPORTAÇÃO';
        item.observacao = `Não foi possível gravar o código ${item.cliente.codigo_cliente}: ${error.message || error}`;
      } else {
        item.status = 'CÓDIGO CORRIGIDO';
        item.observacao = `Código ${item.cliente.codigo_cliente} gravado no cliente existente.`;
        codigosCorrigidos += 1;
      }

      concluidos += 1;
      atualizarProgresso();
    }

    // Depois insere clientes novos em lotes de 30, já com codigo_cliente preenchido.
    for (let inicio = 0; inicio < novos.length; inicio += tamanhoLote) {
      const itensLote = novos.slice(inicio, inicio + tamanhoLote);
      const payload = itensLote.map(item => objetoParaInsert(item.cliente));
      const numeroLote = Math.floor(inicio / tamanhoLote) + 1;
      const totalLotes = Math.ceil(novos.length / tamanhoLote);

      statusEl.textContent = `Importando novos — lote ${numeroLote} de ${totalLotes}`;

      const { error } = await supabaseClient.from('clientes').insert(payload);

      if (!error) {
        itensLote.forEach(item => {
          item.status = 'IMPORTADO';
          item.observacao = `Importado com o código ${item.cliente.codigo_cliente}.`;
        });
        importados += itensLote.length;
      } else {
        // Se uma linha derrubar o lote, tenta uma por uma para identificar a falha.
        for (const item of itensLote) {
          const { error: erroLinha } = await supabaseClient
            .from('clientes')
            .insert(objetoParaInsert(item.cliente));

          if (erroLinha) {
            item.status = 'ERRO IMPORTAÇÃO';
            item.observacao = `Código ${item.cliente.codigo_cliente}: ${erroLinha.message || 'Erro ao importar este cliente.'}`;
          } else {
            item.status = 'IMPORTADO';
            item.observacao = `Importado com o código ${item.cliente.codigo_cliente}.`;
            importados += 1;
          }
        }
      }

      concluidos += itensLote.length;
      atualizarProgresso();
    }

    const falhas = registros.filter(r => r.status === 'ERRO IMPORTAÇÃO').length;
    statusEl.textContent = falhas
      ? `Concluído com ressalvas. ${importados} novo(s), ${codigosCorrigidos} código(s) preenchido(s) e ${falhas} falha(s).`
      : `Concluído. ${importados} cliente(s) novo(s) importado(s) e ${codigosCorrigidos} código(s) preenchido(s).`;
  } catch (erro) {
    console.error(erro);
    statusEl.textContent = `A operação parou após ${concluidos} de ${totalAcoes}. ${erro.message || erro}`;
    btnImportar.disabled = registros.filter(r => ['NOVO', 'SEM CÓDIGO'].includes(r.status)).length === 0;
  } finally {
    btnAnalisar.disabled = false;
    btnSelecionar.disabled = false;
    btnLimpar.disabled = false;
  }
}


async function corrigirCodigosPendentes() {
  btnCorrigirCodigos.disabled = true;
  btnSelecionar.disabled = true;
  btnAnalisar.disabled = true;
  btnImportar.disabled = true;
  btnLimpar.disabled = true;
  barra.style.width = '0%';

  try {
    statusEl.textContent = 'Verificando clientes já cadastrados sem código...';
    resumoCorrecao.textContent = 'Consultando banco...';

    const todos = [];
    const tamanhoPagina = 1000;
    let inicio = 0;

    while (true) {
      const { data, error } = await supabaseClient
        .from('clientes')
        .select('id,codigo_cliente,cpf_cnpj,razao_social,nome_fantasia,cidade,estado')
        .order('id', { ascending: true })
        .range(inicio, inicio + tamanhoPagina - 1);

      if (error) throw error;
      todos.push(...(data || []));
      if (!data || data.length < tamanhoPagina) break;
      inicio += tamanhoPagina;
    }

    const codigosExistentes = todos
      .map(c => c.codigo_cliente)
      .filter(c => c !== null && c !== undefined && String(c).trim() !== '');

    const pendentes = todos.filter(c =>
      c.codigo_cliente === null ||
      c.codigo_cliente === undefined ||
      String(c.codigo_cliente).trim() === ''
    );

    if (!pendentes.length) {
      resumoCorrecao.textContent = '0 cliente(s) sem código.';
      statusEl.textContent = 'Todos os clientes já possuem codigo_cliente.';
      barra.style.width = '100%';
      return;
    }

    const gerarCodigoCliente = criarGeradorCodigoCliente(codigosExistentes);
    const correcoes = pendentes.map(cliente => ({
      cliente,
      novoCodigo: gerarCodigoCliente()
    }));

    const primeiro = correcoes[0].novoCodigo;
    const ultimo = correcoes[correcoes.length - 1].novoCodigo;
    resumoCorrecao.textContent = `${pendentes.length} cliente(s) sem código encontrado(s).`;

    const confirmar = confirm(
      `Foram encontrados ${pendentes.length} cliente(s) já importado(s) sem código.\n\n` +
      `Os códigos serão preenchidos no padrão CLI-000001.\n` +
      `Faixa desta correção: ${primeiro} até ${ultimo}.\n\n` +
      `Nenhum outro dado do cliente será alterado.\n\nDeseja corrigir agora?`
    );

    if (!confirmar) {
      statusEl.textContent = 'Correção cancelada. Nenhum cliente foi alterado.';
      return;
    }

    registros = correcoes.map(item => ({
      arquivo: 'BANCO DE DADOS',
      cliente: {
        codigo_cliente: item.novoCodigo,
        cpf_cnpj: item.cliente.cpf_cnpj,
        razao_social: item.cliente.razao_social,
        nome_fantasia: item.cliente.nome_fantasia,
        cidade: item.cliente.cidade,
        estado: item.cliente.estado
      },
      clienteExistenteId: item.cliente.id,
      status: 'SEM CÓDIGO',
      observacao: `Será preenchido com ${item.novoCodigo}.`
    }));
    renderizarTabela();
    atualizarResumo();

    let corrigidos = 0;
    let falhas = 0;

    for (let i = 0; i < correcoes.length; i++) {
      const item = correcoes[i];
      const linha = registros[i];
      statusEl.textContent = `Corrigindo código ${i + 1} de ${correcoes.length}: ${item.novoCodigo}`;

      const { error } = await supabaseClient
        .from('clientes')
        .update({
          codigo_cliente: item.novoCodigo,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.cliente.id);

      if (error) {
        linha.status = 'ERRO IMPORTAÇÃO';
        linha.observacao = `Não foi possível gravar ${item.novoCodigo}: ${error.message || error}`;
        falhas += 1;
      } else {
        linha.status = 'CÓDIGO CORRIGIDO';
        linha.observacao = `Código ${item.novoCodigo} gravado com sucesso.`;
        corrigidos += 1;
      }

      barra.style.width = `${Math.round(((i + 1) / correcoes.length) * 100)}%`;
      renderizarTabela();
      atualizarResumo();
    }

    resumoCorrecao.textContent = `${corrigidos} corrigido(s)${falhas ? ` — ${falhas} falha(s)` : ''}.`;
    statusEl.textContent = falhas
      ? `Correção concluída com ressalvas: ${corrigidos} código(s) preenchido(s) e ${falhas} falha(s).`
      : `Correção concluída. ${corrigidos} cliente(s) receberam codigo_cliente.`;
  } catch (erro) {
    console.error(erro);
    resumoCorrecao.textContent = 'Falha ao verificar/corrigir.';
    statusEl.textContent = `Erro ao corrigir códigos: ${erro.message || erro}`;
  } finally {
    btnCorrigirCodigos.disabled = false;
    btnSelecionar.disabled = false;
    btnAnalisar.disabled = arquivosSelecionados.length === 0;
    btnLimpar.disabled = false;
    btnImportar.disabled = registros.filter(r => ['NOVO', 'SEM CÓDIGO'].includes(r.status)).length === 0;
  }
}

function limparTudo() {
  arquivosInput.value = '';
  arquivosSelecionados = [];
  registros = [];
  atualizarListaArquivos();
  zerarResumo();
  barra.style.width = '0%';
  statusEl.textContent = 'Aguardando arquivos.';
  tabelaResultados.innerHTML = '<tr><td colspan="9">Nenhum arquivo analisado.</td></tr>';
  btnImportar.disabled = true;
}

btnSelecionar.addEventListener('click', () => arquivosInput.click());
dropZone.addEventListener('click', () => arquivosInput.click());
arquivosInput.addEventListener('change', () => definirArquivos(arquivosInput.files));
btnAnalisar.addEventListener('click', analisarArquivos);
btnImportar.addEventListener('click', importarClientes);
btnCorrigirCodigos.addEventListener('click', corrigirCodigosPendentes);
btnLimpar.addEventListener('click', limparTudo);

['dragenter', 'dragover'].forEach(evento => {
  dropZone.addEventListener(evento, e => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('arrastando');
  });
});

['dragleave', 'drop'].forEach(evento => {
  dropZone.addEventListener(evento, e => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('arrastando');
  });
});

dropZone.addEventListener('drop', e => definirArquivos(e.dataTransfer.files));

btnSair.addEventListener('click', async e => {
  e.preventDefault();
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
});

verificarAcesso();
