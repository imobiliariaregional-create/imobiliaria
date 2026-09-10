alter table public.proprietarios add column if not exists asaas_wallet_id text;
create unique index if not exists idx_proprietarios_asaas_wallet
  on public.proprietarios(asaas_wallet_id) where asaas_wallet_id is not null;

alter table public.pagamentos_mensais
  add column if not exists asaas_split_ativo boolean not null default false;
