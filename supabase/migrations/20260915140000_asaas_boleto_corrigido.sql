-- Multa e juros ja embutidos no valor do boleto quando o aluguel esta vencido
-- (a Asaas nao aceita vencimento retroativo). Esse acrescimo e do proprietario e
-- e repassado a ele depois do pagamento.
alter table public.pagamentos_mensais
  add column if not exists asaas_acrescimo_cobrado numeric;
