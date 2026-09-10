create table if not exists public.credenciais_asaas (
  proprietario_id uuid primary key references public.proprietarios(id) on delete cascade,
  api_key text not null,
  created_at timestamptz not null default now()
);

-- RLS ligado sem nenhuma policy: nenhum usuario autenticado le ou escreve.
-- So a Edge Function (service role, que ignora RLS) tem acesso.
alter table public.credenciais_asaas enable row level security;
revoke all on table public.credenciais_asaas from anon, authenticated;

alter table public.pagamentos_mensais
  add column if not exists asaas_transfer_id text,
  add column if not exists asaas_transfer_status text,
  add column if not exists asaas_transfer_erro text;
