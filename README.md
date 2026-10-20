# DESTAC PROPAGANDAS — Grade de horários sem conflito (20/10/2026)

**Importante: execute primeiro `sql/INSTALAR_GRADE_HORARIOS_20261020.sql` no Supabase.** O frontend depende da consulta da grade no banco e impede salvar enquanto não conseguir verificá-la.

Esta versão preserva o projeto existente, incluindo contratos, seis modalidades financeiras, descontos, permutas, pagamentos, conciliação de contratos antigos, assinatura e PDF/Word. As mudanças funcionais ocorreram em `contrato_novo.html` e `contratos.js`, além da instalação dos mecanismos de validação de grade no Supabase.

O cadastro oferece horários de 30 segundos em blocos de 6 minutos, contendo quatro anúncios consecutivos de 30 segundos e quatro minutos destinados à música. Horário da feira: terças e quintas 13:30–21:00; sábados e domingos 08:00–12:00.

Capacidades por feira: terça e quinta, 300 inserções por dia; sábado e domingo, 160 inserções por dia. Os horários disponíveis consideram os outros contratos ATIVOS ou PENDENTES com o mesmo `veiculo_executor` em todas as datas do período contratado, mesmo que sejam contratos de empresas diferentes. A validação ao salvar é executada novamente no servidor, sob bloqueio transacional, impedindo reservas simultâneas em conflito.

A estrutura dos contratos continua usando as colunas `horarios_terca_quinta` e `horarios_sabado_domingo` como arrays JSONB, contendo strings `HH:MM:SS`. Os horários são recorrentes para cada grupo de dias: o mesmo horário deve estar livre em **todas as terças e quintas**, e de forma análoga em todos os sábados e domingos da vigência. Isso preserva a organização atual do formulário, sem alterar os contratos existentes.

Horários históricos fora da grade são preservados; por segurança, ocupam o bloco de 6 minutos correspondente na consulta. A atualização não altera os documentos ou os lançamentos financeiros existentes. O SQL está preparado para ser aplicado uma única vez, é reexecutável, e não inclui instruções de apagar ou migrar dados.

Este módulo faz a reserva da grade, não faz o upload de arquivos de áudio nem executa automaticamente a playlist no ZaraRadio. Para integração automática com o ZaraRadio, é preciso definir previamente a forma de geração da playlist e o catálogo de músicas/áudios.

## Instalação

1. Faça backup do banco Supabase.
2. Execute `sql/INSTALAR_GRADE_HORARIOS_20261020.sql` no SQL Editor.
3. Execute `sql/VERIFICAR_GRADE_HORARIOS_20261020.sql` e confirme que função, validação e trigger estão INSTALADOS.
4. Publique os arquivos do projeto, especialmente `contrato_novo.html` e `contratos.js`.
5. Atualize a tela com Ctrl + F5.
6. Teste com contrato PENDENTE em ambiente de homologação. Informe datas, quantidade por feira e veículo executor. Confira a escolha automática, troque um horário e teste a validação de conflito.

**Atenção:** foi testada a interface no Chromium com dados simulados. A migração PostgreSQL não pôde ser executada no banco da DESTAC nesta sessão; execute primeiro em homologação e envie o resultado da validação antes de utilizar em produção.

## Correção adicional — pesquisa de Empresa e Cliente (20/10/2026)

Os dois campos agora possuem busca digitável por nome, nome fantasia ou CPF/CNPJ.
A busca é vinculada aos mesmos seletores usados para salvar/editar contratos, preservando os dados cadastrados. A listagem de clientes passou a ser paginada para não ficar limitada aos primeiros mil. O texto “uma opção” do formulário financeiro teve seu tamanho normalizado. Veja `LEIA_ME_CORRECAO_BUSCA_EMPRESA_CLIENTE.txt`.
Esta correção não requer executar SQL novamente.
