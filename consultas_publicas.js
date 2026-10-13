/* Consultas públicas isoladas: não leem nem alteram tabelas Supabase. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const texto = (v) => (v === null || v === undefined || v === '' ? 'Não informado' : String(v));
  const digitos = (v) => String(v || '').replace(/\D/g, '');
  const normalizarCnpj = (v) => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const numero = (v) => String(v ?? '').trim();
  const dinheiro = (v) => {
    const n = Number(v);
    return v === null || v === undefined || v === '' || !Number.isFinite(n) ? 'Não informado' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  const dataBR = (v) => {
    if (!v) return 'Não informado';
    const s = String(v).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
    return String(v);
  };
  const simNao = (v) => v === true ? 'Sim' : v === false ? 'Não' : 'Não informado';
  const formataCnpj = (v) => {
    const s = normalizarCnpj(v);
    return s.length === 14 ? `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}` : s;
  };

  // Dígitos verificadores do CNPJ, com suporte à representação alfanumérica.
  function cnpjValido(v) {
    const s = normalizarCnpj(v);
    if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(s) || /^([0-9A-Z])\1{13}$/.test(s)) return false;
    function dv(base, pesos) {
      const soma = Array.from(base).reduce((acc, ch, i) => acc + (ch.charCodeAt(0) - 48) * pesos[i], 0);
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    }
    return dv(s.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]) === Number(s[12]) &&
      dv(s.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]) === Number(s[13]);
  }

  function aviso(id, mensagem, tipo = '') {
    const e = $(id);
    if (!e) return;
    e.hidden = !mensagem;
    e.className = `consulta-mensagem ${tipo}`;
    e.textContent = mensagem || '';
  }
  async function requisitarJson(url, ms = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { method: 'GET', signal: controller.signal, headers: { 'Accept': 'application/json' } });
      if (!response.ok) {
        if (response.status === 404) throw new Error('Não encontrado na base de dados pública. Confira o número/endereço e tente novamente.');
        if (response.status === 429) throw new Error('Limite de consultas do serviço atingido. Aguarde e tente novamente.');
        if (response.status === 400) throw new Error('Os dados informados não são aceitos pelo serviço. Verifique e tente novamente.');
        throw new Error(`Serviço indisponível ou com falha (HTTP ${response.status}). Tente novamente.`);
      }
      return await response.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('A consulta demorou demais. Aguarde e tente novamente.');
      if (err instanceof TypeError) throw new Error('Não foi possível acessar a API. Verifique a internet ou as restrições do navegador/rede e tente novamente.');
      throw err;
    } finally { clearTimeout(timeout); }
  }
  async function copiar(v, rotulo = 'Conteúdo') {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Recurso de cópia não disponível neste navegador.');
      await navigator.clipboard.writeText(String(v));
      return `${rotulo} copiado!`;
    } catch (e) { return `Não foi possível copiar automaticamente. ${e.message || ''}`; }
  }
  function criar(tag, cls, value, p) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value !== undefined) e.textContent = texto(value);
    if (p) p.appendChild(e);
    return e;
  }
  function grupo(root, titulo, campos) {
    const sec = criar('section', 'dados-grupo', undefined, root);
    criar('h3', '', titulo, sec);
    const grid = criar('div', 'dados-grid', undefined, sec);
    campos.forEach(([nome, valor, estender]) => {
      const dado = criar('div', 'dado' + (estender ? ' dado-largura' : ''), undefined, grid);
      criar('span', 'campo-titulo', nome, dado);
      criar('div', 'campo-valor', texto(valor), dado);
    });
    return sec;
  }
  function grupoLista(root, titulo, itens, montar) {
    const sec = criar('section', 'dados-grupo', undefined, root);
    criar('h3', '', titulo, sec);
    const lista = criar('div', 'dados-lista', undefined, sec);
    if (!Array.isArray(itens) || !itens.length) criar('p', 'dados-item', 'Não informado', lista);
    else itens.forEach((e, i) => {
      const d = criar('div', 'dados-item', undefined, lista);
      const item = montar(e, i);
      criar('strong', '', item[0], d);
      if (item[1]) criar('div', '', item[1], d);
    });
  }
  function formatarEndereco(d) {
    const primeira = [d.descricao_tipo_de_logradouro, d.logradouro, d.numero].filter(Boolean).join(' ').trim();
    return [primeira, d.complemento, d.bairro, [d.municipio, d.uf].filter(Boolean).join(' / '), d.cep ? `CEP ${d.cep}` : ''].filter(Boolean).join(' — ') || 'Não informado';
  }
  function situacao(d) {
    const s = d.descricao_situacao_cadastral;
    if (s) return s;
    return ({1:'NULA',2:'ATIVA',3:'SUSPENSA',4:'INAPTA',8:'BAIXADA'})[d.situacao_cadastral] || 'NÃO INFORMADA';
  }
  function renderizarCnpj(d, consultado) {
    const s = situacao(d);
    $('empresaRazao').textContent = texto(d.razao_social);
    $('empresaFantasia').textContent = d.nome_fantasia ? `Nome fantasia: ${d.nome_fantasia}` : `CNPJ: ${formataCnpj(d.cnpj || consultado)}`;
    $('empresaSituacao').textContent = `Situação: ${s}`;
    $('empresaSituacao').className = 'situacao ' + (s.toUpperCase() === 'ATIVA' ? 'ativa' : '');
    $('validacaoCnpj').textContent = `✓ CNPJ ${formataCnpj(consultado)}: dígitos verificadores válidos. ${s.toUpperCase() === 'ATIVA' ? 'Empresa com situação cadastral ATIVA na base consultada.' : 'Atenção à situação cadastral informada.'}`;
    const root = $('dadosCnpj');
    root.replaceChildren();
    grupo(root, 'Identificação e situação cadastral', [
      ['CNPJ', formataCnpj(d.cnpj || consultado)], ['Razão social', d.razao_social],
      ['Nome fantasia', d.nome_fantasia], ['Situação cadastral', s],
      ['Data da situação', dataBR(d.data_situacao_cadastral)], ['Motivo da situação', d.descricao_motivo_situacao_cadastral || d.motivo_situacao_cadastral],
      ['Início da atividade', dataBR(d.data_inicio_atividade)], ['Matriz ou filial', d.descricao_identificador_matriz_filial || ({1:'Matriz',2:'Filial'}[d.identificador_matriz_filial])],
      ['Natureza jurídica', d.natureza_juridica], ['Porte', d.porte || d.descricao_porte],
      ['Capital social', dinheiro(d.capital_social)], ['Situação especial', d.situacao_especial],
      ['Simples Nacional', simNao(d.opcao_pelo_simples)], ['MEI', simNao(d.opcao_pelo_mei)],
      ['Data de opção pelo Simples', dataBR(d.data_opcao_pelo_simples)], ['Data de exclusão do Simples', dataBR(d.data_exclusao_do_simples)],
      ['Data de opção pelo MEI', dataBR(d.data_opcao_pelo_mei)], ['Data de exclusão do MEI', dataBR(d.data_exclusao_do_mei)]
    ]);
    grupo(root, 'Endereço e contato', [
      ['Endereço completo', formatarEndereco(d), true],
      ['Tipo de logradouro', d.descricao_tipo_de_logradouro], ['Logradouro', d.logradouro],
      ['Número', d.numero], ['Complemento', d.complemento], ['Bairro', d.bairro],
      ['Município', d.municipio], ['Estado (UF)', d.uf], ['CEP', d.cep],
      ['E-mail', d.email], ['Telefone 1', d.ddd_telefone_1], ['Telefone 2', d.ddd_telefone_2],
      ['Fax', d.ddd_fax], ['País', d.pais || 'Brasil']
    ]);
    grupo(root, 'Atividade econômica principal', [
      ['CNAE principal', d.cnae_fiscal], ['Descrição', d.cnae_fiscal_descricao, true]
    ]);
    grupoLista(root, 'Atividades secundárias (CNAEs)', d.cnaes_secundarios, e => [e.codigo || 'CNAE não informado', e.descricao || '']);
    grupoLista(root, 'Quadro de sócios e administradores (QSA)', d.qsa, e => [e.nome_socio || 'Nome não informado', [e.qualificacao_socio ? `Qualificação: ${e.qualificacao_socio}` : '', e.data_entrada_sociedade ? `Entrada: ${dataBR(e.data_entrada_sociedade)}` : '', e.nome_representante_legal ? `Representante: ${e.nome_representante_legal}` : ''].filter(Boolean).join(' • ')]);
    if (Array.isArray(d.regime_tributario) && d.regime_tributario.length)
      grupoLista(root, 'Histórico de regimes tributários', d.regime_tributario, e => [e.ano || 'Ano não informado', [e.forma_de_tributacao, e.quantidade_de_escrituracoes != null ? `Escriturações: ${e.quantidade_de_escrituracoes}` : ''].filter(Boolean).join(' • ')]);
    $('dadosJson').textContent = JSON.stringify(d, null, 2);
    $('resultadoCnpj').hidden = false;
  }
  function iniciarCnpj() {
    let ultimo = null;
    $('cnpjBusca').addEventListener('input', (event) => {
      const e = event.target;
      const raw = normalizarCnpj(e.value);
      e.value = raw.length <= 14 && /\d/.test(raw) ? formataCnpj(raw) : raw;
    });
    $('formCnpj').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      $('resultadoCnpj').hidden = true;
      ultimo = null;
      const cnpj = normalizarCnpj($('cnpjBusca').value);
      if (!cnpjValido(cnpj)) {
        aviso('mensagemCnpj', 'CNPJ inválido: confira os 14 caracteres e os dígitos verificadores.', 'erro');
        return;
      }
      const btn = $('btnConsultarCnpj'); btn.disabled = true; btn.textContent = 'Consultando...';
      aviso('mensagemCnpj', 'Número validado. Consultando os dados públicos da empresa...');
      try {
        const d = await requisitarJson(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, 22000);
        if (!d || !d.cnpj) throw new Error('O serviço retornou dados incompletos. Tente novamente.');
        ultimo = d;
        renderizarCnpj(d, cnpj);
        aviso('mensagemCnpj', `Consulta concluída para ${formataCnpj(cnpj)}.`, 'sucesso');
      } catch (e) { aviso('mensagemCnpj', e.message || 'Falha ao consultar CNPJ.', 'erro'); }
      finally { btn.disabled = false; btn.textContent = 'Consultar CNPJ'; }
    });
    $('btnCopiarJson').addEventListener('click', async () => {
      if (!ultimo) return;
      aviso('mensagemCnpj', await copiar(JSON.stringify(ultimo, null, 2), 'JSON'), 'sucesso');
    });
    $('btnCopiarCnpj').addEventListener('click', async () => {
      if (!ultimo) return;
      const d = ultimo;
      const resumo = [
        `CNPJ: ${formataCnpj(d.cnpj)}`, `Razão social: ${texto(d.razao_social)}`, `Nome fantasia: ${texto(d.nome_fantasia)}`,
        `Situação cadastral: ${situacao(d)}`, `Início da atividade: ${dataBR(d.data_inicio_atividade)}`,
        `Natureza jurídica: ${texto(d.natureza_juridica)}`, `Porte: ${texto(d.porte || d.descricao_porte)}`,
        `Capital social: ${dinheiro(d.capital_social)}`, `CNAE: ${texto(d.cnae_fiscal)} - ${texto(d.cnae_fiscal_descricao)}`,
        `Endereço: ${formatarEndereco(d)}`, `E-mail: ${texto(d.email)}`, `Telefone: ${texto(d.ddd_telefone_1)}`
      ].join('\n');
      aviso('mensagemCnpj', await copiar(resumo, 'Resumo'), 'sucesso');
    });
  }

  const UFS = {
    AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará', PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins'
  };
  function normalizaTexto(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function iniciarCep() {
    const uf = $('cepUf');
    for (const [sigla, nome] of Object.entries(UFS).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'))) {
      const opt = document.createElement('option'); opt.value = sigla; opt.textContent = `${sigla} — ${nome}`; uf.appendChild(opt);
    }
    // Para o estado da sede, é apenas uma conveniência: o usuário pode alterar.
    uf.value = 'PR';
    let resultadoOriginal = [];
    $('formCep').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      $('resultadoCep').hidden = true;
      const estado = uf.value;
      const cidade = $('cepCidade').value.trim();
      const rua = $('cepRua').value.trim();
      const bairro = $('cepBairro').value.trim();
      if (!estado || cidade.length < 3 || rua.length < 3) {
        aviso('mensagemCep', 'Informe estado, cidade e rua, com pelo menos 3 caracteres para cidade e rua.', 'erro'); return;
      }
      const btn = $('btnBuscarCep'); btn.disabled = true; btn.textContent = 'Pesquisando...';
      aviso('mensagemCep', 'Procurando CEPs para o endereço informado...');
      const url = `https://viacep.com.br/ws/${encodeURIComponent(estado)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`;
      try {
        const dados = await requisitarJson(url, 18000);
        if (!Array.isArray(dados) || !dados.length || dados.erro) throw new Error('Nenhum CEP encontrado. Confira o nome da rua, a cidade e o estado.');
        resultadoOriginal = dados;
        const filtrados = bairro ? dados.filter(d => normalizaTexto(d.bairro).includes(normalizaTexto(bairro))) : dados;
        const lista = $('listaCeps'); lista.replaceChildren();
        $('tituloResultadosCep').textContent = `${filtrados.length} CEP${filtrados.length === 1 ? '' : 's'} encontrado${filtrados.length === 1 ? '' : 's'}`;
        $('subtituloResultadosCep').textContent = `${rua} — ${cidade}/${estado}. ${bairro ? 'Filtro de bairro aplicado.' : 'Confira o bairro e o trecho da via.'}`;
        if (!filtrados.length) {
          aviso('mensagemCep', `A API retornou ${dados.length} endereço(s), mas nenhum corresponde ao bairro “${bairro}”. Pesquise novamente sem o bairro.`, 'erro'); return;
        }
        filtrados.forEach(d => {
          const item = criar('article', 'cep-item', undefined, lista);
          const inner = criar('div', '', undefined, item);
          criar('h3', '', d.cep || 'CEP não informado', inner);
          criar('p', '', [d.logradouro, d.complemento].filter(Boolean).join(' — ') || 'Logradouro não informado', inner);
          criar('p', '', [d.bairro, d.localidade, d.uf].filter(Boolean).join(' • '), inner);
          criar('div', 'cep-sec', `Código IBGE: ${d.ibge || '-'}${$('cepNumero').value.trim() ? ' • Número informado: ' + $('cepNumero').value.trim() + ' (não validado)' : ''}`, inner);
          const b = criar('button', 'consulta-btn btn-secundario', 'Copiar CEP', item); b.type = 'button';
          b.addEventListener('click', async () => aviso('mensagemCep', await copiar(d.cep || '', 'CEP'), 'sucesso'));
        });
        $('resultadoCep').hidden = false;
        aviso('mensagemCep', `${filtrados.length} resultado(s) encontrado(s). Confira o CEP correto na lista.`, 'sucesso');
      } catch(e) { aviso('mensagemCep', e.message || 'Não foi possível consultar o CEP.', 'erro'); }
      finally { btn.disabled = false; btn.textContent = 'Pesquisar CEP'; }
    });
  }
  if (document.body?.dataset.consulta === 'cnpj') iniciarCnpj();
  if (document.body?.dataset.consulta === 'cep') iniciarCep();
})();
