-- Prestação de contas: controle do repasse mensal ao proprietário
-- (aluguel bruto recebido do inquilino - comissão da imobiliária = valor líquido repassado)

alter table pagamentos_mensais
  add column if not exists valor_repassado numeric(12,2),
  add column if not exists data_repasse date;
