-- Sistema de Gestão para Imobiliária - schema inicial
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via CLI: supabase db push)

-- ========== EXTENSÕES ==========
create extension if not exists "pgcrypto";

-- ========== PROPRIETARIOS ==========
create table proprietarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf_cnpj text,
  telefone text,
  email text,
  chave_pix text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- ========== PESSOAS (inquilinos / compradores) ==========
create table pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf_cnpj text,
  telefone text,
  email text,
  created_at timestamptz not null default now()
);

-- ========== IMOVEIS ==========
create table imoveis (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid references proprietarios(id) on delete set null,
  rua text not null,
  numero text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  tipo_operacao text not null check (tipo_operacao in ('aluguel', 'administracao', 'venda')),
  controla_agua boolean not null default false,
  controla_energia boolean not null default false,
  status text not null default 'disponivel' check (status in ('disponivel', 'ocupado', 'vendido')),
  observacoes text,
  created_at timestamptz not null default now()
);

-- ========== CONTRATOS ==========
create table contratos (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references imoveis(id) on delete cascade,
  pessoa_id uuid references pessoas(id) on delete set null,
  tipo text not null check (tipo in ('aluguel', 'administracao', 'venda')),
  valor_aluguel numeric(12,2),
  dia_pagamento smallint check (dia_pagamento between 1 and 31),
  data_inicio date not null default current_date,
  vigencia_final date,
  forma_comissao_venda text check (forma_comissao_venda in ('percentual', 'fixo')),
  percentual_comissao numeric(5,2),
  valor_comissao_fixo numeric(12,2),
  valor_venda numeric(12,2),
  status text not null default 'ativo' check (status in ('ativo', 'encerrado', 'renovado')),
  observacoes text,
  created_at timestamptz not null default now()
);

create index idx_contratos_imovel on contratos(imovel_id);

-- ========== PAGAMENTOS MENSAIS ==========
create table pagamentos_mensais (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  mes_referencia date not null,
  valor numeric(12,2) not null,
  data_vencimento date not null,
  data_pagamento date,
  status text not null default 'pendente' check (status in ('pago', 'pendente', 'atrasado')),
  created_at timestamptz not null default now(),
  unique (contrato_id, mes_referencia)
);

create index idx_pagamentos_contrato on pagamentos_mensais(contrato_id);
create index idx_pagamentos_status on pagamentos_mensais(status);

-- ========== CONTAS DE CONSUMO (água / energia) ==========
create table contas_consumo (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references imoveis(id) on delete cascade,
  tipo text not null check (tipo in ('agua', 'energia')),
  mes_referencia date not null,
  status_pagamento text not null default 'pendente' check (status_pagamento in ('pago', 'pendente')),
  data_pagamento date,
  created_at timestamptz not null default now(),
  unique (imovel_id, tipo, mes_referencia)
);

create index idx_contas_imovel on contas_consumo(imovel_id);

-- ========== LAUDOS DE VISTORIA ==========
create table laudos_vistoria (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'renovacao')),
  data date not null default current_date,
  arquivo_url text,
  observacoes text,
  created_at timestamptz not null default now()
);

create index idx_laudos_contrato on laudos_vistoria(contrato_id);

-- ========== NOTAS FISCAIS ==========
create table notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  numero text,
  valor numeric(12,2) not null,
  data_emissao date not null default current_date,
  descricao text,
  arquivo_url text,
  contrato_id uuid references contratos(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_notas_contrato on notas_fiscais(contrato_id);

-- ========== ROW LEVEL SECURITY ==========
-- Qualquer usuário autenticado (funcionário logado) tem acesso total.
-- Não há hierarquia de perfis nesta versão.

alter table proprietarios enable row level security;
alter table pessoas enable row level security;
alter table imoveis enable row level security;
alter table contratos enable row level security;
alter table pagamentos_mensais enable row level security;
alter table contas_consumo enable row level security;
alter table laudos_vistoria enable row level security;
alter table notas_fiscais enable row level security;

create policy "authenticated_full_access" on proprietarios for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on pessoas for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on imoveis for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on contratos for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on pagamentos_mensais for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on contas_consumo for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on laudos_vistoria for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on notas_fiscais for all to authenticated using (true) with check (true);

-- ========== STORAGE BUCKETS ==========
insert into storage.buckets (id, name, public) values ('laudos-vistoria', 'laudos-vistoria', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('notas-fiscais', 'notas-fiscais', false)
  on conflict (id) do nothing;

create policy "authenticated_read_laudos" on storage.objects for select to authenticated
  using (bucket_id = 'laudos-vistoria');
create policy "authenticated_write_laudos" on storage.objects for insert to authenticated
  with check (bucket_id = 'laudos-vistoria');
create policy "authenticated_delete_laudos" on storage.objects for delete to authenticated
  using (bucket_id = 'laudos-vistoria');

create policy "authenticated_read_notas" on storage.objects for select to authenticated
  using (bucket_id = 'notas-fiscais');
create policy "authenticated_write_notas" on storage.objects for insert to authenticated
  with check (bucket_id = 'notas-fiscais');
create policy "authenticated_delete_notas" on storage.objects for delete to authenticated
  using (bucket_id = 'notas-fiscais');
