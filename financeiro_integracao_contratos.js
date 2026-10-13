/*
  DESTAC PROPAGANDAS - PONTE CONTRATOS -> FINANCEIRO
  -------------------------------------------------
  Este arquivo NÃO é carregado pela tela financeiro.html neste momento.
  Ele deixa pronta a função que será chamada depois de salvar/ativar um contrato.

  Regra futura sugerida:
    1) contrato salvo/ativo
    2) definir quantidade de parcelas e primeiro vencimento
    3) chamar criarParcelasFinanceirasDoContrato(...)
    4) cada parcela nasce com origem='CONTRATO' e contrato_id preenchido

  IMPORTANTE: a função é idempotente por contrato: antes de gerar, verifica
  se já existem contas a receber com o mesmo contrato_id.
*/

async function criarParcelasFinanceirasDoContrato({
  supabaseClient,
  contrato,
  quantidadeParcelas,
  primeiroVencimento,
  valorParcela = null,
  formaPrevista = null,
  descricao = null
}) {
  if (!supabaseClient) throw new Error('supabaseClient é obrigatório.');
  if (!contrato?.id || !contrato?.empresa_id || !contrato?.cliente_id) {
    throw new Error('Contrato sem id, empresa_id ou cliente_id.');
  }
  if (!quantidadeParcelas || quantidadeParcelas < 1) throw new Error('Quantidade de parcelas inválida.');
  if (!primeiroVencimento) throw new Error('Primeiro vencimento é obrigatório.');

  const existente = await supabaseClient
    .from('financeiro_contas_receber')
    .select('id')
    .eq('contrato_id', contrato.id)
    .limit(1);

  if (existente.error) throw existente.error;
  if ((existente.data || []).length) {
    return { criado: false, motivo: 'JA_GERADO', quantidade: 0 };
  }

  const totalContrato = Number(
    contrato.valor_total ??
    contrato.valor_contrato ??
    (Number(contrato.valor_mensal || 0) * quantidadeParcelas)
  );

  const valor = valorParcela != null
    ? Number(valorParcela)
    : Math.round((totalContrato / quantidadeParcelas) * 100) / 100;

  const parcelas = [];
  for (let i = 0; i < quantidadeParcelas; i++) {
    const d = new Date(`${primeiroVencimento}T12:00:00`);
    d.setMonth(d.getMonth() + i);
    const vencimento = d.toISOString().slice(0, 10);

    parcelas.push({
      empresa_id: contrato.empresa_id,
      cliente_id: contrato.cliente_id,
      contrato_id: contrato.id,
      numero_documento: contrato.numero_contrato || null,
      descricao: descricao || `Contrato ${contrato.numero_contrato || ''}`.trim(),
      parcela: i + 1,
      total_parcelas: quantidadeParcelas,
      competencia: vencimento.slice(0, 7) + '-01',
      vencimento,
      valor_original: valor,
      forma_prevista: formaPrevista,
      status: 'ABERTO',
      origem: 'CONTRATO'
    });
  }

  // Ajuste de centavos na última parcela para fechar exatamente o total do contrato.
  if (valorParcela == null && totalContrato > 0) {
    const soma = parcelas.reduce((s, p) => s + Number(p.valor_original), 0);
    parcelas[parcelas.length - 1].valor_original = Math.round((Number(parcelas.at(-1).valor_original) + (totalContrato - soma)) * 100) / 100;
  }

  const resultado = await supabaseClient
    .from('financeiro_contas_receber')
    .insert(parcelas)
    .select('id,parcela,vencimento,valor_original');

  if (resultado.error) throw resultado.error;
  return { criado: true, motivo: 'OK', quantidade: resultado.data.length, parcelas: resultado.data };
}

window.DestacFinanceiro = window.DestacFinanceiro || {};
window.DestacFinanceiro.criarParcelasFinanceirasDoContrato = criarParcelasFinanceirasDoContrato;
