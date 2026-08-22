-- Duração automática, numeração automática e visitas periódicas nos contratos.

alter table contratos
  add column if not exists duracao_meses int,
  add column if not exists numero_contrato text,
  add column if not exists periodo_visita_dias int,
  add column if not exists data_ultima_visita date;

-- número de contrato único (parcial: permite null para contratos legados antes do rollout)
create unique index if not exists idx_contratos_numero_unico
  on contratos (numero_contrato) where numero_contrato is not null;

-- índice para as consultas do dashboard (status + vigência)
create index if not exists idx_contratos_status_vigencia on contratos (status, vigencia_final);

-- ========== NUMERAÇÃO ATÔMICA POR ANO ==========
create table if not exists numeracao_contratos (
  ano int primary key,
  seq int not null default 0
);

alter table numeracao_contratos enable row level security;
drop policy if exists "authenticated_full_access" on numeracao_contratos;
create policy "authenticated_full_access" on numeracao_contratos for all to authenticated using (true) with check (true);

-- Upsert atômico: o INSERT ... ON CONFLICT DO UPDATE toma um lock de linha,
-- então chamadas concorrentes nunca retornam o mesmo seq para o mesmo ano.
create or replace function proximo_numero_contrato(p_ano int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into numeracao_contratos (ano, seq) values (p_ano, 1)
  on conflict (ano) do update set seq = numeracao_contratos.seq + 1
  returning seq into v_seq;

  return lpad(v_seq::text, 3, '0') || '/' || lpad((p_ano % 100)::text, 2, '0');
end;
$$;

grant execute on function proximo_numero_contrato(int) to authenticated;
