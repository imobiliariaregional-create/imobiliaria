-- Integracao com o Asaas: gera boletos para os inquilinos/compradores, com
-- juros/multa e status de pagamento sincronizado via webhook.
--
-- Fase 1 (sem split): o boleto cai integralmente na conta Asaas da propria
-- imobiliaria. Contratos de administracao com recebimento_aluguel =
-- 'proprietario' ficam de fora por enquanto (ver Fase 2, quando o split de
-- pagamentos por subconta estiver liberado).

alter table public.pessoas
  add column if not exists asaas_customer_id text;

alter table public.pagamentos_mensais
  add column if not exists asaas_charge_id text,
  add column if not exists asaas_status text,
  add column if not exists asaas_boleto_url text,
  add column if not exists asaas_linha_digitavel text;

create unique index if not exists idx_pagamentos_asaas_charge
  on public.pagamentos_mensais(asaas_charge_id)
  where asaas_charge_id is not null;
