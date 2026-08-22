-- Cadastros extras: endereço/RG/dados bancários/pessoa jurídica em proprietários e pessoas,
-- tipo e descrição em imóveis, e vistoria de saída em laudos.
-- Migração 100% aditiva/retrocompatível (colunas nullable ou com default).

-- ========== PROPRIETARIOS ==========
alter table proprietarios
  add column if not exists endereco text,
  add column if not exists rg text,
  add column if not exists banco text,
  add column if not exists agencia text,
  add column if not exists conta text,
  add column if not exists tipo_conta text check (tipo_conta in ('corrente', 'poupanca')),
  add column if not exists tipo_pessoa text not null default 'fisica' check (tipo_pessoa in ('fisica', 'juridica')),
  add column if not exists representante_nome text,
  add column if not exists representante_cpf text,
  add column if not exists representante_rg text;

-- ========== PESSOAS ==========
alter table pessoas
  add column if not exists rg text,
  add column if not exists endereco text,
  add column if not exists tipo_pessoa text not null default 'fisica' check (tipo_pessoa in ('fisica', 'juridica')),
  add column if not exists representante_nome text,
  add column if not exists representante_cpf text,
  add column if not exists representante_rg text;

-- ========== IMOVEIS ==========
alter table imoveis
  add column if not exists tipo_imovel text not null default 'residencial' check (tipo_imovel in ('residencial', 'comercial')),
  add column if not exists descricao text;

-- ========== LAUDOS DE VISTORIA: adicionar tipo 'saida' ==========
alter table laudos_vistoria drop constraint if exists laudos_vistoria_tipo_check;
alter table laudos_vistoria add constraint laudos_vistoria_tipo_check
  check (tipo in ('entrada', 'renovacao', 'saida'));
