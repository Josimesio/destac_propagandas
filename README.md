# DESTAC PROPAGANDAS — Parcelado com desconto

Atualização pontual baseada em `DESTAC_PROPAGANDAS_VISUAL_MODALIDADES_PERCENTUAL_PERMUTA.zip`.

## Nova quinta opção em Gerar contrato → Valores do contrato

- À vista
- À vista com desconto
- **Parcelado com desconto (novo)**
- Permuta + dinheiro
- Somente permuta

No modo **Parcelado com desconto**, informe desconto percentual entre 0,01% e 99,99%, forma de pagamento, quantidade de parcelas e primeiro vencimento. A entrada, se houver, **já está incluída no total financeiro reduzido pelo desconto**. A prévia distribui os centavos exatamente entre as parcelas. A parte em permuta não sofre alteração nem gera contas a receber.

O formulário distingue valor comercial original e total financeiro com desconto. Consulta, impressão inicial e reimpressão PDF/Word apresentam o desconto do parcelamento. Contratos antigos sem esse desconto continuam inalterados.

## Banco de dados (obrigatório antes de publicar)

1. Faça backup do projeto DESTAC no Supabase.
2. Confirme que instalou anteriormente as migrações de Financeiro, Conciliação e Permuta (inclusive `ATUALIZAR_4_FORMAS_PAGAMENTO_PERMUTA_LIVRE.sql`).
3. Execute **apenas** `sql/INSTALAR_PARCELADO_COM_DESCONTO.sql` no SQL Editor. Ele cria a coluna `percentual_desconto_parcelado` e atualiza a função de sincronização das parcelas.
4. Publique os arquivos do projeto e atualize a página com Ctrl+F5.
5. Crie um contrato PENDENTE de teste e confira a prévia. Ative-o apenas depois de validar os valores.

**Não reinstale scripts antigos após esta migração:** eles podem sobrescrever a função de cálculo mais recente.

## Exemplo

- Valor comercial original: R$ 11.520,00
- Desconto parcelado: 10%
- Total financeiro após desconto: R$ 10.368,00
- 6 parcelas, sem entrada: R$ 1.728,00 cada

## Validações

- Teste de navegador com cinco modalidades e valores simulados.
- Sintaxe JavaScript validada com Node.
- Regra SQL auditada estaticamente; **não executada no Supabase real**.
