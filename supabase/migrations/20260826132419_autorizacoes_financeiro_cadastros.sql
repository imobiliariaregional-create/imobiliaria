-- Autorizações de administração, dados bancários e fluxo financeiro configurável.

alter table public.proprietarios add column if not exists tipo_chave_pix text;
alter table public.proprietarios add column if not exists titular_conta text;
alter table public.proprietarios drop constraint if exists proprietarios_tipo_chave_pix_check;
alter table public.proprietarios add constraint proprietarios_tipo_chave_pix_check
  check (tipo_chave_pix is null or tipo_chave_pix in ('cpf', 'cnpj', 'telefone', 'email', 'aleatoria'));
alter table public.proprietarios drop constraint if exists proprietarios_telefone_formato_check;
alter table public.proprietarios add constraint proprietarios_telefone_formato_check
  check (telefone is null or telefone ~ '^\([1-9][0-9]\) [0-9]{4,5}-[0-9]{4}$') not valid;
alter table public.pessoas drop constraint if exists pessoas_telefone_formato_check;
alter table public.pessoas add constraint pessoas_telefone_formato_check
  check (telefone is null or telefone ~ '^\([1-9][0-9]\) [0-9]{4,5}-[0-9]{4}$') not valid;

alter table public.contratos add column if not exists percentual_administracao numeric(5,2);
alter table public.contratos add column if not exists recebimento_aluguel text;
update public.contratos set percentual_administracao = 10 where tipo = 'administracao' and percentual_administracao is null;
update public.contratos set recebimento_aluguel = 'imobiliaria' where tipo = 'administracao' and recebimento_aluguel is null;
alter table public.contratos drop constraint if exists contratos_percentual_administracao_check;
alter table public.contratos add constraint contratos_percentual_administracao_check
  check (percentual_administracao is null or percentual_administracao > 0 and percentual_administracao <= 100);
alter table public.contratos drop constraint if exists contratos_recebimento_aluguel_check;
alter table public.contratos add constraint contratos_recebimento_aluguel_check
  check (recebimento_aluguel is null or recebimento_aluguel in ('imobiliaria', 'proprietario'));
alter table public.contratos drop constraint if exists contratos_administracao_financeiro_check;
alter table public.contratos add constraint contratos_administracao_financeiro_check
  check (tipo <> 'administracao' or percentual_administracao is not null and recebimento_aluguel is not null);

alter table public.notas_fiscais add column if not exists pagamento_mensal_id uuid references public.pagamentos_mensais(id) on delete set null;
create index if not exists idx_notas_pagamento on public.notas_fiscais(pagamento_mensal_id);

create or replace function private.validar_nota_pagamento()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pagamento_mensal_id is not null then
    if new.contrato_id is null then
      select contrato_id into new.contrato_id from public.pagamentos_mensais where id = new.pagamento_mensal_id;
    elsif not exists (select 1 from public.pagamentos_mensais where id = new.pagamento_mensal_id and contrato_id = new.contrato_id) then
      raise exception 'A receita selecionada nao pertence ao contrato informado.';
    end if;
  end if;
  return new;
end; $$;
revoke execute on function private.validar_nota_pagamento() from public, anon, authenticated;
drop trigger if exists validar_nota_pagamento on public.notas_fiscais;
create trigger validar_nota_pagamento before insert or update of pagamento_mensal_id, contrato_id on public.notas_fiscais
for each row execute function private.validar_nota_pagamento();

create table if not exists public.autorizacoes_administracao (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references public.proprietarios(id) on delete restrict,
  numero text,
  data_inicio date not null default current_date,
  data_fim date,
  status text not null default 'ativa' check (status in ('ativa', 'encerrada', 'cancelada')),
  observacoes text,
  drive_file_id text,
  drive_file_name text,
  drive_mime_type text,
  drive_file_size bigint check (drive_file_size is null or drive_file_size >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint autorizacao_periodo_valido check (data_fim is null or data_fim >= data_inicio)
);

create table if not exists public.autorizacao_imoveis (
  autorizacao_id uuid not null references public.autorizacoes_administracao(id) on delete cascade,
  imovel_id uuid not null references public.imoveis(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (autorizacao_id, imovel_id)
);
create index if not exists idx_autorizacoes_proprietario on public.autorizacoes_administracao(proprietario_id);
create index if not exists idx_autorizacoes_status on public.autorizacoes_administracao(status);
create index if not exists idx_autorizacao_imoveis_imovel on public.autorizacao_imoveis(imovel_id);

create or replace function private.validar_imovel_autorizacao()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.autorizacoes_administracao a
    join public.imoveis i on i.id = new.imovel_id
    where a.id = new.autorizacao_id and i.proprietario_id = a.proprietario_id
  ) then raise exception 'O imovel deve pertencer ao proprietario da autorizacao.'; end if;
  return new;
end; $$;
revoke execute on function private.validar_imovel_autorizacao() from public, anon, authenticated;
drop trigger if exists validar_imovel_autorizacao on public.autorizacao_imoveis;
create trigger validar_imovel_autorizacao before insert or update on public.autorizacao_imoveis
for each row execute function private.validar_imovel_autorizacao();

create or replace function private.validar_proprietario_autorizacao()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.proprietario_id is distinct from old.proprietario_id and exists (
    select 1 from public.autorizacao_imoveis ai
    join public.imoveis i on i.id = ai.imovel_id
    where ai.autorizacao_id = new.id and i.proprietario_id is distinct from new.proprietario_id
  ) then raise exception 'Remova os imoveis antes de alterar o proprietario da autorizacao.'; end if;
  return new;
end; $$;
revoke execute on function private.validar_proprietario_autorizacao() from public, anon, authenticated;
drop trigger if exists validar_proprietario_autorizacao on public.autorizacoes_administracao;
create trigger validar_proprietario_autorizacao before update of proprietario_id on public.autorizacoes_administracao
for each row execute function private.validar_proprietario_autorizacao();

create or replace function private.atualizar_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke execute on function private.atualizar_updated_at() from public, anon, authenticated;
drop trigger if exists autorizacoes_updated_at on public.autorizacoes_administracao;
create trigger autorizacoes_updated_at before update on public.autorizacoes_administracao
for each row execute function private.atualizar_updated_at();

alter table public.autorizacoes_administracao enable row level security;
alter table public.autorizacao_imoveis enable row level security;
drop policy if exists "equipe_select" on public.autorizacoes_administracao;
drop policy if exists "operacao_insert" on public.autorizacoes_administracao;
drop policy if exists "operacao_update" on public.autorizacoes_administracao;
drop policy if exists "admin_delete" on public.autorizacoes_administracao;
create policy "equipe_select" on public.autorizacoes_administracao for select to authenticated using (true);
create policy "operacao_insert" on public.autorizacoes_administracao for insert to authenticated with check ((select private.tem_papel(array['admin','corretor'])));
create policy "operacao_update" on public.autorizacoes_administracao for update to authenticated using ((select private.tem_papel(array['admin','corretor']))) with check ((select private.tem_papel(array['admin','corretor'])));
create policy "admin_delete" on public.autorizacoes_administracao for delete to authenticated using ((select private.tem_papel(array['admin'])));
drop policy if exists "equipe_select" on public.autorizacao_imoveis;
drop policy if exists "operacao_insert" on public.autorizacao_imoveis;
drop policy if exists "operacao_delete" on public.autorizacao_imoveis;
create policy "equipe_select" on public.autorizacao_imoveis for select to authenticated using (true);
create policy "operacao_insert" on public.autorizacao_imoveis for insert to authenticated with check ((select private.tem_papel(array['admin','corretor'])));
create policy "operacao_delete" on public.autorizacao_imoveis for delete to authenticated using ((select private.tem_papel(array['admin','corretor'])));
grant select, insert, update, delete on public.autorizacoes_administracao, public.autorizacao_imoveis to authenticated;
revoke all on public.autorizacoes_administracao, public.autorizacao_imoveis from anon;

create or replace function public.salvar_autorizacao_administracao(p_id uuid, p_payload jsonb, p_imoveis uuid[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_autorizacao public.autorizacoes_administracao; v_imovel uuid;
begin
  if not (select private.tem_papel(array['admin','corretor'])) then raise exception 'Sem permissao para salvar autorizacoes.'; end if;
  if coalesce(array_length(p_imoveis,1),0)=0 then raise exception 'Selecione pelo menos um imovel.'; end if;
  if p_id is null then
    insert into public.autorizacoes_administracao (proprietario_id,numero,data_inicio,data_fim,status,observacoes,drive_file_id,drive_file_name,drive_mime_type,drive_file_size)
    values ((p_payload->>'proprietario_id')::uuid,nullif(p_payload->>'numero',''),(p_payload->>'data_inicio')::date,nullif(p_payload->>'data_fim','')::date,coalesce(nullif(p_payload->>'status',''),'ativa'),nullif(p_payload->>'observacoes',''),nullif(p_payload->>'drive_file_id',''),nullif(p_payload->>'drive_file_name',''),nullif(p_payload->>'drive_mime_type',''),nullif(p_payload->>'drive_file_size','')::bigint)
    returning * into v_autorizacao;
  else
    update public.autorizacoes_administracao a set proprietario_id=(p_payload->>'proprietario_id')::uuid,numero=nullif(p_payload->>'numero',''),data_inicio=(p_payload->>'data_inicio')::date,data_fim=nullif(p_payload->>'data_fim','')::date,status=coalesce(nullif(p_payload->>'status',''),a.status),observacoes=nullif(p_payload->>'observacoes',''),drive_file_id=coalesce(nullif(p_payload->>'drive_file_id',''),a.drive_file_id),drive_file_name=coalesce(nullif(p_payload->>'drive_file_name',''),a.drive_file_name),drive_mime_type=coalesce(nullif(p_payload->>'drive_mime_type',''),a.drive_mime_type),drive_file_size=coalesce(nullif(p_payload->>'drive_file_size','')::bigint,a.drive_file_size)
    where id=p_id returning * into v_autorizacao;
    if not found then raise exception 'Autorizacao nao encontrada.'; end if;
  end if;
  delete from public.autorizacao_imoveis where autorizacao_id=v_autorizacao.id;
  foreach v_imovel in array p_imoveis loop insert into public.autorizacao_imoveis (autorizacao_id,imovel_id) values (v_autorizacao.id,v_imovel); end loop;
  return to_jsonb(v_autorizacao);
end; $$;
revoke execute on function public.salvar_autorizacao_administracao(uuid,jsonb,uuid[]) from public, anon;
grant execute on function public.salvar_autorizacao_administracao(uuid,jsonb,uuid[]) to authenticated;

create or replace function public.criar_contrato_com_pagamentos(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_contrato public.contratos;
  v_tipo text := p_payload->>'tipo';
  v_inicio date := (p_payload->>'data_inicio')::date;
  v_duracao int := nullif(p_payload->>'duracao_meses','')::int;
  v_mes date; v_valor numeric(12,2); v_bruto numeric(12,2); v_i int;
begin
  if not (select private.tem_papel(array['admin','corretor'])) then raise exception 'Sem permissao para criar contratos.'; end if;
  if v_tipo in ('aluguel','administracao') and (coalesce(v_duracao,0) < 1 or v_duracao > 60) then raise exception 'A duracao do contrato deve estar entre 1 e 60 meses.'; end if;
  if v_tipo = 'venda' and coalesce(nullif(p_payload->>'valor_comissao_fixo','')::numeric,0) <= 0 and coalesce(nullif(p_payload->>'percentual_comissao','')::numeric,0) <= 0 then raise exception 'Informe uma comissao de venda maior que zero.'; end if;
  insert into public.contratos (imovel_id,pessoa_id,tipo,numero_contrato,valor_aluguel,percentual_administracao,recebimento_aluguel,dia_pagamento,data_inicio,duracao_meses,vigencia_final,periodo_visita_dias,data_ultima_visita,forma_comissao_venda,percentual_comissao,valor_comissao_fixo,valor_venda,status,observacoes)
  values ((p_payload->>'imovel_id')::uuid,nullif(p_payload->>'pessoa_id','')::uuid,v_tipo,private.proximo_numero_contrato(extract(year from v_inicio)::int),nullif(p_payload->>'valor_aluguel','')::numeric,case when v_tipo='administracao' then coalesce(nullif(p_payload->>'percentual_administracao','')::numeric,10) end,case when v_tipo='administracao' then coalesce(nullif(p_payload->>'recebimento_aluguel',''),'imobiliaria') end,nullif(p_payload->>'dia_pagamento','')::int,v_inicio,v_duracao,case when v_duracao is null then null else (v_inicio+make_interval(months=>v_duracao))::date end,nullif(p_payload->>'periodo_visita_dias','')::int,case when nullif(p_payload->>'periodo_visita_dias','') is null then null else v_inicio end,nullif(p_payload->>'forma_comissao_venda',''),nullif(p_payload->>'percentual_comissao','')::numeric,nullif(p_payload->>'valor_comissao_fixo','')::numeric,nullif(p_payload->>'valor_venda','')::numeric,'ativo',nullif(p_payload->>'observacoes','')) returning * into v_contrato;
  if v_tipo = 'administracao' then
    v_bruto := coalesce(v_contrato.valor_aluguel,0); v_valor := round(v_bruto * coalesce(v_contrato.percentual_administracao,10) / 100,2);
    for v_i in 0..v_duracao-1 loop v_mes := (date_trunc('month',v_inicio)+make_interval(months=>v_i))::date;
      insert into public.pagamentos_mensais (contrato_id,mes_referencia,valor_bruto,valor,data_vencimento,status) values (v_contrato.id,v_mes,v_bruto,v_valor,private.data_vencimento_mes(v_mes,v_contrato.dia_pagamento),'pendente');
    end loop;
  elsif v_tipo = 'aluguel' then
    v_mes := date_trunc('month',v_inicio)::date; v_valor := coalesce(v_contrato.valor_aluguel,0);
    insert into public.pagamentos_mensais (contrato_id,mes_referencia,valor_bruto,valor,data_vencimento,status) values (v_contrato.id,v_mes,v_valor,v_valor,private.data_vencimento_mes(v_mes,v_contrato.dia_pagamento),'pendente');
  else
    v_mes := date_trunc('month',v_inicio)::date; v_valor := case when v_contrato.forma_comissao_venda='fixo' then coalesce(v_contrato.valor_comissao_fixo,0) else round(coalesce(v_contrato.valor_venda,0)*coalesce(v_contrato.percentual_comissao,0)/100,2) end;
    insert into public.pagamentos_mensais (contrato_id,mes_referencia,valor_bruto,valor,data_vencimento,status) values (v_contrato.id,v_mes,coalesce(v_contrato.valor_venda,0),v_valor,v_inicio,'pendente');
  end if;
  return to_jsonb(v_contrato);
end; $$;
revoke execute on function public.criar_contrato_com_pagamentos(jsonb) from public, anon;
grant execute on function public.criar_contrato_com_pagamentos(jsonb) to authenticated;

create or replace function public.atualizar_contrato_com_pagamentos(p_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_atual public.contratos; v_contrato public.contratos; v_inicio date := (p_payload->>'data_inicio')::date; v_duracao int := nullif(p_payload->>'duracao_meses','')::int;
  v_mes_inicio date := date_trunc('month',v_inicio)::date; v_mes_fim date; v_i int; v_mes date; v_valor numeric(12,2); v_bruto numeric(12,2);
begin
  if not (select private.tem_papel(array['admin','corretor'])) then raise exception 'Sem permissao para alterar contratos.'; end if;
  select * into v_atual from public.contratos where id=p_id for update; if not found then raise exception 'Contrato nao encontrado.'; end if;
  if v_atual.tipo in ('aluguel','administracao') and (coalesce(v_duracao,0)<1 or v_duracao>60) then raise exception 'A duracao do contrato deve estar entre 1 e 60 meses.'; end if;
  if v_atual.tipo='venda' and coalesce(nullif(p_payload->>'valor_comissao_fixo','')::numeric,0)<=0 and coalesce(nullif(p_payload->>'percentual_comissao','')::numeric,0)<=0 then raise exception 'Informe uma comissao de venda maior que zero.'; end if;
  v_mes_fim := case when v_duracao is null then v_mes_inicio else (v_mes_inicio+make_interval(months=>v_duracao))::date end;
  if (v_atual.tipo='administracao' and exists(select 1 from public.pagamentos_mensais where contrato_id=p_id and status='pago' and (mes_referencia<v_mes_inicio or mes_referencia>=v_mes_fim))) or (v_atual.tipo<>'administracao' and exists(select 1 from public.pagamentos_mensais where contrato_id=p_id and status='pago' and mes_referencia<>v_mes_inicio)) then raise exception 'Nao e possivel excluir meses que ja possuem pagamentos quitados.'; end if;
  update public.contratos c set pessoa_id=nullif(p_payload->>'pessoa_id','')::uuid,valor_aluguel=nullif(p_payload->>'valor_aluguel','')::numeric,percentual_administracao=case when c.tipo='administracao' then coalesce(nullif(p_payload->>'percentual_administracao','')::numeric,10) end,recebimento_aluguel=case when c.tipo='administracao' then coalesce(nullif(p_payload->>'recebimento_aluguel',''),'imobiliaria') end,dia_pagamento=nullif(p_payload->>'dia_pagamento','')::int,data_inicio=v_inicio,duracao_meses=v_duracao,vigencia_final=case when v_duracao is null then null else (v_inicio+make_interval(months=>v_duracao))::date end,periodo_visita_dias=nullif(p_payload->>'periodo_visita_dias','')::int,forma_comissao_venda=nullif(p_payload->>'forma_comissao_venda',''),percentual_comissao=nullif(p_payload->>'percentual_comissao','')::numeric,valor_comissao_fixo=nullif(p_payload->>'valor_comissao_fixo','')::numeric,valor_venda=nullif(p_payload->>'valor_venda','')::numeric,status=coalesce(nullif(p_payload->>'status',''),c.status),observacoes=nullif(p_payload->>'observacoes','') where id=p_id returning * into v_contrato;
  if v_contrato.tipo='administracao' then
    v_bruto:=coalesce(v_contrato.valor_aluguel,0); v_valor:=round(v_bruto*coalesce(v_contrato.percentual_administracao,10)/100,2);
    delete from public.pagamentos_mensais where contrato_id=p_id and status<>'pago' and (mes_referencia<v_mes_inicio or mes_referencia>=v_mes_fim);
    for v_i in 0..v_duracao-1 loop v_mes:=(v_mes_inicio+make_interval(months=>v_i))::date;
      insert into public.pagamentos_mensais (contrato_id,mes_referencia,valor_bruto,valor,data_vencimento,status) values (p_id,v_mes,v_bruto,v_valor,private.data_vencimento_mes(v_mes,v_contrato.dia_pagamento),'pendente') on conflict (contrato_id,mes_referencia) do update set valor_bruto=excluded.valor_bruto,valor=excluded.valor,data_vencimento=excluded.data_vencimento where public.pagamentos_mensais.status<>'pago';
    end loop;
  else
    v_mes:=v_mes_inicio; v_valor:=case when v_contrato.tipo='aluguel' then coalesce(v_contrato.valor_aluguel,0) when v_contrato.forma_comissao_venda='fixo' then coalesce(v_contrato.valor_comissao_fixo,0) else round(coalesce(v_contrato.valor_venda,0)*coalesce(v_contrato.percentual_comissao,0)/100,2) end; v_bruto:=case when v_contrato.tipo='venda' then coalesce(v_contrato.valor_venda,0) else v_valor end;
    delete from public.pagamentos_mensais where contrato_id=p_id and status<>'pago' and mes_referencia<>v_mes;
    insert into public.pagamentos_mensais (contrato_id,mes_referencia,valor_bruto,valor,data_vencimento,status) values (p_id,v_mes,v_bruto,v_valor,case when v_contrato.tipo='venda' then v_inicio else private.data_vencimento_mes(v_mes,v_contrato.dia_pagamento) end,'pendente') on conflict (contrato_id,mes_referencia) do update set valor_bruto=excluded.valor_bruto,valor=excluded.valor,data_vencimento=excluded.data_vencimento where public.pagamentos_mensais.status<>'pago';
  end if;
  return to_jsonb(v_contrato);
end; $$;
revoke execute on function public.atualizar_contrato_com_pagamentos(uuid,jsonb) from public, anon;
grant execute on function public.atualizar_contrato_com_pagamentos(uuid,jsonb) to authenticated;
