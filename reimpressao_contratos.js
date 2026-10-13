/**
 * DESTAC — reimpressão de contratos já salvos.
 * Utiliza os dados carregados pela consulta; não modifica o Supabase.
 * Os botões PDF/Word compartilham o mesmo HTML de contrato.
 */
(function () {
  'use strict';

  const htmlSeguro = valor => String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const texto = valor => htmlSeguro(valor || '-');
  const dataBR = valor => {
    if (!valor) return '-';
    const p = String(valor).substring(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(valor);
  };
  const moeda = valor => valor === null || valor === undefined || valor === ''
    ? '-'
    : Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const endereco = objeto => [
    objeto.endereco, objeto.numero, objeto.complemento,
    objeto.bairro, objeto.cidade, objeto.estado
  ].filter(Boolean).join(', ');
  const telefones = objeto => [objeto.telefone, objeto.celular_whatsapp]
    .filter(Boolean).join(' / ');

  function dataPorExtenso(valor, cidade) {
    if (!valor) return '';
    const dt = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return dataBR(valor);
    const mes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${cidade || 'Cascavel'}, ${String(dt.getDate()).padStart(2, '0')} de ${mes[dt.getMonth()]} de ${dt.getFullYear()}.`;
  }

  function nomeArquivo({ contrato, cliente }, extensao) {
    const seguro = s => String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
    return `${seguro(contrato.numero_contrato) || 'SEM_NUMERO'}_${seguro(cliente.nome_fantasia || cliente.razao_social) || 'CLIENTE'}.${extensao}`;
  }

  function tabelaHorarios(horarios, colunas) {
    if (!Array.isArray(horarios) || !horarios.length) return '';
    const linhas = [];
    for (let i = 0; i < horarios.length; i += colunas) {
      const parte = horarios.slice(i, i + colunas);
      const celulas = parte.map(h => `<td width="${Math.floor(100 / colunas)}%" style="border:1px solid #222;text-align:center;padding:5px 3px;font-size:11px;">${htmlSeguro(h)}</td>`).join('');
      linhas.push(`<tr>${celulas}${'<td style="border:1px solid #222;"></td>'.repeat(colunas - parte.length)}</tr>`);
    }
    return `<table class="grade-horarios" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed;">${linhas.join('')}</table>`;
  }

  function resumoValoresContratuais(contrato) {
    const reais = v => Number.isFinite(Number(v)) && v !== null && v !== ''
      ? Number(v).toLocaleString('pt-BR', {style:'currency',currency:'BRL'}) : '—';
    const modo = String(contrato.modalidade_contrato || 'FINANCEIRO').toUpperCase();
    const baseTotal = Number(contrato.valor_total_contrato);
    const meses = Number(contrato.valor_mensal) > 0 && baseTotal > 0
      ? Math.max(1, Math.round(baseTotal / Number(contrato.valor_mensal))) : 1;
    const mensal = Number(contrato.valor_mensal) || 0;
    const total = baseTotal > 0 ? baseTotal : mensal * meses;
    if (modo === 'PERMUTA') return [['Valor mensal (permuta)', reais(mensal)], ['Valor total (permuta)', reais(total)]];
    const pctDesc = Number(contrato.percentual_desconto_vista || 0);
    const descInferido = modo === 'FINANCEIRO' && contrato.condicao_pagamento === 'AVISTA'
      && Number(contrato.valor_vista) > 0 && Number(contrato.valor_vista) < Number(contrato.valor_financeiro ?? total);
    const percentualParcelado = Number(contrato.percentual_desconto_parcelado || 0);
    const comDescontoParcelado = modo === 'FINANCEIRO' && contrato.condicao_pagamento === 'PARCELADO' && percentualParcelado > 0;
    const comDesconto = (modo === 'FINANCEIRO' && contrato.condicao_pagamento === 'AVISTA' && (pctDesc > 0 || descInferido)) || comDescontoParcelado;
    const linhas = [['Valor mensal', reais(mensal)], ['Valor total', reais(total)]];
    if (comDesconto) {
      const vista = Number(contrato.valor_vista);
      const totalDesc = comDescontoParcelado ? Math.round(Number(contrato.valor_financeiro ?? total)*(1-percentualParcelado/100)*100)/100 : (vista > 0 ? vista : total * (1 - pctDesc/100));
      const mensalDesc = meses > 0 ? Math.round(totalDesc * 100 / meses)/100 : totalDesc;
      linhas.splice(1, 0, ['Valor mensal com desconto', reais(mensalDesc)]);
      linhas.push(['Valor total com desconto', reais(totalDesc)]);
    }
    if (modo === 'MISTO') {
      const valorPermuta = Number(contrato.valor_permuta || 0);
      const pct = contrato.percentual_permuta != null
        ? Number(contrato.percentual_permuta)
        : total > 0 ? valorPermuta*100/total : 0;
      const percentual = Number.isFinite(pct) ? pct.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%' : '—';
      linhas.push(['Permuta', percentual], ['Valor em permuta', reais(valorPermuta)],
        ['Valor em dinheiro', reais(contrato.valor_financeiro ?? Math.max(0,total-valorPermuta))]);
    }
    return linhas;
  }

  function camposComplementares(c) {
    const campos = [
      ['Data da assinatura', c.data_assinatura ? dataBR(c.data_assinatura) : null],
      ['Responsável pela empresa', c.responsavel_empresa],
      ['Responsável pelo cliente', c.responsavel_cliente],
      ['Modalidade do contrato', c.modalidade_contrato === 'MISTO' ? 'Misto (permuta + financeiro)' : c.modalidade_contrato === 'PERMUTA' ? 'Somente permuta' : c.condicao_pagamento === 'AVISTA' ? (Number(c.percentual_desconto_vista || 0)>0 ? 'À vista com desconto' : 'À vista') : Number(c.percentual_desconto_parcelado || 0)>0 ? 'Parcelado com desconto' : (c.condicao_pagamento === 'PARCELADO' &&
        Number(c.percentual_desconto_parcelado || 0) === 0 &&
        Number(c.valor_entrada || 0) === 0 &&
        Number(c.quantidade_parcelas) > 0 &&
        Number(c.quantidade_parcelas) ===
          (Number(c.valor_mensal)>0 ? Math.round(Number(c.valor_total_contrato)/Number(c.valor_mensal)) : 0) ? 'Contrato Mensal — sem desconto' : 'Financeiro parcelado')],
      ['Desconto à vista (%)', c.condicao_pagamento === 'AVISTA' && c.modalidade_contrato !== 'PERMUTA' && Number(c.percentual_desconto_vista || 0)>0 ? `${c.percentual_desconto_vista}%` : null],
      ['Desconto no parcelamento (%)', c.condicao_pagamento === 'PARCELADO' && Number(c.percentual_desconto_parcelado || 0)>0 ? `${c.percentual_desconto_parcelado}%` : null],
      ['Percentual de permuta', c.modalidade_contrato === 'MISTO' ? `${c.percentual_permuta != null ? Number(c.percentual_permuta).toLocaleString('pt-BR',{maximumFractionDigits:2}) : Number(c.valor_total_contrato)>0 ? (Number(c.valor_permuta)*100/Number(c.valor_total_contrato)).toLocaleString('pt-BR',{maximumFractionDigits:2}) : '—'}%` : null],
      ['Valor da permuta', Number(c.valor_permuta)>0 ? moeda(c.valor_permuta) : null],
      ['Descrição da permuta', c.descricao_permuta],
      ['Valor financeiro comercial', c.modalidade_contrato === 'PERMUTA' ? moeda(0) : moeda(c.valor_financeiro ?? c.valor_total_contrato)],
      ['Condição de cobrança', c.modalidade_contrato === 'PERMUTA' ? 'Sem cobrança monetária' : c.condicao_pagamento === 'AVISTA' ? (Number(c.percentual_desconto_vista || 0) > 0 ? 'À vista com desconto' : 'À vista') : Number(c.percentual_desconto_parcelado || 0)>0 ? 'Parcelado com desconto' : (c.condicao_pagamento === 'PARCELADO' &&
        Number(c.percentual_desconto_parcelado || 0) === 0 &&
        Number(c.valor_entrada || 0) === 0 &&
        Number(c.quantidade_parcelas) > 0 &&
        Number(c.quantidade_parcelas) ===
          (Number(c.valor_mensal)>0 ? Math.round(Number(c.valor_total_contrato)/Number(c.valor_mensal)) : 0) ? 'Contrato Mensal — sem desconto' : 'Parcelado')],
      ['Forma de pagamento', c.forma_pagamento],
      ['Dia do vencimento', c.dia_vencimento],
      ['Parcelas', c.quantidade_parcelas],
      ['Valor total comercial', c.valor_total_contrato != null ? moeda(c.valor_total_contrato) : null],
      ['Total a cobrar (somente financeiro)', c.modalidade_contrato === 'PERMUTA' ? moeda(0) : c.condicao_pagamento === 'AVISTA' ? moeda(c.valor_vista) : (c.valor_financeiro != null || c.valor_total_contrato != null ? moeda(Number(c.percentual_desconto_parcelado || 0)>0 ? Math.round(Number(c.valor_financeiro ?? c.valor_total_contrato)*(1-Number(c.percentual_desconto_parcelado)/100)*100)/100 : c.valor_financeiro ?? c.valor_total_contrato) : null)],
      ['Entrada', c.valor_entrada != null ? moeda(c.valor_entrada) : null],
      ['Vencimento da entrada', c.data_vencimento_entrada ? dataBR(c.data_vencimento_entrada) : null],
      ['Periodicidade', 'Mensal'],
      ['Primeiro vencimento', c.data_primeiro_vencimento ? dataBR(c.data_primeiro_vencimento) : null],
      ['Status da assinatura', c.status_assinatura],
      ['PDF assinado (URL)', c.pdf_url],
      ['Cancelado em', c.cancelado_em ? new Date(c.cancelado_em).toLocaleString('pt-BR') : null],
      ['Motivo do cancelamento', c.motivo_cancelamento]
    ].filter(([,v]) => v !== null && v !== undefined && v !== '');
    if (!campos.length && !c.observacoes) return '';
    // Duas colunas de texto dentro de UMA linha: evita que o Word
    // aumente artificialmente a altura ao criar várias linhas de tabela.
    const colunas = [campos.filter((_, i) => i % 2 === 0), campos.filter((_, i) => i % 2 !== 0)];
    const conteudoColuna = itens => itens.map(([titulo, valor]) =>
      `<div style="margin:0 0 2px;overflow-wrap:anywhere;"><strong>${htmlSeguro(titulo)}:</strong> ${htmlSeguro(valor)}</div>`
    ).join('');
    const linhaDupla = `<tr><td style="width:50%;vertical-align:top;padding:2px 6px;font-size:10px;">${conteudoColuna(colunas[0])}</td><td style="width:50%;vertical-align:top;padding:2px 6px;font-size:10px;">${conteudoColuna(colunas[1])}</td></tr>`;
    return `
      <tr class="linha-complementares"><td colspan="2" style="border:1px solid #222;padding:8px 10px;font-size:10px;">
        <div style="text-align:center;font-weight:800;font-size:13px;margin-bottom:7px;">Condições contratuais e financeiras</div>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;">${linhaDupla}</table>
        ${c.observacoes ? `<div style="margin-top:5px;white-space:pre-wrap;overflow-wrap:anywhere;"><strong>Observações adicionais:</strong> ${htmlSeguro(c.observacoes)}</div>` : ''}
      </td></tr>`;
  }

  function montarDocumento(dados, opcoes = {}) {
    const { contrato: c, empresa: e, cliente: k } = dados;
    if (!c?.numero_contrato || !e || !k) throw new Error('Dados do contrato incompletos.');
    const logo = /^https?:\/\/|^data:image\//i.test(e.logo_url || '')
      ? `<img src="${htmlSeguro(e.logo_url)}" crossorigin="anonymous" style="max-width:100%;max-height:85px;object-fit:contain;" alt="Logo">` : '';
    const dataAss = dataPorExtenso(
      c.data_assinatura || (c.created_at ? c.created_at.slice(0, 10) : c.data_inicio), e.cidade
    );
    const empresaEhDestac = /destac/i.test(
      `${e.nome_fantasia || ''} ${e.razao_social || ''}`
    );
    const assinanteEmpresa = c.assinante_empresa?.trim() ||
      (empresaEhDestac ? 'Celso Dondoni' : (e.responsavel || e.razao_social));
    const assinanteCliente = c.responsavel_cliente || k.contato || k.responsavel || '';
    const horariosFS = tabelaHorarios(c.horarios_sabado_domingo, 4);
    const horariosTQ = tabelaHorarios(c.horarios_terca_quinta, 6);
    return `<div class="contrato-exportacao">
      <table class="tabela-contrato" style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #222;">
        <tr class="linha-cabecalho">
          <td style="width:42%;padding:10px;border-top:1px solid #222;border-left:1px solid #222;border-bottom:1px solid #222;border-right:none;text-align:center;vertical-align:middle;">${logo}</td>
          <td style="width:58%;padding:10px;border-top:1px solid #222;border-right:1px solid #222;border-bottom:1px solid #222;border-left:none;text-align:right;vertical-align:middle;">
            <div style="font-size:16px;font-weight:800;line-height:1.15;">AUTORIZAÇÃO DE MÍDIA E SERVIÇOS</div>
            <div style="font-size:10px;font-weight:700;margin:4px 0;">Contrato nº ${texto(c.numero_contrato)}</div>
            <div style="font-size:11px;line-height:1.3;overflow-wrap:anywhere;">
              ${texto(e.razao_social)} - CNPJ: ${texto(e.cpf_cnpj)}<br>
              ${texto(endereco(e))}<br>
              Telefones ${texto(telefones(e))} - ${texto(e.cidade)}${e.estado ? '-' + htmlSeguro(e.estado) : ''}<br>
              E-mail: ${texto(e.email)}
            </div>
          </td>
        </tr>
        <tr class="linha-dados">
          <td style="width:48%;border:1px solid #222;padding:9px 12px;vertical-align:top;font-size:12px;line-height:1.35;overflow-wrap:anywhere;">
            <strong>Razão Social:</strong> ${texto(k.razao_social)}<br>
            <strong>CNPJ:</strong> ${texto(k.cpf_cnpj)}<br>
            <strong>Fantasia:</strong> ${texto(k.nome_fantasia)}<br>
            <strong>Endereço:</strong> ${texto(endereco(k))}<br>
            <strong>Telefone:</strong> ${texto(telefones(k))}<br>
            <strong>Contato:</strong> ${texto(k.contato || k.responsavel)}<br>
            <strong>E-mail:</strong> ${texto(k.email)}
          </td>
          <td style="width:52%;border:1px solid #222;padding:9px 12px;vertical-align:top;font-size:12px;line-height:1.35;overflow-wrap:anywhere;">
            <strong>Veículo Executor:</strong> ${texto(c.veiculo_executor)}<br>
            <strong>Início:</strong> ${htmlSeguro(dataBR(c.data_inicio))}<br>
            <strong>Término:</strong> ${htmlSeguro(dataBR(c.data_termino))}<br>
            <strong>Número de inserções:</strong> ${htmlSeguro(c.insercoes_terca_quinta || 0)}x às terças e quintas e ${htmlSeguro(c.insercoes_sabado_domingo || 0)}x aos sábados e domingos.<br>
            ${c.valor_unitario_insercao != null ? `<strong>Valor por inserção:</strong> ${htmlSeguro(moeda(c.valor_unitario_insercao))}<br>` : ''}
            ${c.valor_unitario_insercao != null ? `<strong>Inserções mensais:</strong> ${htmlSeguro(c.insercoes_mensais ?? '-')}<br>` : ''}
            ${resumoValoresContratuais(c).map(([rotulo,valor]) => `<strong>${htmlSeguro(rotulo)}:</strong> ${htmlSeguro(valor)}<br>`).join('')}
          </td>
        </tr>
        <tr class="linha-horarios"><td colspan="2" style="border:1px solid #222;padding:8px 12px;">
          <div style="text-align:center;font-size:15px;font-weight:800;margin-bottom:5px;">Horários das Inserções:</div>
          ${horariosFS ? `<div style="text-align:center;font-weight:800;margin:5px 0;">Sábados e Domingos</div>${horariosFS}` : ''}
          ${horariosTQ ? `<div style="text-align:center;font-weight:800;margin:5px 0;">Terças e Quintas</div>${horariosTQ}` : ''}
        </td></tr>
        ${c.texto_audio_cliente ? `<tr class="contrato-linha-audio-texto"><td colspan="2" style="border:1px solid #222;padding:7px 12px;font-size:12px;line-height:1.25;">
          <strong>Texto do áudio enviado ao cliente:</strong><div class="texto-audio-impresso" style="white-space:pre-wrap;overflow-wrap:anywhere;margin-top:4px;">${htmlSeguro(c.texto_audio_cliente)}</div>
        </td></tr>` : ''}
        ${c.audio_nome ? `<tr class="linha-arquivo-audio"><td colspan="2" style="border:1px solid #222;padding:5px 12px;font-size:10px;overflow-wrap:anywhere;"><strong>Arquivo de áudio:</strong> ${htmlSeguro(c.audio_nome)}</td></tr>` : ''}
        <tr class="linha-observacoes"><td colspan="2" style="border:1px solid #222;padding:8px 12px;font-size:11px;line-height:1.35;">
          <div style="text-align:center;font-weight:800;font-size:13px;text-decoration:underline;margin-bottom:5px;">OBS:</div>
          <ul style="margin:0;padding-left:20px;">
            <li>Terças e quintas das 13:30h às 21h na praça Wilson Jofre.</li>
            <li>Sábados das 8h às 12h em frente à Prefeitura.</li>
            <li>Domingos das 8h às 12h na praça Wilson Jofre.</li>
            <li>A não publicação por motivo de força maior, não implicará em inadimplência contratual por parte da Destac Propagandas que comunicará por escrito, cessando os pagamentos subsequentes desde o momento em que deixar de ser veiculado o apoio contratado.</li>
          </ul>
        </td></tr>
        ${opcoes.incluirCondicoes !== false ? camposComplementares(c) : ''}
        <tr class="linha-assinaturas"><td colspan="2" style="height:135px;border:1px solid #222;padding:12px 14px;vertical-align:middle;">
          <div style="font-size:12px;text-align:right;margin-bottom:45px;">${htmlSeguro(dataAss)}</div>
          <table style="width:100%;table-layout:fixed;border-collapse:collapse;">
            <tr>
              <td style="width:50%;text-align:center;vertical-align:bottom;font-size:13px;">
                <div>${texto(assinanteEmpresa)}</div>
                <div style="font-weight:800;">${texto(e.nome_fantasia || e.razao_social)}</div>
              </td>
              <td style="width:50%;text-align:center;vertical-align:bottom;font-size:13px;">
                <div style="width:70%;border-top:1px solid #222;margin:0 auto 6px;"></div>
                <div>${assinanteCliente ? htmlSeguro(assinanteCliente) : ''}</div>
                <div style="font-weight:800;">${texto(k.nome_fantasia || k.razao_social)}</div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </div>`;
  }

  async function aguardarImagens(pai) {
    await Promise.all(Array.from(pai.querySelectorAll('img')).map(imagem =>
      new Promise(resolve => {
        if (imagem.complete) return resolve();
        const concluir = () => resolve();
        imagem.addEventListener('load', concluir, {once:true});
        imagem.addEventListener('error', concluir, {once:true});
        setTimeout(concluir, 3500);
      })
    ));
  }

  async function reimprimirPdf(dados, opcoes = {}) {
    if (typeof html2pdf !== 'function') {
      throw new Error('Biblioteca de PDF não carregou. Confira sua conexão e atualize a página.');
    }
    const suporte = document.createElement('div');
    suporte.id = 'destacReimpressaoPdf';
    suporte.style.cssText = `position:absolute;left:0;top:${window.scrollY + document.documentElement.scrollHeight + 60}px;width:198mm;background:#fff;color:#000;pointer-events:none;z-index:-1;`;
    suporte.innerHTML = `<style>
      #destacReimpressaoPdf, #destacReimpressaoPdf * {box-sizing:border-box;}
      #destacReimpressaoPdf .contrato-exportacao {font-family:Arial,Helvetica,sans-serif;font-size:12px;width:198mm;max-width:198mm;margin:0;padding:0;color:#000;}
      #destacReimpressaoPdf .tabela-contrato {width:100%;table-layout:fixed;border-collapse:collapse;}
      #destacReimpressaoPdf .tabela-contrato > tbody > tr > td {overflow-wrap:break-word;}
      #destacReimpressaoPdf .grade-horarios td {font-size:12px !important;padding:6px 3px !important;}
      #destacReimpressaoPdf .linha-assinaturas > td {vertical-align:middle !important;}
      #destacReimpressaoPdf .contrato-linha-audio-texto > td {font-size:var(--pdf-audio-tamanho,12px) !important;line-height:1.2 !important;}
      #destacReimpressaoPdf .texto-audio-impresso {font-size:inherit !important;line-height:inherit !important;}
      #destacReimpressaoPdf .linha-complementares td {font-size:10px !important;line-height:1.24 !important;}
      #destacReimpressaoPdf .linha-observacoes li {margin:3px 0 !important;}
    </style>
    <div id="destacPaginaReimpressao" style="width:198mm;height:284mm;overflow:hidden;background:#fff;">
      <div id="destacConteudoReimpressao" style="width:198mm;background:#fff;transform-origin:top left;">${montarDocumento(dados, opcoes)}</div>
    </div>`;
    document.body.appendChild(suporte);
    try {
      const pagina = suporte.querySelector('#destacPaginaReimpressao');
      const conteudo = suporte.querySelector('#destacConteudoReimpressao');
      const tabela = conteudo.querySelector('.tabela-contrato');
      if (!tabela) throw new Error('Não foi possível montar o contrato.');
      await aguardarImagens(conteudo);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const maxAltura = pagina.clientHeight - 5;
      const audio = tabela.querySelector('.contrato-linha-audio-texto');
      if (audio && tabela.getBoundingClientRect().height > maxAltura) {
        let min = 5, max = 12;
        audio.style.setProperty('--pdf-audio-tamanho', `${min}px`);
        if (tabela.getBoundingClientRect().height <= maxAltura) {
          for (let i = 0; i < 12; i++) {
            const meio = (min + max) / 2;
            audio.style.setProperty('--pdf-audio-tamanho', `${meio}px`);
            if (tabela.getBoundingClientRect().height <= maxAltura) min = meio;
            else max = meio;
          }
        }
        audio.style.setProperty('--pdf-audio-tamanho', `${min}px`);
      }
      const linhas = Array.from(tabela.rows);
      const alturas = linhas.map(l => l.getBoundingClientRect().height);
      const natural = tabela.getBoundingClientRect().height;
      if (natural < maxAltura) {
        const pesos = linhas.map(l => l.classList.contains('linha-cabecalho') ? 1.0
          : l.classList.contains('linha-dados') ? 1.15
          : l.classList.contains('linha-horarios') ? 1.5
          : l.classList.contains('linha-assinaturas') ? 1.8
          : l.classList.contains('linha-observacoes') ? 1.0
          : l.classList.contains('linha-complementares') ? 0.8 : 0.35);
        const soma = pesos.reduce((a,b) => a+b, 0);
        linhas.forEach((linha, i) => { linha.style.height = `${alturas[i] + (maxAltura-natural)*pesos[i]/soma}px`; });
        tabela.style.height = `${maxAltura}px`;
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const largura = Math.max(conteudo.scrollWidth, tabela.scrollWidth, conteudo.offsetWidth);
      const altura = Math.max(conteudo.scrollHeight, conteudo.offsetHeight, tabela.getBoundingClientRect().height);
      const escala = Math.min(1, (pagina.clientWidth - 2)/Math.max(1,largura), (pagina.clientHeight - 2)/Math.max(1,altura));
      conteudo.style.transform = `scale(${escala})`;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await html2pdf().set({
        margin:[5,5,5,5],
        filename:nomeArquivo(dados,'pdf'),
        image:{type:'jpeg',quality:.98},
        html2canvas:{scale:2,useCORS:true,allowTaint:false,logging:false,scrollX:0,scrollY:0,backgroundColor:'#ffffff'},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
      }).from(pagina).save();
    } finally {
      suporte.remove();
    }
  }

  async function reimprimirWord(dados, opcoes = {}) {
    const corpo = montarDocumento(dados, opcoes);
    const documento = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Contrato ${htmlSeguro(dados.contrato.numero_contrato)}</title>
      <style>
      @page {size:A4;margin:5mm;}
      body {font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#000;margin:0;line-height:1.05;}
      .contrato-exportacao {width:100%;margin:0;padding:0;}
      .tabela-contrato {width:100%;border-collapse:collapse;table-layout:fixed;}
      .tabela-contrato > tbody > tr > td {font-size:8pt !important;line-height:1.05 !important;padding:2pt 5pt !important;}
      .tabela-contrato .linha-cabecalho > td {padding:4pt 6pt !important;}
      .tabela-contrato .linha-assinaturas > td {padding:4pt 6pt !important;height:70pt !important;}
      .tabela-contrato .linha-assinaturas > td > div:first-child {margin-bottom:10pt !important;}
      .tabela-contrato .linha-assinaturas table td {padding:0 !important;line-height:1.05 !important;}
      .tabela-contrato .linha-assinaturas {height:70pt;}
      .tabela-contrato .linha-observacoes li {margin:0;}
      .tabela-contrato .linha-observacoes ul {margin:0;padding-left:14pt;}
      .tabela-contrato .linha-complementares > td {padding:2pt 4pt !important;}
      .tabela-contrato .linha-complementares table td {font-size:7pt !important;line-height:1.0 !important;padding:1pt 3pt !important;}
      .contrato-exportacao .grade-horarios {width:100% !important;}
      .contrato-exportacao .grade-horarios td {padding:1pt !important;font-size:8pt !important;}
      .tabela-contrato .linha-assinaturas td div:first-child {font-size:9pt !important;}
      </style></head><body>${corpo}</body></html>`;
    // Mesmo formato Word (.doc) já utilizado em "Novo contrato".
    const blob = new Blob(['\ufeff', documento], {type:'application/msword;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo(dados, 'doc');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  window.DestacReimpressao = Object.freeze({ pdf: reimprimirPdf, word: reimprimirWord });
})();
