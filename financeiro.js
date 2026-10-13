const SUPABASE_URL = 'https://kvmayirfbdnexlzqnjvr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RisUa11fiUO_G5TMLnMAPg_OfVBoNIP';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const LS_KEY = 'destac_financeiro_v1';
const FIN_FILTROS_KEY = 'destac_financeiro_filtros_v2';
const FIN_ULTIMO_RECEBER_KEY = 'destac_financeiro_ultimo_receber_v2';
let modoLocal = false;
let perfilUsuarioLogado = null;
let empresaUsuarioLogado = null;
let empresas = [];
let clientes = [];
let categorias = [];
let contasReceber = [];
let recebimentos = [];
let contasPagar = [];
let contratosFinanceiro = [];
let erroConsultaContratosFinanceiro = "";
let carregamentoCompletoContratos = true;
let filtroContratoReceberId = null;
let graficoReceitasDespesas = null;
let graficoStatusReceber = null;
let graficoFluxoCaixa = null;
let relatorioAtual = 'clientes';

const $ = (id) => document.getElementById(id);
const hojeISO = () => new Date().toISOString().slice(0, 10);
const numero = (v) => Number(v || 0);
const dinheiro = (v) => numero(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (v) => {
  if (!v) return '-';
  const [a, m, d] = String(v).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
const uuidLocal = () => (crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function nomePerfil(perfil) {
  return ({ SUPER_USUARIO: 'Super usuário', ADMINISTRADOR: 'Administrador', USUARIO: 'Usuário comum' })[perfil] || perfil || '-';
}

function nomeEmpresa(id) {
  const e = empresas.find((x) => String(x.id) === String(id));
  return e ? (e.nome_fantasia || e.razao_social || '-') : '-';
}

function nomeCliente(id) {
  const c = clientes.find((x) => String(x.id) === String(id));
  return c ? (c.nome_fantasia || c.razao_social || '-') : '-';
}

function nomeCategoria(id) {
  const c = categorias.find((x) => String(x.id) === String(id));
  return c ? c.nome : '-';
}

function totalContaReceber(c) {
  return numero(c.valor_original) - numero(c.desconto) + numero(c.juros) + numero(c.multa);
}

function saldoContaReceber(c) {
  return Math.max(0, totalContaReceber(c) - numero(c.valor_recebido));
}

function statusReceberEfetivo(c) {
  if (c.status === 'CANCELADO' || c.status === 'PAGO' || c.status === 'PARCIAL') return c.status;
  if (c.vencimento && c.vencimento < hojeISO() && saldoContaReceber(c) > 0) return 'VENCIDO';
  return c.status || 'ABERTO';
}

function statusPagarEfetivo(c) {
  if (c.status === 'CANCELADO' || c.status === 'PAGO') return c.status;
  if (c.vencimento && c.vencimento < hojeISO()) return 'VENCIDO';
  return c.status || 'ABERTO';
}

function pill(status) {
  const textos = { ABERTO: 'Em aberto', PARCIAL: 'Parcial', PAGO: 'Pago', VENCIDO: 'Vencido', CANCELADO: 'Cancelado' };
  return `<span class="status-pill status-${status}">${textos[status] || status}</span>`;
}

function salvarLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify({ categorias, contasReceber, recebimentos, contasPagar }));
}

function carregarLocal() {
  const padraoCategorias = [
    ['Publicidade e mídia', 'RECEITA'], ['Serviços', 'RECEITA'], ['Combustível', 'DESPESA'],
    ['Manutenção', 'DESPESA'], ['Impostos e taxas', 'DESPESA'], ['Energia e utilidades', 'DESPESA'],
    ['Equipe e terceiros', 'DESPESA'], ['Eventos', 'DESPESA'], ['Material gráfico', 'DESPESA'], ['Outras despesas', 'DESPESA']
  ];
  try {
    const dados = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    categorias = dados.categorias || padraoCategorias.map(([nome, tipo]) => ({ id: uuidLocal(), nome, tipo, ativo: true }));
    contasReceber = dados.contasReceber || [];
    recebimentos = dados.recebimentos || [];
    contasPagar = dados.contasPagar || [];
  } catch (_) {
    categorias = padraoCategorias.map(([nome, tipo]) => ({ id: uuidLocal(), nome, tipo, ativo: true }));
    contasReceber = [];
    recebimentos = [];
    contasPagar = [];
  }
  salvarLocal();
}

function mostrarModoDados(texto) {
  const el = $('modoDadosAviso');
  if (!el) return;
  el.hidden = !texto;
  el.textContent = texto || '';
}

function mostrarResultadoFinanceiro(mensagem, erro = false) {
  const el = $('financeiroResultado');
  if (!el) return;
  el.textContent = mensagem || '';
  el.hidden = !mensagem;
  el.classList.toggle('erro', !!erro);
}

function guardarFiltrosFinanceiro() {
  try {
    sessionStorage.setItem(FIN_FILTROS_KEY, JSON.stringify({
      empresa: $('filtroEmpresa').value,
      inicio: $('filtroInicio').value,
      fim: $('filtroFim').value
    }));
  } catch (e) { console.warn('Não foi possível guardar os filtros financeiros.', e); }
}

function restaurarFiltrosFinanceiro() {
  let filtros = null;
  try { filtros = JSON.parse(sessionStorage.getItem(FIN_FILTROS_KEY) || 'null'); } catch (_) {}
  if (filtros) {
    const empresa = String(filtros.empresa || '');
    if ([...$('filtroEmpresa').options].some(o => o.value === empresa)) $('filtroEmpresa').value = empresa;
    $('filtroInicio').value = filtros.inicio || '';
    $('filtroFim').value = filtros.fim || '';
  } else {
    // Sem filtros iniciais: um lançamento não deve sumir porque vence em outro mês.
    $('filtroInicio').value = '';
    $('filtroFim').value = '';
  }
  if (perfilUsuarioLogado === 'USUARIO' && empresaUsuarioLogado) {
    $('filtroEmpresa').value = String(empresaUsuarioLogado);
  }
}

function conferirUltimaGravacao() {
  if (modoLocal) return;
  let ultimo = null;
  try { ultimo = JSON.parse(sessionStorage.getItem(FIN_ULTIMO_RECEBER_KEY) || 'null'); } catch (_) {}
  if (!ultimo || !ultimo.id || Date.now() - Number(ultimo.ts || 0) > 86400000) return;
  const existe = contasReceber.some(c => String(c.id) === String(ultimo.id));
  if (existe) {
    mostrarResultadoFinanceiro('Gravação confirmada no Supabase: a conta a receber está disponível. Use Contas a receber para visualizá-la.');
  } else {
    mostrarResultadoFinanceiro('O último lançamento não foi retornado pelo Supabase. Verifique as permissões de leitura (RLS) e se o registro existe no banco.', true);
  }
}

async function validarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  const { data: perfil, error } = await supabaseClient
    .from('perfis_usuario')
    .select('id,user_id,nome,perfil,ativo,empresa_id')
    .eq('user_id', session.user.id)
    .single();

  if (error || !perfil || perfil.ativo !== true) {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
    return null;
  }

  perfilUsuarioLogado = perfil.perfil;
  empresaUsuarioLogado = perfil.empresa_id;
  $('nomeUsuarioConectado').textContent = perfil.nome || 'Usuário';
  $('perfilUsuarioConectado').textContent = nomePerfil(perfil.perfil);

  if (['SUPER_USUARIO', 'ADMINISTRADOR'].includes(perfil.perfil) && $('menuUsuarios')) {
    $('menuUsuarios').style.display = 'block';
  }
  return session;
}

async function carregarCadastros() {
  const [re, rc] = await Promise.all([
    supabaseClient.from('empresas').select('id,razao_social,nome_fantasia,ativo').eq('ativo', true).order('razao_social'),
    supabaseClient.from('clientes').select('id,razao_social,nome_fantasia,cpf_cnpj,ativo').eq('ativo', true).order('razao_social')
  ]);
  empresas = re.data || [];
  clientes = (rc.data || []).sort((a, b) => {
        const nomeA = String(a.nome_fantasia || a.razao_social || '').trim();
        const nomeB = String(b.nome_fantasia || b.razao_social || '').trim();
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base', numeric: true }) ||
          String(a.razao_social || '').localeCompare(String(b.razao_social || ''), 'pt-BR', { sensitivity: 'base', numeric: true }) ||
          Number(a.id) - Number(b.id);
      });

  if (perfilUsuarioLogado === 'USUARIO' && empresaUsuarioLogado) {
    empresas = empresas.filter((e) => String(e.id) === String(empresaUsuarioLogado));
  }
  preencherSelectsCadastros();
}

function preencherSelectsCadastros() {
  const selectsEmpresa = [$('filtroEmpresa'), $('receberEmpresa'), $('pagarEmpresa')].filter(Boolean);
  selectsEmpresa.forEach((s) => {
    const primeiro = s.id === 'filtroEmpresa' ? '<option value="">Todas as empresas</option>' : '<option value="">Selecione</option>';
    s.innerHTML = primeiro + empresas.map((e) => `<option value="${e.id}">${escapeHtml(e.nome_fantasia || e.razao_social)}</option>`).join('');
  });
  if (perfilUsuarioLogado === 'USUARIO' && empresaUsuarioLogado) {
    selectsEmpresa.forEach((s) => {
      s.value = empresaUsuarioLogado;
      if (s.id === 'filtroEmpresa') s.disabled = true;
    });
  }

  $('receberCliente').innerHTML = '<option value="">Selecione</option>' + clientes.map((c) => `<option value="${c.id}">${escapeHtml(c.nome_fantasia || c.razao_social)}</option>`).join('');
  preencherCategorias();
}

function preencherCategorias() {
  if (!$('pagarCategoria')) return;
  $('pagarCategoria').innerHTML = '<option value="">Sem categoria</option>' + categorias
    .filter((c) => c.ativo !== false && ['DESPESA', 'AMBOS'].includes(c.tipo))
    .map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
}

async function detectarFinanceiroBanco() {
  const teste = await supabaseClient.from('financeiro_categorias').select('id').limit(1);
  if (teste.error) {
    modoLocal = true;
    carregarLocal();
    mostrarModoDados('Financeiro em modo local: as tabelas do módulo ainda não foram instaladas no Supabase da DESTAC. Os lançamentos ficam neste navegador até executar supabase_financeiro.sql.');
    return;
  }
  modoLocal = false;
  mostrarModoDados('');
}

async function carregarContratosFinanceiro() {
  if (modoLocal) {
    contratosFinanceiro = [];
    erroConsultaContratosFinanceiro = 'Em modo local não é possível verificar a integração dos contratos com o Supabase.';
    carregamentoCompletoContratos = true;
    return;
  }
  // Dados mínimos já presentes na tabela contratos antes das novas migrações.
  // Paginação para evitar o limite padrão de 1.000 linhas do PostgREST.
  try {
    const todos = [];
    const tamanhoLote = 500;
    let completo = false;
    for (let offset = 0; offset < 10000; offset += tamanhoLote) {
      const { data, error } = await supabaseClient.from('contratos')
        .select('id,numero_contrato,empresa_id,cliente_id,status,modalidade_contrato,valor_permuta,valor_financeiro')
        .order('id', { ascending: false }).range(offset, offset + tamanhoLote - 1);
      if (error) throw error;
      todos.push(...(data || []));
      if ((data || []).length < tamanhoLote) { completo = true; break; }
    }
    contratosFinanceiro = todos;
    erroConsultaContratosFinanceiro = '';
    carregamentoCompletoContratos = completo;
  } catch (erro) {
    console.error('Falha na consulta de contratos do financeiro:', erro);
    contratosFinanceiro = [];
    erroConsultaContratosFinanceiro = erro?.message || 'Sem permissão para consultar contratos.';
    carregamentoCompletoContratos = true;
  }
}

function contratoPorId(id) {
  if (id == null) return null;
  return contratosFinanceiro.find((c) => String(c.id) === String(id)) || null;
}

function numeroContratoFinanceiro(conta) {
  if (!conta?.contrato_id) return '-';
  const contrato = contratoPorId(conta.contrato_id);
  return contrato?.numero_contrato || conta.numero_documento || String(conta.contrato_id);
}

function contaDeContrato(conta) {
  return conta?.contrato_id != null && String(conta.origem || '').toUpperCase() === 'CONTRATO';
}

function verResumoContrato(id) {
  const contrato = contratoPorId(id);
  $('pesquisaContratosFinanceiro').value = contrato?.numero_contrato || String(id);
  $('situacaoContratosFinanceiro').value = '';
  ativarTab('contratos-financeiro');
  renderContratosFinanceiro();
}

function verParcelasContrato(id) {
  filtroContratoReceberId = String(id);
  const relacionado = contasReceber.find(c => String(c.contrato_id) === String(id));
  if (relacionado && [...$('filtroEmpresa').options].some(o => o.value === String(relacionado.empresa_id))) {
    $('filtroEmpresa').value = String(relacionado.empresa_id);
  }
  $('pesquisaReceber').value = '';
  $('statusReceber').value = '';
  $('filtroInicio').value = '';
  $('filtroFim').value = '';
  guardarFiltrosFinanceiro();
  ativarTab('receber');
  renderContasReceber();
}

function limparFiltroContratoReceber() {
  filtroContratoReceberId = null;
  renderContasReceber();
}

function renderContratosFinanceiro() {
  const aviso = $('situacaoIntegracao');
  const tb = $('tabelaContratosFinanceiro');
  if (!aviso || !tb) return;
  const contasVinculadas = contasReceber.filter(contaDeContrato);
  const resumo = new Map();
  for (const c of contasVinculadas) {
    const id = String(c.contrato_id);
    if (!resumo.has(id)) resumo.set(id, { parcelas: 0, gerado: 0, recebido: 0, saldo: 0 });
    const r = resumo.get(id);
    r.parcelas++;
    // Valor gerado considera inclusive parcelas canceladas, mas o saldo as exclui.
    r.gerado += totalContaReceber(c);
    r.recebido += numero(c.valor_recebido);
    if (c.status !== 'CANCELADO') r.saldo += saldoContaReceber(c);
  }
  const registrados = contratosFinanceiro.map((c) => ({ ...c, resumo: resumo.get(String(c.id)) || null }));
  const idsVisiveis = new Set(contratosFinanceiro.map(c => String(c.id)));
  // Mantém cobranças vinculadas visíveis quando o contrato não pôde ser listado
  // pelo RLS, sem supor informações sobre o contrato ausente.
  for (const [id, r] of resumo.entries()) {
    if (!idsVisiveis.has(id)) {
      const primeira = contasVinculadas.find(c => String(c.contrato_id) === id);
      registrados.push({ id, numero_contrato: primeira?.numero_documento || id,
        empresa_id: primeira?.empresa_id, cliente_id: primeira?.cliente_id,
        status: null, resumo: r, semCadastroVisivel: true });
    }
  }
  const ativos = registrados.filter(c => !c.semCadastroVisivel && String(c.status || '').toUpperCase() === 'ATIVO');
  const comParcelas = registrados.filter(c => c.resumo);
  const semParcelasAtivos = ativos.filter(c => !c.resumo && c.modalidade_contrato !== 'PERMUTA');
  $('finQtdContratosAtivos').textContent = erroConsultaContratosFinanceiro ? '—' : String(ativos.length);
  $('finQtdComParcelas').textContent = String(comParcelas.length);
  $('finQtdSemParcelas').textContent = erroConsultaContratosFinanceiro ? '—' : String(semParcelasAtivos.length);
  $('finTotalVinculado').textContent = dinheiro(contasVinculadas.reduce((s,c) => s + totalContaReceber(c),0));
  if (modoLocal) aviso.textContent = 'Modo local: não é possível verificar parcelas automáticas no Supabase.';
  else if (erroConsultaContratosFinanceiro) aviso.textContent = `As contas foram carregadas, mas não foi possível consultar a lista de contratos: ${erroConsultaContratosFinanceiro}`;
  else if (!carregamentoCompletoContratos) aviso.textContent = 'A lista de contratos é extensa; os indicadores consideram os primeiros 10.000 contratos acessíveis. Utilize a conciliação para revisão integral.';
  else if (!contasVinculadas.length) aviso.textContent = 'Nenhuma parcela com origem CONTRATO foi encontrada entre os registros acessíveis. Verifique se a migração SQL está instalada, se existe contrato ATIVO novo e se os contratos antigos já foram conciliados.';
  else aviso.textContent = `${contasVinculadas.length} parcela(s) de contrato retornada(s) pelo Supabase, vinculadas a ${comParcelas.length} contrato(s).`;
  const texto = ($('pesquisaContratosFinanceiro')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const situacao = $('situacaoContratosFinanceiro')?.value || '';
  const { empresaId, inicio, fim } = periodoFiltro();
  let lista = registrados.filter((c) => {
    if (empresaId && String(c.empresa_id) !== String(empresaId)) return false;
    if (texto && ![c.numero_contrato, nomeEmpresa(c.empresa_id), nomeCliente(c.cliente_id)]
      .some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(texto))) return false;
    if (situacao === 'COM_PARCELAS' && !c.resumo) return false;
    if (situacao === 'SEM_PARCELAS' && (c.resumo || String(c.status || '').toUpperCase() !== 'ATIVO' || c.modalidade_contrato === 'PERMUTA')) return false;
    if (situacao === 'SEM_FINANCEIRO' && c.resumo) return false;
    // O período filtra os vencimentos apenas dos contratos com cobranças.
    if ((inicio || fim) && c.resumo) {
      const linhas = contasVinculadas.filter(x => String(x.contrato_id) === String(c.id));
      if (!linhas.some(x => dentroPeriodo(x.vencimento, inicio, fim))) return false;
    }
    return true;
  });
  lista.sort((a,b) => String(b.id).localeCompare(String(a.id), undefined, { numeric:true }));
  tb.innerHTML = lista.length ? lista.map(c => {
    const r = c.resumo;
    const st = String(c.status || '').toUpperCase();
    let situacaoTexto = r ? 'Parcelas vinculadas' : c.modalidade_contrato === 'PERMUTA' ? 'Permuta — sem cobrança monetária' : (st === 'ATIVO' ? 'Sem parcelas — verificar' : 'Sem parcelas');
    if (c.semCadastroVisivel) situacaoTexto = 'Contrato não acessível';
    return `<tr>
      <td><strong>${escapeHtml(c.numero_contrato || String(c.id))}</strong></td>
      <td>${escapeHtml(nomeEmpresa(c.empresa_id))}</td>
      <td>${escapeHtml(nomeCliente(c.cliente_id))}</td>
      <td>${escapeHtml(c.status || 'Não acessível')}</td>
      <td>${r ? r.parcelas : 0}</td>
      <td class="valor">${dinheiro(r?.gerado || 0)}</td>
      <td class="valor">${dinheiro(r?.recebido || 0)}</td>
      <td class="valor">${dinheiro(r?.saldo || 0)}</td>
      <td>${escapeHtml(situacaoTexto)}</td>
      <td><div class="acoes-linha">
        ${r ? `<button type="button" class="acao-mini primaria" data-fin-ver-parcelas="${escapeHtml(c.id)}">Ver parcelas</button>` : c.modalidade_contrato === 'PERMUTA' ? '—' : `<a class="acao-mini" href="conciliacao_contratos.html">Conciliar</a>`}
      </div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="10">Nenhum contrato corresponde aos filtros. Confira também as permissões de acesso e a conciliação.</td></tr>';
  tb.querySelectorAll('[data-fin-ver-parcelas]').forEach(b => b.addEventListener('click', () => verParcelasContrato(b.dataset.finVerParcelas)));
}

async function carregarFinanceiro() {
  if (modoLocal) {
    preencherCategorias();
    renderTudo();
    return;
  }

  try { await supabaseClient.rpc('financeiro_atualizar_vencidos'); } catch (_) {}

  const [cat, cr, rec, cp] = await Promise.all([
    supabaseClient.from('financeiro_categorias').select('*').eq('ativo', true).order('nome'),
    supabaseClient.from('financeiro_contas_receber').select('*').order('vencimento', { ascending: true }),
    supabaseClient.from('financeiro_recebimentos').select('*').order('data_recebimento', { ascending: false }),
    supabaseClient.from('financeiro_contas_pagar').select('*').order('vencimento', { ascending: true })
  ]);

  const erro = cat.error || cr.error || rec.error || cp.error;
  if (erro) {
    console.error('Erro financeiro:', erro);
    mostrarModoDados(`Não foi possível ler os lançamentos no Supabase: ${erro.message}. Nenhum lançamento local substituiu os dados do banco. Verifique sua sessão e as permissões RLS.`);
    mostrarResultadoFinanceiro('Falha ao consultar Financeiro. Atualize a página após corrigir o acesso ao banco.', true);
    return;
  } else {
    categorias = cat.data || [];
    contasReceber = cr.data || [];
    recebimentos = rec.data || [];
    contasPagar = cp.data || [];
    await carregarContratosFinanceiro();
    mostrarModoDados('');
  }
  preencherCategorias();
  renderTudo();
  conferirUltimaGravacao();
}

function periodoFiltro() {
  return { empresaId: $('filtroEmpresa')?.value || '', inicio: $('filtroInicio')?.value || '', fim: $('filtroFim')?.value || '' };
}

function dentroPeriodo(data, inicio, fim) {
  if (!data) return true;
  if (inicio && data < inicio) return false;
  if (fim && data > fim) return false;
  return true;
}

function filtrarEmpresa(lista, campo = 'empresa_id') {
  const { empresaId } = periodoFiltro();
  return empresaId ? lista.filter((x) => String(x[campo] ?? '') === String(empresaId)) : lista.slice();
}

function receberFiltrado() {
  const { inicio, fim } = periodoFiltro();
  return filtrarEmpresa(contasReceber).filter((x) => dentroPeriodo(x.vencimento, inicio, fim));
}

function recebimentosFiltrados() {
  const { inicio, fim } = periodoFiltro();
  return filtrarEmpresa(recebimentos).filter((x) => dentroPeriodo(x.data_recebimento, inicio, fim));
}

function pagarFiltrado() {
  const { inicio, fim } = periodoFiltro();
  return filtrarEmpresa(contasPagar).filter((x) => dentroPeriodo(x.vencimento, inicio, fim));
}

function renderTudo() {
  renderDashboard();
  renderContasReceber();
  renderContratosFinanceiro();
  renderRecebimentos();
  renderContasPagar();
  renderFluxo();
  renderRelatorio();
}

function renderDashboard() {
  const cr = receberFiltrado();
  const rec = recebimentosFiltrados();
  const cp = pagarFiltrado();

  const totalRecebido = rec.reduce((s, x) => s + numero(x.valor), 0);
  const abertos = cr.filter((x) => !['PAGO', 'CANCELADO'].includes(statusReceberEfetivo(x)));
  const totalAReceber = abertos.reduce((s, x) => s + saldoContaReceber(x), 0);
  const vencidos = abertos.filter((x) => statusReceberEfetivo(x) === 'VENCIDO');
  const totalVencido = vencidos.reduce((s, x) => s + saldoContaReceber(x), 0);

  const hoje = new Date();
  const em7 = new Date(); em7.setDate(hoje.getDate() + 7);
  const h = hoje.toISOString().slice(0, 10); const d7 = em7.toISOString().slice(0, 10);
  const proximos = abertos.filter((x) => x.vencimento >= h && x.vencimento <= d7);
  const totalProximos = proximos.reduce((s, x) => s + saldoContaReceber(x), 0);
  const pagosPeriodo = cp.filter((x) => x.status === 'PAGO' && dentroPeriodo(x.data_pagamento, periodoFiltro().inicio, periodoFiltro().fim));
  const totalPago = pagosPeriodo.reduce((s, x) => s + numero(x.valor_pago || x.valor_original), 0);

  $('kpiRecebido').textContent = dinheiro(totalRecebido);
  $('kpiRecebidoQtd').textContent = `${rec.length} recebimento${rec.length === 1 ? '' : 's'}`;
  $('kpiAReceber').textContent = dinheiro(totalAReceber);
  $('kpiAReceberQtd').textContent = `${abertos.length} parcela${abertos.length === 1 ? '' : 's'}`;
  $('kpiVencido').textContent = dinheiro(totalVencido);
  $('kpiVencidoQtd').textContent = `${vencidos.length} parcela${vencidos.length === 1 ? '' : 's'}`;
  $('kpiProximos').textContent = dinheiro(totalProximos);
  $('kpiProximosQtd').textContent = `${proximos.length} vencimento${proximos.length === 1 ? '' : 's'}`;
  $('kpiSaldo').textContent = dinheiro(totalRecebido - totalPago);

  const resumo = abertos.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 10);
  $('tabelaResumoReceber').innerHTML = resumo.length ? resumo.map((x) => `
    <tr>
      <td>${dataBR(x.vencimento)}</td><td>${escapeHtml(nomeCliente(x.cliente_id))}</td>
      <td>${escapeHtml(x.numero_documento || '-')}</td><td>${x.parcela || 1}/${x.total_parcelas || 1}</td>
      <td class="valor">${dinheiro(totalContaReceber(x))}</td><td class="valor">${dinheiro(saldoContaReceber(x))}</td>
      <td>${pill(statusReceberEfetivo(x))}</td>
      <td><button class="acao-mini primaria" data-baixa="${x.id}">Dar baixa</button></td>
    </tr>`).join('') : '<tr><td colspan="8">Nenhuma conta pendente no período.</td></tr>';

  ligarBotoesBaixa();
  renderGraficosDashboard(cr, rec, cp);
}

function renderGraficosDashboard(cr, rec, cp) {
  if (!window.Chart) return;
  const meses = ultimosMeses(6);
  const entradas = meses.map((m) => rec.filter((x) => mesKey(x.data_recebimento) === m.key).reduce((s, x) => s + numero(x.valor), 0));
  const saidas = meses.map((m) => cp.filter((x) => x.status === 'PAGO' && mesKey(x.data_pagamento) === m.key).reduce((s, x) => s + numero(x.valor_pago || x.valor_original), 0));

  graficoReceitasDespesas?.destroy();
  graficoReceitasDespesas = new Chart($('graficoReceitasDespesas'), {
    type: 'bar',
    data: { labels: meses.map((m) => m.label), datasets: [{ label: 'Receitas', data: entradas }, { label: 'Despesas', data: saidas }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
  });

  const counts = ['ABERTO', 'PARCIAL', 'VENCIDO', 'PAGO'].map((st) => cr.filter((x) => statusReceberEfetivo(x) === st).length);
  graficoStatusReceber?.destroy();
  graficoStatusReceber = new Chart($('graficoStatusReceber'), {
    type: 'doughnut',
    data: { labels: ['Em aberto', 'Parcial', 'Vencido', 'Pago'], datasets: [{ data: counts }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderContasReceber() {
  const termo = ($('pesquisaReceber')?.value || '').trim().toLowerCase();
  const status = $('statusReceber')?.value || '';
  let lista = receberFiltrado();
  if (filtroContratoReceberId) lista = lista.filter(x => String(x.contrato_id) === String(filtroContratoReceberId));
  if (termo) lista = lista.filter((x) => [nomeCliente(x.cliente_id), x.numero_documento, x.descricao, numeroContratoFinanceiro(x)].some((v) => String(v || '').toLowerCase().includes(termo)));
  const filtroAviso = $('filtroContratoReceberAviso');
  if (filtroAviso) {
    filtroAviso.hidden = !filtroContratoReceberId;
    const contrato = contratoPorId(filtroContratoReceberId);
    $('filtroContratoReceberTexto').textContent = `Exibindo apenas parcelas do contrato ${contrato?.numero_contrato || filtroContratoReceberId}.`;
  }
  if (status) lista = lista.filter((x) => statusReceberEfetivo(x) === status);

  $('tabelaReceber').innerHTML = lista.length ? lista.map((x) => {
    const st = statusReceberEfetivo(x);
    return `<tr>
      <td>${dataBR(x.vencimento)}</td><td>${escapeHtml(nomeEmpresa(x.empresa_id))}</td><td>${escapeHtml(nomeCliente(x.cliente_id))}</td>
      <td>${escapeHtml(x.numero_documento || '-')}</td>
      <td>${contaDeContrato(x) ? '<span class="fin-origem-contrato">Contrato</span>' : '<span class="fin-origem-manual">Manual</span>'}</td>
      <td>${contaDeContrato(x) ? escapeHtml(numeroContratoFinanceiro(x)) : '—'}</td>
      <td>${x.parcela || 1}/${x.total_parcelas || 1}</td>
      <td class="valor">${dinheiro(totalContaReceber(x))}</td><td class="valor">${dinheiro(x.valor_recebido)}</td><td class="valor">${dinheiro(saldoContaReceber(x))}</td>
      <td>${pill(st)}</td><td><div class="acoes-linha">
        ${!['PAGO', 'CANCELADO'].includes(st) ? `<button class="acao-mini primaria" data-baixa="${x.id}">Dar baixa</button>` : ''}
        ${contaDeContrato(x)
          ? `<button type="button" class="acao-mini" data-fin-ver-contrato="${escapeHtml(x.contrato_id)}">Resumo do contrato</button>`
          : `<button type="button" class="acao-mini" data-editar-receber="${x.id}">Editar</button>
             ${st !== 'CANCELADO' ? `<button type="button" class="acao-mini perigo" data-cancelar-receber="${x.id}">Cancelar</button>` : ''}`}
      </div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="12">Nenhuma conta a receber encontrada.</td></tr>';

  ligarBotoesBaixa();
  document.querySelectorAll('[data-editar-receber]').forEach((b) => b.onclick = () => abrirReceber(b.dataset.editarReceber));
  document.querySelectorAll('[data-cancelar-receber]').forEach((b) => b.onclick = () => cancelarReceber(b.dataset.cancelarReceber));
  document.querySelectorAll('[data-fin-ver-contrato]').forEach((b) => b.onclick = () => verResumoContrato(b.dataset.finVerContrato));
}

function renderRecebimentos() {
  const lista = recebimentosFiltrados();
  $('tabelaRecebimentos').innerHTML = lista.length ? lista.map((x) => {
    const conta = contasReceber.find((c) => c.id === x.conta_receber_id);
    return `<tr><td>${dataBR(x.data_recebimento)}</td><td>${escapeHtml(nomeEmpresa(x.empresa_id))}</td><td>${escapeHtml(nomeCliente(x.cliente_id))}</td>
      <td>${escapeHtml(conta?.numero_documento || '-')}</td><td>${escapeHtml(x.forma_pagamento || '-')}</td><td class="valor">${dinheiro(x.valor)}</td>
      <td>${escapeHtml(x.referencia || '-')}</td><td>${escapeHtml(x.observacao || '-')}</td></tr>`;
  }).join('') : '<tr><td colspan="8">Nenhum recebimento encontrado.</td></tr>';
}

function renderContasPagar() {
  const termo = ($('pesquisaPagar')?.value || '').trim().toLowerCase();
  const status = $('statusPagar')?.value || '';
  let lista = pagarFiltrado();
  if (termo) lista = lista.filter((x) => [x.fornecedor_nome, x.numero_documento, x.descricao].some((v) => String(v || '').toLowerCase().includes(termo)));
  if (status) lista = lista.filter((x) => statusPagarEfetivo(x) === status);

  $('tabelaPagar').innerHTML = lista.length ? lista.map((x) => {
    const st = statusPagarEfetivo(x);
    return `<tr><td>${dataBR(x.vencimento)}</td><td>${escapeHtml(nomeEmpresa(x.empresa_id))}</td><td>${escapeHtml(x.fornecedor_nome)}</td>
      <td>${escapeHtml(nomeCategoria(x.categoria_id))}</td><td>${escapeHtml(x.numero_documento || '-')}</td><td class="valor">${dinheiro(x.valor_original)}</td>
      <td class="valor">${dinheiro(x.valor_pago)}</td><td>${pill(st)}</td><td><div class="acoes-linha">
        ${!['PAGO', 'CANCELADO'].includes(st) ? `<button class="acao-mini primaria" data-pagamento="${x.id}">Dar baixa</button>` : ''}
        <button class="acao-mini" data-editar-pagar="${x.id}">Editar</button>
        ${st !== 'CANCELADO' ? `<button class="acao-mini perigo" data-cancelar-pagar="${x.id}">Cancelar</button>` : ''}
      </div></td></tr>`;
  }).join('') : '<tr><td colspan="9">Nenhuma conta a pagar encontrada.</td></tr>';

  document.querySelectorAll('[data-pagamento]').forEach((b) => b.onclick = () => abrirPagamento(b.dataset.pagamento));
  document.querySelectorAll('[data-editar-pagar]').forEach((b) => b.onclick = () => abrirPagar(b.dataset.editarPagar));
  document.querySelectorAll('[data-cancelar-pagar]').forEach((b) => b.onclick = () => cancelarPagar(b.dataset.cancelarPagar));
}

function renderFluxo() {
  const rec = recebimentosFiltrados();
  const cp = pagarFiltrado().filter((x) => x.status === 'PAGO' && x.data_pagamento && dentroPeriodo(x.data_pagamento, periodoFiltro().inicio, periodoFiltro().fim));
  const movs = [
    ...rec.map((x) => ({ data: x.data_recebimento, tipo: 'ENTRADA', empresa_id: x.empresa_id, descricao: contasReceber.find((c) => c.id === x.conta_receber_id)?.descricao || 'Recebimento', documento: contasReceber.find((c) => c.id === x.conta_receber_id)?.numero_documento || '-', entrada: numero(x.valor), saida: 0 })),
    ...cp.map((x) => ({ data: x.data_pagamento, tipo: 'SAIDA', empresa_id: x.empresa_id, descricao: x.descricao || 'Pagamento', documento: x.numero_documento || '-', entrada: 0, saida: numero(x.valor_pago || x.valor_original) }))
  ].sort((a, b) => a.data.localeCompare(b.data));

  let saldo = 0;
  $('tabelaFluxo').innerHTML = movs.length ? movs.map((x) => {
    saldo += x.entrada - x.saida;
    return `<tr><td>${dataBR(x.data)}</td><td>${x.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}</td><td>${escapeHtml(nomeEmpresa(x.empresa_id))}</td><td>${escapeHtml(x.descricao)}</td><td>${escapeHtml(x.documento)}</td><td class="valor">${x.entrada ? dinheiro(x.entrada) : '-'}</td><td class="valor">${x.saida ? dinheiro(x.saida) : '-'}</td><td class="valor">${dinheiro(saldo)}</td></tr>`;
  }).join('') : '<tr><td colspan="8">Nenhuma movimentação realizada no período.</td></tr>';

  const entradas = rec.reduce((s, x) => s + numero(x.valor), 0);
  const saidas = cp.reduce((s, x) => s + numero(x.valor_pago || x.valor_original), 0);
  const previstoEntradas = receberFiltrado().filter((x) => !['PAGO', 'CANCELADO'].includes(statusReceberEfetivo(x))).reduce((s, x) => s + saldoContaReceber(x), 0);
  const previstoSaidas = pagarFiltrado().filter((x) => !['PAGO', 'CANCELADO'].includes(statusPagarEfetivo(x))).reduce((s, x) => s + numero(x.valor_original), 0);
  $('fluxoEntradas').textContent = dinheiro(entradas); $('fluxoSaidas').textContent = dinheiro(saidas); $('fluxoSaldo').textContent = dinheiro(entradas - saidas);
  $('fluxoPrevistoEntradas').textContent = dinheiro(previstoEntradas); $('fluxoPrevistoSaidas').textContent = dinheiro(previstoSaidas);

  if (window.Chart) {
    const meses = ultimosMeses(6);
    const ent = meses.map((m) => rec.filter((x) => mesKey(x.data_recebimento) === m.key).reduce((s, x) => s + numero(x.valor), 0));
    const sai = meses.map((m) => cp.filter((x) => mesKey(x.data_pagamento) === m.key).reduce((s, x) => s + numero(x.valor_pago || x.valor_original), 0));
    let acum = 0; const saldos = meses.map((_, i) => (acum += ent[i] - sai[i]));
    graficoFluxoCaixa?.destroy();
    graficoFluxoCaixa = new Chart($('graficoFluxoCaixa'), { type: 'line', data: { labels: meses.map((m) => m.label), datasets: [{ label: 'Saldo acumulado', data: saldos }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  }
}

function renderRelatorio() {
  const th = $('cabecalhoRelatorio'); const tb = $('tabelaRelatorio');
  const cr = receberFiltrado(); const rec = recebimentosFiltrados(); const cp = pagarFiltrado();

  if (relatorioAtual === 'clientes') {
    $('tituloRelatorio').textContent = 'Financeiro por cliente';
    th.innerHTML = '<tr><th>Cliente</th><th>Lançado</th><th>Recebido</th><th>A receber</th><th>Vencido</th><th>Situação</th></tr>';
    const ids = [...new Set(cr.map((x) => x.cliente_id))];
    tb.innerHTML = ids.length ? ids.map((id) => {
      const itens = cr.filter((x) => x.cliente_id === id);
      const recebido = rec.filter((x) => x.cliente_id === id).reduce((s, x) => s + numero(x.valor), 0);
      const lancado = itens.filter((x) => x.status !== 'CANCELADO').reduce((s, x) => s + totalContaReceber(x), 0);
      const aberto = itens.filter((x) => !['PAGO','CANCELADO'].includes(statusReceberEfetivo(x))).reduce((s, x) => s + saldoContaReceber(x), 0);
      const vencido = itens.filter((x) => statusReceberEfetivo(x) === 'VENCIDO').reduce((s, x) => s + saldoContaReceber(x), 0);
      return `<tr><td>${escapeHtml(nomeCliente(id))}</td><td class="valor">${dinheiro(lancado)}</td><td class="valor">${dinheiro(recebido)}</td><td class="valor">${dinheiro(aberto)}</td><td class="valor">${dinheiro(vencido)}</td><td>${vencido > 0 ? pill('VENCIDO') : pill('ABERTO')}</td></tr>`;
    }).join('') : '<tr><td colspan="6">Sem dados.</td></tr>';
  } else if (relatorioAtual === 'inadimplencia') {
    $('tituloRelatorio').textContent = 'Inadimplência';
    th.innerHTML = '<tr><th>Cliente</th><th>Documento</th><th>Vencimento</th><th>Dias em atraso</th><th>Saldo vencido</th></tr>';
    const venc = cr.filter((x) => statusReceberEfetivo(x) === 'VENCIDO');
    tb.innerHTML = venc.length ? venc.map((x) => `<tr><td>${escapeHtml(nomeCliente(x.cliente_id))}</td><td>${escapeHtml(x.numero_documento || '-')}</td><td>${dataBR(x.vencimento)}</td><td>${diasEntre(x.vencimento, hojeISO())}</td><td class="valor">${dinheiro(saldoContaReceber(x))}</td></tr>`).join('') : '<tr><td colspan="5">Nenhuma inadimplência no período.</td></tr>';
  } else if (relatorioAtual === 'receitas') {
    $('tituloRelatorio').textContent = 'Receitas recebidas';
    th.innerHTML = '<tr><th>Data</th><th>Empresa</th><th>Cliente</th><th>Forma</th><th>Valor</th></tr>';
    tb.innerHTML = rec.length ? rec.map((x) => `<tr><td>${dataBR(x.data_recebimento)}</td><td>${escapeHtml(nomeEmpresa(x.empresa_id))}</td><td>${escapeHtml(nomeCliente(x.cliente_id))}</td><td>${escapeHtml(x.forma_pagamento)}</td><td class="valor">${dinheiro(x.valor)}</td></tr>`).join('') : '<tr><td colspan="5">Sem dados.</td></tr>';
  } else {
    $('tituloRelatorio').textContent = 'Despesas';
    th.innerHTML = '<tr><th>Vencimento</th><th>Empresa</th><th>Fornecedor</th><th>Categoria</th><th>Status</th><th>Valor</th></tr>';
    tb.innerHTML = cp.length ? cp.map((x) => `<tr><td>${dataBR(x.vencimento)}</td><td>${escapeHtml(nomeEmpresa(x.empresa_id))}</td><td>${escapeHtml(x.fornecedor_nome)}</td><td>${escapeHtml(nomeCategoria(x.categoria_id))}</td><td>${pill(statusPagarEfetivo(x))}</td><td class="valor">${dinheiro(x.valor_original)}</td></tr>`).join('') : '<tr><td colspan="6">Sem dados.</td></tr>';
  }
}

function abrirReceber(id = null) {
  $('formReceber').reset(); $('receberId').value = ''; $('receberParcela').value = 1; $('receberTotalParcelas').value = 1;
  $('receberCompetencia').value = hojeISO().slice(0, 7) + '-01'; $('receberVencimento').value = hojeISO();
  if (perfilUsuarioLogado === 'USUARIO' && empresaUsuarioLogado) $('receberEmpresa').value = empresaUsuarioLogado;
  if (id) {
    const x = contasReceber.find((c) => String(c.id) === String(id)); if (!x) return;
    if (contaDeContrato(x)) {
      verParcelasContrato(x.contrato_id);
      mostrarResultadoFinanceiro('Esta parcela foi gerada pelo contrato. Ajuste valores e vencimentos no cadastro do contrato; a baixa continua disponível aqui.');
      return;
    }
    $('tituloModalReceber').textContent = 'Editar conta'; $('receberId').value = x.id; $('receberEmpresa').value = x.empresa_id; $('receberCliente').value = x.cliente_id;
    $('receberDocumento').value = x.numero_documento || ''; $('receberDescricao').value = x.descricao || ''; $('receberParcela').value = x.parcela || 1; $('receberTotalParcelas').value = x.total_parcelas || 1;
    $('receberCompetencia').value = x.competencia || ''; $('receberVencimento').value = x.vencimento || ''; $('receberValor').value = numero(x.valor_original).toFixed(2); $('receberFormaPrevista').value = x.forma_prevista || ''; $('receberObservacao').value = x.observacao || '';
  } else $('tituloModalReceber').textContent = 'Nova conta';
  $('modalReceber').showModal();
}

async function salvarReceber(ev) {
  ev.preventDefault();
  const botao = $('formReceber').querySelector('[type="submit"]');
  if (botao?.disabled) return;
  const id = $('receberId').value;
  const atual = id ? contasReceber.find(x => String(x.id) === String(id)) : null;
  if (atual && contaDeContrato(atual)) {
    mostrarResultadoFinanceiro('Não é permitido modificar uma parcela de contrato pelo formulário manual.', true);
    return;
  }
  const payload = {
    empresa_id: $('receberEmpresa').value,
    cliente_id: $('receberCliente').value,
    contrato_id: null,
    numero_documento: $('receberDocumento').value.trim() || null,
    descricao: $('receberDescricao').value.trim(),
    parcela: Number($('receberParcela').value || 1),
    total_parcelas: Number($('receberTotalParcelas').value || 1),
    competencia: $('receberCompetencia').value || null,
    vencimento: $('receberVencimento').value,
    valor_original: numero($('receberValor').value),
    forma_prevista: $('receberFormaPrevista').value || null,
    observacao: $('receberObservacao').value.trim() || null,
    origem: 'MANUAL'
  };

  const textoBotao = botao?.textContent;
  if (botao) { botao.disabled = true; botao.textContent = 'Salvando...'; }
  try {
    let idSalvo = id;
    if (modoLocal) {
      if (id) Object.assign(contasReceber.find((x) => x.id === id), payload, { updated_at: new Date().toISOString() });
      else {
        idSalvo = uuidLocal();
        contasReceber.push({ id: idSalvo, ...payload, desconto: 0, juros: 0, multa: 0, valor_recebido: 0, status: 'ABERTO', created_at: new Date().toISOString() });
      }
      salvarLocal();
    } else {
      const consulta = id
        ? supabaseClient.from('financeiro_contas_receber').update(payload).eq('id', id)
        : supabaseClient.from('financeiro_contas_receber').insert(payload);
      // Confirma que o banco retornou o registro; o simples fechamento do modal não é confirmação.
      const r = await consulta.select('id').single();
      if (r.error) throw new Error(r.error.message);
      if (!r.data?.id) throw new Error('O Supabase não confirmou o registro salvo.');
      idSalvo = r.data.id;
      try { sessionStorage.setItem(FIN_ULTIMO_RECEBER_KEY, JSON.stringify({ id: idSalvo, ts: Date.now() })); } catch (_) {}
    }
    // Exibe o lançamento recém-salvo e conserva estes filtros ao atualizar a página.
    if ([...$('filtroEmpresa').options].some(o => o.value === String(payload.empresa_id))) {
      $('filtroEmpresa').value = String(payload.empresa_id);
    }
    $('filtroInicio').value = '';
    $('filtroFim').value = '';
    $('pesquisaReceber').value = '';
    $('statusReceber').value = '';
    filtroContratoReceberId = null;
    guardarFiltrosFinanceiro();
    $('modalReceber').close();
    await carregarFinanceiro();
    ativarTab('receber');
    const visivel = contasReceber.some(x => String(x.id) === String(idSalvo));
    if (visivel) {
      mostrarResultadoFinanceiro(modoLocal
        ? 'Conta salva neste navegador (modo local). Os dados ainda não estão no Supabase.'
        : 'Conta a receber salva e confirmada no Supabase.');
    } else {
      mostrarResultadoFinanceiro('O banco respondeu à gravação, mas a conta não apareceu na consulta. Confira as permissões RLS da empresa e atualize a página.', true);
    }
  } catch (erro) {
    console.error('Falha ao gravar conta a receber:', erro);
    const mensagem = `Não foi possível confirmar a gravação: ${erro?.message || String(erro)}`;
    mostrarResultadoFinanceiro(mensagem, true);
    alert(mensagem);
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = textoBotao; }
  }
}

function ligarBotoesBaixa() { document.querySelectorAll('[data-baixa]').forEach((b) => b.onclick = () => abrirBaixa(b.dataset.baixa)); }

function abrirBaixa(id) {
  const x = contasReceber.find((c) => c.id === id); if (!x) return;
  $('formBaixa').reset(); $('baixaContaId').value = id; $('baixaData').value = hojeISO(); $('baixaValor').value = saldoContaReceber(x).toFixed(2);
  $('resumoBaixa').innerHTML = `<strong>${escapeHtml(nomeCliente(x.cliente_id))}</strong><br>${escapeHtml(x.descricao)} · vencimento ${dataBR(x.vencimento)}<br>Saldo atual: <strong>${dinheiro(saldoContaReceber(x))}</strong>`;
  $('modalBaixa').showModal();
}

async function salvarBaixa(ev) {
  ev.preventDefault();
  const conta = contasReceber.find((x) => x.id === $('baixaContaId').value); if (!conta) return;
  const valor = numero($('baixaValor').value); const saldo = saldoContaReceber(conta);
  if (valor <= 0 || valor > saldo + 0.01) return alert(`O valor deve ser maior que zero e não pode ultrapassar o saldo de ${dinheiro(saldo)}.`);
  const payload = { conta_receber_id: conta.id, empresa_id: conta.empresa_id, cliente_id: conta.cliente_id, data_recebimento: $('baixaData').value, valor, forma_pagamento: $('baixaForma').value, referencia: $('baixaReferencia').value.trim() || null, observacao: $('baixaObservacao').value.trim() || null };
  if (modoLocal) {
    recebimentos.unshift({ id: uuidLocal(), ...payload, created_at: new Date().toISOString() });
    conta.valor_recebido = numero(conta.valor_recebido) + valor;
    conta.status = conta.valor_recebido + 0.009 >= totalContaReceber(conta) ? 'PAGO' : 'PARCIAL';
    salvarLocal();
  } else {
    const r = await supabaseClient.from('financeiro_recebimentos').insert(payload); if (r.error) return alert(`Erro ao registrar recebimento: ${r.error.message}`);
  }
  $('modalBaixa').close(); await carregarFinanceiro();
}

async function cancelarReceber(id) {
  const conta = contasReceber.find(x => String(x.id) === String(id));
  if (conta && contaDeContrato(conta)) {
    mostrarResultadoFinanceiro('Cancele a cobrança por meio do contrato, preservando os recebimentos e a conciliação.', true);
    return;
  }
  if (!confirm('Cancelar esta conta a receber? O histórico de recebimentos será preservado.')) return;
  if (modoLocal) { const x = contasReceber.find((c) => c.id === id); if (x) x.status = 'CANCELADO'; salvarLocal(); }
  else { const r = await supabaseClient.from('financeiro_contas_receber').update({ status: 'CANCELADO' }).eq('id', id); if (r.error) return alert(r.error.message); }
  await carregarFinanceiro();
}

function abrirPagar(id = null) {
  $('formPagar').reset(); $('pagarId').value = ''; $('pagarCompetencia').value = hojeISO().slice(0, 7) + '-01'; $('pagarVencimento').value = hojeISO();
  if (perfilUsuarioLogado === 'USUARIO' && empresaUsuarioLogado) $('pagarEmpresa').value = empresaUsuarioLogado;
  if (id) {
    const x = contasPagar.find((c) => c.id === id); if (!x) return;
    $('tituloModalPagar').textContent = 'Editar despesa'; $('pagarId').value = x.id; $('pagarEmpresa').value = x.empresa_id; $('pagarCategoria').value = x.categoria_id || '';
    $('pagarFornecedor').value = x.fornecedor_nome || ''; $('pagarCpfCnpj').value = x.fornecedor_cpf_cnpj || ''; $('pagarDocumento').value = x.numero_documento || ''; $('pagarDescricao').value = x.descricao || '';
    $('pagarCompetencia').value = x.competencia || ''; $('pagarVencimento').value = x.vencimento || ''; $('pagarValor').value = numero(x.valor_original).toFixed(2); $('pagarFormaPrevista').value = x.forma_prevista || ''; $('pagarObservacao').value = x.observacao || '';
  } else $('tituloModalPagar').textContent = 'Nova despesa';
  $('modalPagar').showModal();
}

async function salvarPagar(ev) {
  ev.preventDefault(); const id = $('pagarId').value;
  const payload = { empresa_id: $('pagarEmpresa').value, categoria_id: $('pagarCategoria').value || null, fornecedor_nome: $('pagarFornecedor').value.trim(), fornecedor_cpf_cnpj: $('pagarCpfCnpj').value.trim() || null, numero_documento: $('pagarDocumento').value.trim() || null, descricao: $('pagarDescricao').value.trim(), competencia: $('pagarCompetencia').value || null, vencimento: $('pagarVencimento').value, valor_original: numero($('pagarValor').value), forma_prevista: $('pagarFormaPrevista').value || null, observacao: $('pagarObservacao').value.trim() || null };
  if (modoLocal) {
    if (id) Object.assign(contasPagar.find((x) => x.id === id), payload, { updated_at: new Date().toISOString() });
    else contasPagar.push({ id: uuidLocal(), ...payload, valor_pago: 0, status: 'ABERTO', created_at: new Date().toISOString() });
    salvarLocal();
  } else {
    const r = id ? await supabaseClient.from('financeiro_contas_pagar').update(payload).eq('id', id) : await supabaseClient.from('financeiro_contas_pagar').insert(payload);
    if (r.error) return alert(`Erro ao salvar: ${r.error.message}`);
  }
  $('modalPagar').close(); await carregarFinanceiro();
}

function abrirPagamento(id) {
  const x = contasPagar.find((c) => c.id === id); if (!x) return;
  $('formPagamento').reset(); $('pagamentoContaId').value = id; $('pagamentoData').value = hojeISO(); $('pagamentoValor').value = numero(x.valor_original).toFixed(2);
  $('resumoPagamento').innerHTML = `<strong>${escapeHtml(x.fornecedor_nome)}</strong><br>${escapeHtml(x.descricao)} · vencimento ${dataBR(x.vencimento)}<br>Valor: <strong>${dinheiro(x.valor_original)}</strong>`;
  $('modalPagamento').showModal();
}

async function salvarPagamento(ev) {
  ev.preventDefault(); const id = $('pagamentoContaId').value; const x = contasPagar.find((c) => c.id === id); if (!x) return;
  const payload = { valor_pago: numero($('pagamentoValor').value), data_pagamento: $('pagamentoData').value, forma_pagamento: $('pagamentoForma').value, referencia_pagamento: $('pagamentoReferencia').value.trim() || null, observacao: [$('pagamentoObservacao').value.trim(), x.observacao].filter(Boolean).join('\n'), status: 'PAGO' };
  if (payload.valor_pago <= 0) return alert('Informe um valor pago válido.');
  if (modoLocal) { Object.assign(x, payload); salvarLocal(); }
  else { const r = await supabaseClient.from('financeiro_contas_pagar').update(payload).eq('id', id); if (r.error) return alert(`Erro ao registrar pagamento: ${r.error.message}`); }
  $('modalPagamento').close(); await carregarFinanceiro();
}

async function cancelarPagar(id) {
  if (!confirm('Cancelar esta conta a pagar?')) return;
  if (modoLocal) { const x = contasPagar.find((c) => c.id === id); if (x) x.status = 'CANCELADO'; salvarLocal(); }
  else { const r = await supabaseClient.from('financeiro_contas_pagar').update({ status: 'CANCELADO' }).eq('id', id); if (r.error) return alert(r.error.message); }
  await carregarFinanceiro();
}

function configurarTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => ativarTab(btn.dataset.tab)));
  document.querySelectorAll('[data-ir-tab]').forEach((btn) => btn.addEventListener('click', () => ativarTab(btn.dataset.irTab)));
}

function ativarTab(nome) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === nome));
  document.querySelectorAll('.tab-painel').forEach((p) => p.classList.toggle('active', p.id === `tab-${nome}`));
  if (nome === 'fluxo') renderFluxo(); if (nome === 'relatorios') renderRelatorio();
}

function configurarModais() {
  document.querySelectorAll('[data-fechar]').forEach((b) => b.onclick = () => $(b.dataset.fechar).close());
  document.querySelectorAll('.modal-financeiro').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
}

function configurarEventos() {
  $('btnSair').onclick = async (e) => { e.preventDefault(); await supabaseClient.auth.signOut(); window.location.href = 'index.html'; };
  $('btnNovoReceber').onclick = () => abrirReceber(); $('btnNovoReceber2').onclick = () => abrirReceber(); $('btnNovoPagar').onclick = () => abrirPagar();
  $('formReceber').addEventListener('submit', salvarReceber); $('formBaixa').addEventListener('submit', salvarBaixa); $('formPagar').addEventListener('submit', salvarPagar); $('formPagamento').addEventListener('submit', salvarPagamento);
  $('btnAtualizarTudo').onclick = carregarFinanceiro;
  $('btnAtualizarContratosFinanceiro').onclick = carregarFinanceiro;
  $('pesquisaContratosFinanceiro').addEventListener('input', renderContratosFinanceiro);
  $('situacaoContratosFinanceiro').addEventListener('change', renderContratosFinanceiro);
  $('btnRemoverFiltroContrato').onclick = limparFiltroContratoReceber;
  $('btnAplicarFiltros').onclick = () => { guardarFiltrosFinanceiro(); renderTudo(); };
  $('btnLimparFiltros').onclick = () => {
    $('filtroEmpresa').value = perfilUsuarioLogado === 'USUARIO' && empresaUsuarioLogado ? String(empresaUsuarioLogado) : '';
    $('filtroInicio').value = '';
    $('filtroFim').value = '';
    $('pesquisaReceber').value = '';
    $('statusReceber').value = '';
    $('pesquisaPagar').value = '';
    $('statusPagar').value = '';
    guardarFiltrosFinanceiro();
    renderTudo();
    mostrarResultadoFinanceiro('Filtros limpos: exibindo lançamentos de todos os períodos disponíveis.');
  };
  $('filtroEmpresa').addEventListener('change', guardarFiltrosFinanceiro);
  $('filtroInicio').addEventListener('change', guardarFiltrosFinanceiro);
  $('filtroFim').addEventListener('change', guardarFiltrosFinanceiro);
  $('pesquisaReceber').addEventListener('input', renderContasReceber); $('statusReceber').addEventListener('change', renderContasReceber); $('pesquisaPagar').addEventListener('input', renderContasPagar); $('statusPagar').addEventListener('change', renderContasPagar);
  $('btnExportarRecebimentos').onclick = () => exportarTabelaCSV('recebimentos.csv', [['Data','Empresa','Cliente','Forma','Valor','Referência'], ...recebimentosFiltrados().map((x) => [dataBR(x.data_recebimento), nomeEmpresa(x.empresa_id), nomeCliente(x.cliente_id), x.forma_pagamento, x.valor, x.referencia || ''])]);
  $('btnExportarFluxo').onclick = () => exportarTabelaHtml('tabelaFluxo', 'fluxo_caixa.csv');
  $('btnExportarRelatorio').onclick = () => exportarTabelaHtml('tabelaRelatorio', `relatorio_${relatorioAtual}.csv`, 'cabecalhoRelatorio');
  document.querySelectorAll('[data-relatorio]').forEach((b) => b.onclick = () => { relatorioAtual = b.dataset.relatorio; document.querySelectorAll('[data-relatorio]').forEach((x) => x.classList.toggle('active', x === b)); renderRelatorio(); });
}

function exportarTabelaCSV(nome, linhas) {
  const csv = linhas.map((l) => l.map((v) => `"${String(v ?? '').replaceAll('"','""')}"`).join(';')).join('\r\n');
  baixarBlob(nome, '\ufeff' + csv, 'text/csv;charset=utf-8');
}

function exportarTabelaHtml(tbodyId, nome, theadId = null) {
  const tbody = $(tbodyId); const table = tbody.closest('table'); const headers = theadId ? [...$(theadId).querySelectorAll('th')] : [...table.querySelectorAll('thead th')];
  const linhas = [headers.map((x) => x.innerText.trim()), ...[...tbody.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()))];
  exportarTabelaCSV(nome, linhas);
}

function baixarBlob(nome, conteudo, tipo) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo })); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function ultimosMeses(qtd) {
  const out = []; const base = new Date(); base.setDate(1);
  for (let i = qtd - 1; i >= 0; i--) { const d = new Date(base); d.setMonth(base.getMonth() - i); const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const label = d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}); out.push({key,label}); }
  return out;
}
function mesKey(data) { return data ? String(data).slice(0,7) : ''; }
function diasEntre(a,b) { return Math.max(0, Math.floor((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`))/86400000)); }
function escapeHtml(v) { return String(v ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function iniciar() {
  configurarTabs(); configurarModais(); configurarEventos();
  const sessao = await validarSessao(); if (!sessao) return;
  await carregarCadastros();
  restaurarFiltrosFinanceiro();
  await detectarFinanceiroBanco();
  await carregarFinanceiro();
}

iniciar();
