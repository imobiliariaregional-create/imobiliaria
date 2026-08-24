-- Corrige integridade financeira, concorrencia e controle de acesso.
-- Os usuarios existentes permanecem administradores; novos usuarios entram como corretores.

create schema if not exists private;
revoke all on schema private from public, anon;

-- ========== PERFIS E PAPEIS ==========
create table if not exists public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null default 'corretor' check (papel in ('admin', 'financeiro', 'corretor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfis enable row level security;
create index if not exists idx_perfis_papel on public.perfis(papel);

-- Mantem a operacao atual: quem ja existe recebe papel de administrador.
insert into public.perfis (user_id, papel)
select id, 'admin'
from auth.users
on conflict (user_id) do nothing;

create or replace function private.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (user_id, papel)
  values (new.id, 'corretor')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function private.criar_perfil_novo_usuario() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_criar_perfil on auth.users;
create trigger on_auth_user_created_criar_perfil
after insert on auth.users
for each row execute function private.criar_perfil_novo_usuario();

create or replace function private.tem_papel(p_papeis text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.perfis
      where user_id = (select auth.uid())
        and papel = any(p_papeis)
    );
$$;

revoke execute on function private.tem_papel(text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.tem_papel(text[]) to authenticated;

drop policy if exists "authenticated_full_access" on public.perfis;
drop policy if exists "perfis_select" on public.perfis;
drop policy if exists "perfis_admin_insert" on public.perfis;
drop policy if exists "perfis_admin_update" on public.perfis;
drop policy if exists "perfis_admin_delete" on public.perfis;

create policy "perfis_select" on public.perfis
for select to authenticated
using (user_id = (select auth.uid()) or (select private.tem_papel(array['admin'])));

create policy "perfis_admin_insert" on public.perfis
for insert to authenticated
with check ((select private.tem_papel(array['admin'])));

create policy "perfis_admin_update" on public.perfis
for update to authenticated
using ((select private.tem_papel(array['admin'])))
with check ((select private.tem_papel(array['admin'])));

create policy "perfis_admin_delete" on public.perfis
for delete to authenticated
using ((select private.tem_papel(array['admin'])));

-- ========== INTEGRIDADE DE IMOVEIS E CONTRATOS ==========
-- A migracao para se houver duplicidade ativa; assim nenhum contrato e encerrado silenciosamente.
do $$
begin
  if exists (
    select 1
    from public.contratos
    where status = 'ativo'
    group by imovel_id
    having count(*) > 1
  ) then
    raise exception using
      message = 'Existem imoveis com mais de um contrato ativo.',
      hint = 'Encerre os contratos ativos duplicados antes de reaplicar esta migracao.';
  end if;
end $$;

create unique index if not exists idx_contratos_um_ativo_por_imovel
on public.contratos(imovel_id)
where status = 'ativo';

create or replace function private.sincronizar_status_imovel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_imovel_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_imovel_id := old.imovel_id;
  else
    v_imovel_id := new.imovel_id;
  end if;

  select case
    when exists (
      select 1 from public.contratos
      where imovel_id = v_imovel_id and status = 'ativo' and tipo = 'venda'
    ) then 'vendido'
    when exists (
      select 1 from public.contratos
      where imovel_id = v_imovel_id and status = 'ativo' and tipo in ('aluguel', 'administracao')
    ) then 'ocupado'
    else 'disponivel'
  end into v_status;

  update public.imoveis set status = v_status where id = v_imovel_id;

  if tg_op = 'UPDATE' and old.imovel_id is distinct from new.imovel_id then
    select case
      when exists (
        select 1 from public.contratos
        where imovel_id = old.imovel_id and status = 'ativo' and tipo = 'venda'
      ) then 'vendido'
      when exists (
        select 1 from public.contratos
        where imovel_id = old.imovel_id and status = 'ativo' and tipo in ('aluguel', 'administracao')
      ) then 'ocupado'
      else 'disponivel'
    end into v_status;
    update public.imoveis set status = v_status where id = old.imovel_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.sincronizar_status_imovel() from public, anon, authenticated;

drop trigger if exists contratos_sincronizar_status_imovel on public.contratos;
create trigger contratos_sincronizar_status_imovel
after insert or delete or update of status, imovel_id, tipo on public.contratos
for each row execute function private.sincronizar_status_imovel();

create or replace function private.proteger_status_imovel_com_contrato()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.contratos
    where imovel_id = new.id and status = 'ativo' and tipo = 'venda'
  ) then
    new.status := 'vendido';
  elsif exists (
    select 1 from public.contratos
    where imovel_id = new.id and status = 'ativo' and tipo in ('aluguel', 'administracao')
  ) then
    new.status := 'ocupado';
  end if;
  return new;
end;
$$;

revoke execute on function private.proteger_status_imovel_com_contrato() from public, anon, authenticated;

drop trigger if exists imoveis_proteger_status_ativo on public.imoveis;
create trigger imoveis_proteger_status_ativo
before update of status on public.imoveis
for each row execute function private.proteger_status_imovel_com_contrato();

-- Corrige imediatamente o status dos imoveis existentes.
update public.imoveis i
set status = case
  when exists (
    select 1 from public.contratos c
    where c.imovel_id = i.id and c.status = 'ativo' and c.tipo = 'venda'
  ) then 'vendido'
  when exists (
    select 1 from public.contratos c
    where c.imovel_id = i.id and c.status = 'ativo' and c.tipo in ('aluguel', 'administracao')
  ) then 'ocupado'
  else 'disponivel'
end;

-- ========== HISTORICO FINANCEIRO ==========
alter table public.pagamentos_mensais
  add column if not exists valor_bruto numeric(12,2);

-- Atraso e um estado derivado da data de vencimento, nao um valor persistido.
update public.pagamentos_mensais set status = 'pendente' where status = 'atrasado';
alter table public.pagamentos_mensais drop constraint if exists pagamentos_mensais_status_check;
alter table public.pagamentos_mensais
  add constraint pagamentos_mensais_status_check check (status in ('pago', 'pendente'));

update public.pagamentos_mensais p
set valor_bruto = case
  when c.tipo = 'administracao' then coalesce(c.valor_aluguel, 0)
  else p.valor
end
from public.contratos c
where c.id = p.contrato_id
  and p.valor_bruto is null;

update public.pagamentos_mensais
set valor_bruto = valor
where valor_bruto is null;

-- Um repasse confirmado implica que o recebimento ja ocorreu.
update public.pagamentos_mensais
set status = 'pago',
    data_pagamento = coalesce(data_pagamento, data_repasse)
where valor_repassado is not null
  and status <> 'pago';

alter table public.pagamentos_mensais
  alter column valor_bruto set default 0,
  alter column valor_bruto set not null;

create index if not exists idx_pagamentos_pendentes_vencimento
on public.pagamentos_mensais(data_vencimento)
where status = 'pendente';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pagamentos_valores_nao_negativos'
      and conrelid = 'public.pagamentos_mensais'::regclass
  ) then
    alter table public.pagamentos_mensais
      add constraint pagamentos_valores_nao_negativos
      check (valor >= 0 and valor_bruto >= 0 and (valor_repassado is null or valor_repassado >= 0));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'pagamentos_repasse_exige_recebimento'
      and conrelid = 'public.pagamentos_mensais'::regclass
  ) then
    alter table public.pagamentos_mensais
      add constraint pagamentos_repasse_exige_recebimento
      check (valor_repassado is null or status = 'pago');
  end if;
end $$;

-- ========== NUMERACAO E OPERACOES TRANSACIONAIS ==========
-- A funcao antiga era SECURITY DEFINER e executavel por PUBLIC.
revoke execute on function public.proximo_numero_contrato(int) from public, anon, authenticated;
drop function if exists public.proximo_numero_contrato(int);

create or replace function private.proximo_numero_contrato(p_ano int)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seq int;
begin
  insert into public.numeracao_contratos (ano, seq)
  values (p_ano, 1)
  on conflict (ano) do update
  set seq = public.numeracao_contratos.seq + 1
  returning seq into v_seq;

  return lpad(v_seq::text, 3, '0') || '/' || lpad((p_ano % 100)::text, 2, '0');
end;
$$;

revoke execute on function private.proximo_numero_contrato(int) from public, anon;
grant execute on function private.proximo_numero_contrato(int) to authenticated;

create or replace function private.data_vencimento_mes(p_mes date, p_dia int)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(
    extract(year from p_mes)::int,
    extract(month from p_mes)::int,
    least(
      greatest(coalesce(p_dia, 5), 1),
      extract(day from (date_trunc('month', p_mes) + interval '1 month - 1 day'))::int
    )
  );
$$;

revoke execute on function private.data_vencimento_mes(date, int) from public, anon;
grant execute on function private.data_vencimento_mes(date, int) to authenticated;

create or replace function public.criar_contrato_com_pagamentos(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contrato public.contratos;
  v_tipo text := p_payload->>'tipo';
  v_inicio date := (p_payload->>'data_inicio')::date;
  v_duracao int := nullif(p_payload->>'duracao_meses', '')::int;
  v_mes date;
  v_valor numeric(12,2);
  v_bruto numeric(12,2);
  v_i int;
begin
  if not (select private.tem_papel(array['admin', 'corretor'])) then
    raise exception 'Sem permissao para criar contratos.';
  end if;

  if v_tipo in ('aluguel', 'administracao') and (coalesce(v_duracao, 0) < 1 or v_duracao > 60) then
    raise exception 'A duracao do contrato deve estar entre 1 e 60 meses.';
  end if;

  if v_tipo = 'venda'
     and coalesce(nullif(p_payload->>'valor_comissao_fixo', '')::numeric, 0) <= 0
     and coalesce(nullif(p_payload->>'percentual_comissao', '')::numeric, 0) <= 0 then
    raise exception 'Informe uma comissao de venda maior que zero.';
  end if;

  insert into public.contratos (
    imovel_id, pessoa_id, tipo, numero_contrato, valor_aluguel, dia_pagamento,
    data_inicio, duracao_meses, vigencia_final, periodo_visita_dias,
    data_ultima_visita, forma_comissao_venda, percentual_comissao,
    valor_comissao_fixo, valor_venda, status, observacoes
  ) values (
    (p_payload->>'imovel_id')::uuid,
    nullif(p_payload->>'pessoa_id', '')::uuid,
    v_tipo,
    private.proximo_numero_contrato(extract(year from v_inicio)::int),
    nullif(p_payload->>'valor_aluguel', '')::numeric,
    nullif(p_payload->>'dia_pagamento', '')::int,
    v_inicio,
    v_duracao,
    case when v_duracao is null then null else (v_inicio + make_interval(months => v_duracao))::date end,
    nullif(p_payload->>'periodo_visita_dias', '')::int,
    case when nullif(p_payload->>'periodo_visita_dias', '') is null then null else v_inicio end,
    nullif(p_payload->>'forma_comissao_venda', ''),
    nullif(p_payload->>'percentual_comissao', '')::numeric,
    nullif(p_payload->>'valor_comissao_fixo', '')::numeric,
    nullif(p_payload->>'valor_venda', '')::numeric,
    'ativo',
    nullif(p_payload->>'observacoes', '')
  )
  returning * into v_contrato;

  if v_tipo = 'administracao' then
    v_bruto := coalesce(v_contrato.valor_aluguel, 0);
    v_valor := round(v_bruto * 0.10, 2);
    for v_i in 0..(v_duracao - 1) loop
      v_mes := (date_trunc('month', v_inicio) + make_interval(months => v_i))::date;
      insert into public.pagamentos_mensais (
        contrato_id, mes_referencia, valor_bruto, valor, data_vencimento, status
      ) values (
        v_contrato.id, v_mes, v_bruto, v_valor,
        private.data_vencimento_mes(v_mes, v_contrato.dia_pagamento), 'pendente'
      );
    end loop;
  elsif v_tipo = 'aluguel' then
    v_mes := date_trunc('month', v_inicio)::date;
    v_valor := coalesce(v_contrato.valor_aluguel, 0);
    insert into public.pagamentos_mensais (
      contrato_id, mes_referencia, valor_bruto, valor, data_vencimento, status
    ) values (
      v_contrato.id, v_mes, v_valor, v_valor,
      private.data_vencimento_mes(v_mes, v_contrato.dia_pagamento), 'pendente'
    );
  else
    v_mes := date_trunc('month', v_inicio)::date;
    v_valor := case
      when v_contrato.forma_comissao_venda = 'fixo'
        then coalesce(v_contrato.valor_comissao_fixo, 0)
      else round(coalesce(v_contrato.valor_venda, 0) * coalesce(v_contrato.percentual_comissao, 0) / 100, 2)
    end;
    insert into public.pagamentos_mensais (
      contrato_id, mes_referencia, valor_bruto, valor, data_vencimento, status
    ) values (
      v_contrato.id, v_mes, coalesce(v_contrato.valor_venda, 0), v_valor, v_inicio, 'pendente'
    );
  end if;

  return to_jsonb(v_contrato);
end;
$$;

revoke execute on function public.criar_contrato_com_pagamentos(jsonb) from public, anon;
grant execute on function public.criar_contrato_com_pagamentos(jsonb) to authenticated;

create or replace function public.atualizar_contrato_com_pagamentos(p_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_atual public.contratos;
  v_contrato public.contratos;
  v_inicio date := (p_payload->>'data_inicio')::date;
  v_duracao int := nullif(p_payload->>'duracao_meses', '')::int;
  v_mes_inicio date := date_trunc('month', v_inicio)::date;
  v_mes_fim date;
  v_i int;
  v_mes date;
  v_valor numeric(12,2);
  v_bruto numeric(12,2);
begin
  if not (select private.tem_papel(array['admin', 'corretor'])) then
    raise exception 'Sem permissao para alterar contratos.';
  end if;

  select * into v_atual
  from public.contratos
  where id = p_id
  for update;

  if not found then
    raise exception 'Contrato nao encontrado.';
  end if;

  if v_atual.tipo in ('aluguel', 'administracao') and (coalesce(v_duracao, 0) < 1 or v_duracao > 60) then
    raise exception 'A duracao do contrato deve estar entre 1 e 60 meses.';
  end if;

  v_mes_fim := case
    when v_duracao is null then v_mes_inicio
    else (v_mes_inicio + make_interval(months => v_duracao))::date
  end;

  if (
    v_atual.tipo = 'administracao'
    and exists (
      select 1
      from public.pagamentos_mensais
      where contrato_id = p_id
        and status = 'pago'
        and (mes_referencia < v_mes_inicio or mes_referencia >= v_mes_fim)
    )
  ) or (
    v_atual.tipo <> 'administracao'
    and exists (
      select 1
      from public.pagamentos_mensais
      where contrato_id = p_id
        and status = 'pago'
        and mes_referencia <> v_mes_inicio
    )
  ) then
    raise exception 'Nao e possivel excluir meses que ja possuem pagamentos quitados.';
  end if;

  if v_atual.tipo = 'venda'
     and coalesce(nullif(p_payload->>'valor_comissao_fixo', '')::numeric, 0) <= 0
     and coalesce(nullif(p_payload->>'percentual_comissao', '')::numeric, 0) <= 0 then
    raise exception 'Informe uma comissao de venda maior que zero.';
  end if;

  update public.contratos c
  set pessoa_id = nullif(p_payload->>'pessoa_id', '')::uuid,
      valor_aluguel = nullif(p_payload->>'valor_aluguel', '')::numeric,
      dia_pagamento = nullif(p_payload->>'dia_pagamento', '')::int,
      data_inicio = v_inicio,
      duracao_meses = v_duracao,
      vigencia_final = case when v_duracao is null then null else (v_inicio + make_interval(months => v_duracao))::date end,
      periodo_visita_dias = nullif(p_payload->>'periodo_visita_dias', '')::int,
      forma_comissao_venda = nullif(p_payload->>'forma_comissao_venda', ''),
      percentual_comissao = nullif(p_payload->>'percentual_comissao', '')::numeric,
      valor_comissao_fixo = nullif(p_payload->>'valor_comissao_fixo', '')::numeric,
      valor_venda = nullif(p_payload->>'valor_venda', '')::numeric,
      status = coalesce(nullif(p_payload->>'status', ''), c.status),
      observacoes = nullif(p_payload->>'observacoes', '')
  where id = p_id
  returning * into v_contrato;

  if v_contrato.tipo = 'administracao' then
    v_bruto := coalesce(v_contrato.valor_aluguel, 0);
    v_valor := round(v_bruto * 0.10, 2);

    delete from public.pagamentos_mensais
    where contrato_id = p_id
      and status <> 'pago'
      and (mes_referencia < v_mes_inicio or mes_referencia >= v_mes_fim);

    for v_i in 0..(v_duracao - 1) loop
      v_mes := (v_mes_inicio + make_interval(months => v_i))::date;
      insert into public.pagamentos_mensais (
        contrato_id, mes_referencia, valor_bruto, valor, data_vencimento, status
      ) values (
        p_id, v_mes, v_bruto, v_valor,
        private.data_vencimento_mes(v_mes, v_contrato.dia_pagamento), 'pendente'
      )
      on conflict (contrato_id, mes_referencia) do update
      set valor_bruto = excluded.valor_bruto,
          valor = excluded.valor,
          data_vencimento = excluded.data_vencimento
      where public.pagamentos_mensais.status <> 'pago';
    end loop;
  else
    v_mes := v_mes_inicio;
    v_valor := case
      when v_contrato.tipo = 'aluguel' then coalesce(v_contrato.valor_aluguel, 0)
      when v_contrato.forma_comissao_venda = 'fixo' then coalesce(v_contrato.valor_comissao_fixo, 0)
      else round(coalesce(v_contrato.valor_venda, 0) * coalesce(v_contrato.percentual_comissao, 0) / 100, 2)
    end;
    v_bruto := case
      when v_contrato.tipo = 'venda' then coalesce(v_contrato.valor_venda, 0)
      else v_valor
    end;

    delete from public.pagamentos_mensais
    where contrato_id = p_id
      and status <> 'pago'
      and mes_referencia <> v_mes;

    insert into public.pagamentos_mensais (
      contrato_id, mes_referencia, valor_bruto, valor, data_vencimento, status
    ) values (
      p_id, v_mes, v_bruto, v_valor,
      case when v_contrato.tipo = 'venda'
        then v_inicio
        else private.data_vencimento_mes(v_mes, v_contrato.dia_pagamento)
      end,
      'pendente'
    )
    on conflict (contrato_id, mes_referencia) do update
    set valor_bruto = excluded.valor_bruto,
        valor = excluded.valor,
        data_vencimento = excluded.data_vencimento
    where public.pagamentos_mensais.status <> 'pago';
  end if;

  return to_jsonb(v_contrato);
end;
$$;

revoke execute on function public.atualizar_contrato_com_pagamentos(uuid, jsonb) from public, anon;
grant execute on function public.atualizar_contrato_com_pagamentos(uuid, jsonb) to authenticated;

-- ========== RLS POR RESPONSABILIDADE ==========
-- Leitura permanece disponivel para a equipe; escrita e exclusao seguem o papel.
do $$
declare
  t text;
begin
  foreach t in array array[
    'proprietarios', 'pessoas', 'imoveis', 'contratos', 'pagamentos_mensais',
    'contas_consumo', 'laudos_vistoria', 'notas_fiscais', 'numeracao_contratos',
    'modelos_contrato', 'contratos_gerados'
  ]
  loop
    execute format('drop policy if exists "authenticated_full_access" on public.%I', t);
    execute format('drop policy if exists "equipe_select" on public.%I', t);
    execute format(
      'create policy "equipe_select" on public.%I for select to authenticated using (true)',
      t
    );
  end loop;
end $$;

-- Cadastros e operacao: admin/corretor escrevem; somente admin exclui.
do $$
declare
  t text;
begin
  foreach t in array array[
    'proprietarios', 'pessoas', 'imoveis', 'contratos',
    'laudos_vistoria', 'modelos_contrato', 'contratos_gerados'
  ]
  loop
    execute format('drop policy if exists "operacao_insert" on public.%I', t);
    execute format('drop policy if exists "operacao_update" on public.%I', t);
    execute format('drop policy if exists "admin_delete" on public.%I', t);
    execute format(
      'create policy "operacao_insert" on public.%I for insert to authenticated with check ((select private.tem_papel(array[''admin'', ''corretor''])))',
      t
    );
    execute format(
      'create policy "operacao_update" on public.%I for update to authenticated using ((select private.tem_papel(array[''admin'', ''corretor'']))) with check ((select private.tem_papel(array[''admin'', ''corretor''])))',
      t
    );
    execute format(
      'create policy "admin_delete" on public.%I for delete to authenticated using ((select private.tem_papel(array[''admin''])))',
      t
    );
  end loop;
end $$;

-- Numeracao: usada apenas dentro da transacao de criacao.
drop policy if exists "numeracao_insert" on public.numeracao_contratos;
drop policy if exists "numeracao_update" on public.numeracao_contratos;
drop policy if exists "numeracao_admin_delete" on public.numeracao_contratos;
create policy "numeracao_insert" on public.numeracao_contratos
for insert to authenticated
with check ((select private.tem_papel(array['admin', 'corretor'])));
create policy "numeracao_update" on public.numeracao_contratos
for update to authenticated
using ((select private.tem_papel(array['admin', 'corretor'])))
with check ((select private.tem_papel(array['admin', 'corretor'])));
create policy "numeracao_admin_delete" on public.numeracao_contratos
for delete to authenticated
using ((select private.tem_papel(array['admin'])));

-- Financeiro: financeiro/admin atualizam; corretor so cria parcelas pela operacao do contrato.
drop policy if exists "financeiro_insert" on public.pagamentos_mensais;
drop policy if exists "financeiro_update" on public.pagamentos_mensais;
drop policy if exists "admin_delete" on public.pagamentos_mensais;
create policy "financeiro_insert" on public.pagamentos_mensais
for insert to authenticated
with check ((select private.tem_papel(array['admin', 'financeiro', 'corretor'])));
create policy "financeiro_update" on public.pagamentos_mensais
for update to authenticated
using (
  (select private.tem_papel(array['admin', 'financeiro']))
  or ((select private.tem_papel(array['corretor'])) and status <> 'pago')
)
with check (
  (select private.tem_papel(array['admin', 'financeiro']))
  or ((select private.tem_papel(array['corretor'])) and status <> 'pago')
);
create policy "admin_delete" on public.pagamentos_mensais
for delete to authenticated
using ((select private.tem_papel(array['admin'])));

do $$
declare
  t text;
begin
  foreach t in array array['contas_consumo', 'notas_fiscais']
  loop
    execute format('drop policy if exists "financeiro_insert" on public.%I', t);
    execute format('drop policy if exists "financeiro_update" on public.%I', t);
    execute format('drop policy if exists "admin_delete" on public.%I', t);
    execute format(
      'create policy "financeiro_insert" on public.%I for insert to authenticated with check ((select private.tem_papel(array[''admin'', ''financeiro''])))',
      t
    );
    execute format(
      'create policy "financeiro_update" on public.%I for update to authenticated using ((select private.tem_papel(array[''admin'', ''financeiro'']))) with check ((select private.tem_papel(array[''admin'', ''financeiro''])))',
      t
    );
    execute format(
      'create policy "admin_delete" on public.%I for delete to authenticated using ((select private.tem_papel(array[''admin''])))',
      t
    );
  end loop;
end $$;

-- Excecoes de exclusao: arquivos operacionais e registros financeiros.
drop policy if exists "admin_delete" on public.laudos_vistoria;
drop policy if exists "operacao_delete" on public.laudos_vistoria;
create policy "operacao_delete" on public.laudos_vistoria
for delete to authenticated
using ((select private.tem_papel(array['admin', 'corretor'])));

drop policy if exists "admin_delete" on public.contas_consumo;
drop policy if exists "financeiro_delete" on public.contas_consumo;
create policy "financeiro_delete" on public.contas_consumo
for delete to authenticated
using ((select private.tem_papel(array['admin', 'financeiro'])));

drop policy if exists "admin_delete" on public.notas_fiscais;
drop policy if exists "financeiro_delete" on public.notas_fiscais;
create policy "financeiro_delete" on public.notas_fiscais
for delete to authenticated
using ((select private.tem_papel(array['admin', 'financeiro'])));

-- Privilegios explicitos exigidos pelos projetos Supabase atuais.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.proprietarios, public.pessoas, public.imoveis, public.contratos,
  public.pagamentos_mensais, public.contas_consumo, public.laudos_vistoria,
  public.notas_fiscais, public.numeracao_contratos, public.modelos_contrato,
  public.contratos_gerados, public.perfis
to authenticated;

revoke all on table
  public.proprietarios, public.pessoas, public.imoveis, public.contratos,
  public.pagamentos_mensais, public.contas_consumo, public.laudos_vistoria,
  public.notas_fiscais, public.numeracao_contratos, public.modelos_contrato,
  public.contratos_gerados, public.perfis
from anon;

-- Storage: leitura para autenticados; escrita e exclusao por responsabilidade.
drop policy if exists "authenticated_write_laudos" on storage.objects;
drop policy if exists "authenticated_delete_laudos" on storage.objects;
drop policy if exists "authenticated_write_notas" on storage.objects;
drop policy if exists "authenticated_delete_notas" on storage.objects;
drop policy if exists "authenticated_write_papel_timbrado" on storage.objects;
drop policy if exists "authenticated_update_papel_timbrado" on storage.objects;
drop policy if exists "authenticated_delete_papel_timbrado" on storage.objects;
drop policy if exists "operacao_write_laudos" on storage.objects;
drop policy if exists "admin_delete_laudos" on storage.objects;
drop policy if exists "financeiro_write_notas" on storage.objects;
drop policy if exists "admin_delete_notas" on storage.objects;
drop policy if exists "admin_insert_papel_timbrado" on storage.objects;
drop policy if exists "admin_update_papel_timbrado" on storage.objects;
drop policy if exists "admin_delete_papel_timbrado" on storage.objects;

create policy "operacao_write_laudos" on storage.objects
for insert to authenticated
with check (bucket_id = 'laudos-vistoria' and (select private.tem_papel(array['admin', 'corretor'])));
create policy "admin_delete_laudos" on storage.objects
for delete to authenticated
using (bucket_id = 'laudos-vistoria' and (select private.tem_papel(array['admin', 'corretor'])));

create policy "financeiro_write_notas" on storage.objects
for insert to authenticated
with check (bucket_id = 'notas-fiscais' and (select private.tem_papel(array['admin', 'financeiro'])));
create policy "admin_delete_notas" on storage.objects
for delete to authenticated
using (bucket_id = 'notas-fiscais' and (select private.tem_papel(array['admin', 'financeiro'])));

create policy "admin_insert_papel_timbrado" on storage.objects
for insert to authenticated
with check (bucket_id = 'papel-timbrado' and (select private.tem_papel(array['admin'])));
create policy "admin_update_papel_timbrado" on storage.objects
for update to authenticated
using (bucket_id = 'papel-timbrado' and (select private.tem_papel(array['admin'])))
with check (bucket_id = 'papel-timbrado' and (select private.tem_papel(array['admin'])));
create policy "admin_delete_papel_timbrado" on storage.objects
for delete to authenticated
using (bucket_id = 'papel-timbrado' and (select private.tem_papel(array['admin'])));
