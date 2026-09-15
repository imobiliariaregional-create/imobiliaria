-- Dados de qualificacao civil usados na abertura dos contratos.
alter table public.pessoas
  add column if not exists nacionalidade text,
  add column if not exists estado_civil text,
  add column if not exists profissao text;

alter table public.proprietarios
  add column if not exists nacionalidade text,
  add column if not exists estado_civil text,
  add column if not exists profissao text;
