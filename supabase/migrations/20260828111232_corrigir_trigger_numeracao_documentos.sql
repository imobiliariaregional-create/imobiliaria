-- Corrige "record "new" has no field "numero"" ao criar contratos.
--
-- O corpo anterior combinava "tg_table_name = 'x' and new.campo is null" numa
-- unica condicao. O Postgres precisa analisar essa condicao inteira (para
-- decidir o tipo de "new.campo") antes de poder avaliar o curto-circuito do
-- "and" em tempo de execucao — e como o "new" de uma trigger em "contratos"
-- e do tipo "contratos" (sem a coluna "numero"), a analise falhava sempre que
-- o "elsif" de outra tabela era alcancado, o que acontece toda vez que
-- numero_contrato ja vem preenchido (como faz a RPC criar_contrato_com_pagamentos).
--
-- A correcao separa a checagem de tg_table_name num "if" aninhado, para o
-- acesso a new.numero so ser analisado quando quem disparou realmente for
-- uma das tabelas que tem essa coluna.
create or replace function private.numerar_documento_automaticamente()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'contratos' then
    if new.numero_contrato is null then
      new.numero_contrato := private.proximo_numero_documento('contrato', new.data_inicio);
    end if;
  elsif tg_table_name = 'autorizacoes_administracao' then
    if new.numero is null then
      new.numero := private.proximo_numero_documento('autorizacao', new.data_inicio);
    end if;
  elsif tg_table_name = 'laudos_vistoria' then
    if new.numero is null then
      new.numero := private.proximo_numero_documento('laudo', new.data);
    end if;
  elsif tg_table_name = 'aditivos_contratuais' then
    if new.numero is null then
      new.numero := private.proximo_numero_documento('aditivo', new.data);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.numerar_documento_automaticamente() from public, anon, authenticated;
