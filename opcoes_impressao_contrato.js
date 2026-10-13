/**
 * Confirmação antes da geração/reimpressão de Word e PDF.
 * Retorna true = incluir, false = omitir, null = cancelar a operação.
 * Não grava nenhuma preferência ou dado no Supabase.
 */
(function () {
  'use strict';

  let emExibicao = false;

  function perguntar() {
    if (emExibicao) return Promise.resolve(null);
    emExibicao = true;

    return new Promise(resolve => {
      const focoAnterior = document.activeElement;
      const fundo = document.createElement('div');
      fundo.id = 'destacDialogoImpressao';
      fundo.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(24,21,34,.66);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;';
      fundo.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="destacPerguntaImpressao" aria-describedby="destacDetalheImpressao" style="box-sizing:border-box;width:min(100%,540px);background:#fff;color:#1e1e1e;border-radius:16px;padding:27px 25px;box-shadow:0 18px 65px rgba(0,0,0,.35);font-family:Arial,Helvetica,sans-serif;">
          <h2 id="destacPerguntaImpressao" style="font-size:21px;line-height:1.35;margin:0 0 12px;">Incluir as condições contratuais e financeiras?</h2>
          <p id="destacDetalheImpressao" style="font-size:15px;line-height:1.55;margin:0 0 22px;">Essa seção contém dados de assinatura, pagamento, parcelas, vencimentos e observações adicionais. A escolha vale somente para este arquivo e não altera o contrato cadastrado.</p>
          <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;">
            <button type="button" data-escolha="cancelar" style="min-height:43px;padding:9px 16px;border-radius:9px;border:1px solid #aaa;background:#fff;color:#333;cursor:pointer;font-size:14px;font-weight:700;">Cancelar</button>
            <button type="button" data-escolha="nao" style="min-height:43px;padding:9px 16px;border-radius:9px;border:1px solid #77638f;background:#fff;color:#594574;cursor:pointer;font-size:14px;font-weight:700;">Não incluir</button>
            <button type="button" data-escolha="sim" style="min-height:43px;padding:9px 16px;border-radius:9px;border:1px solid #71519b;background:#71519b;color:#fff;cursor:pointer;font-size:14px;font-weight:700;">Incluir seção</button>
          </div>
        </div>`;

      function concluir(resposta) {
        document.removeEventListener('keydown', aoTeclar);
        fundo.remove();
        emExibicao = false;
        if (focoAnterior && typeof focoAnterior.focus === 'function') focoAnterior.focus();
        resolve(resposta);
      }

      function aoTeclar(evento) {
        if (evento.key === 'Escape') {
          evento.preventDefault();
          concluir(null);
        } else if (evento.key === 'Tab') {
          // Mantém o foco dentro do diálogo enquanto a pergunta está aberta.
          const botoes = Array.from(fundo.querySelectorAll('button'));
          const primeiro = botoes[0], ultimo = botoes[botoes.length - 1];
          if (evento.shiftKey && document.activeElement === primeiro) {
            evento.preventDefault(); ultimo.focus();
          } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault(); primeiro.focus();
          }
        }
      }

      fundo.addEventListener('click', evento => {
        const botao = evento.target.closest('[data-escolha]');
        if (botao) {
          const escolha = botao.dataset.escolha;
          concluir(escolha === 'sim' ? true : escolha === 'nao' ? false : null);
        } else if (evento.target === fundo) {
          concluir(null);
        }
      });
      document.body.appendChild(fundo);
      document.addEventListener('keydown', aoTeclar);
      fundo.querySelector('[data-escolha="sim"]').focus();
    });
  }

  window.DestacOpcoesImpressao = Object.freeze({ perguntar });
})();
