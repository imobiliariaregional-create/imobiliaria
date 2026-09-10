-- Juros e multa de atraso pertencem ao proprietario. Como o split e definido na
-- criacao da cobranca (antes de saber se havera atraso), o acrescimo e repassado
-- depois, por transferencia entre contas Asaas.
alter table public.pagamentos_mensais
  add column if not exists asaas_acrescimo_repassado numeric;
