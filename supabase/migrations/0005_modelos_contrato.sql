-- Modelos de contrato (templates com placeholders) e documento gerado por contrato.

create table if not exists modelos_contrato (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_operacao text not null check (tipo_operacao in ('aluguel', 'administracao', 'venda')),
  clausulas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists contratos_gerados (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  modelo_id uuid references modelos_contrato(id) on delete set null,
  clausulas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (contrato_id)
);

create index if not exists idx_contratos_gerados_contrato on contratos_gerados(contrato_id);

alter table modelos_contrato enable row level security;
alter table contratos_gerados enable row level security;

drop policy if exists "authenticated_full_access" on modelos_contrato;
create policy "authenticated_full_access" on modelos_contrato for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on contratos_gerados;
create policy "authenticated_full_access" on contratos_gerados for all to authenticated using (true) with check (true);
