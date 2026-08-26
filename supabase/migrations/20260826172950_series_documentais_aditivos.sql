-- Series anuais independentes para cada classe documental.
-- Os contadores ficam fora da Data API e a alocacao usa UPSERT atomico.
create table if not exists private.series_documentais (
  tipo text not null check (tipo in ('contrato','aditivo','laudo','autorizacao')),
  ano integer not null check (ano between 2000 and 2200),
  ultimo_numero integer not null default 0 check (ultimo_numero >= 0),
  primary key (tipo, ano)
);

alter table private.series_documentais enable row level security;
revoke all on private.series_documentais from public, anon, authenticated;

-- Continua a serie de contratos ja utilizada pelo sistema.
insert into private.series_documentais (tipo, ano, ultimo_numero)
select 'contrato', ano, seq from public.numeracao_contratos
on conflict (tipo, ano) do update
set ultimo_numero = greatest(private.series_documentais.ultimo_numero, excluded.ultimo_numero);

-- A tabela antiga permanece apenas como historico; a nova sequencia privada passa
-- a ser a unica fonte de numeracao.
revoke all on public.numeracao_contratos from anon, authenticated;

alter table public.laudos_vistoria add column if not exists numero text;

-- Numera laudos antigos cronologicamente sem alterar contratos/autorizacoes ja numerados.
with numerados as (
  select id,
         extract(year from data)::int as ano,
         row_number() over (partition by extract(year from data) order by data, created_at, id)::int as sequencial
  from public.laudos_vistoria
  where numero is null
)
update public.laudos_vistoria l
set numero = 'LAU-' || lpad(n.sequencial::text, 4, '0') || '/' || n.ano::text
from numerados n
where l.id = n.id;

alter table public.laudos_vistoria alter column numero set not null;

insert into private.series_documentais (tipo, ano, ultimo_numero)
select 'laudo', extract(year from data)::int, count(*)::int
from public.laudos_vistoria
group by extract(year from data)
on conflict (tipo, ano) do update
set ultimo_numero = greatest(private.series_documentais.ultimo_numero, excluded.ultimo_numero);

insert into private.series_documentais (tipo, ano, ultimo_numero)
select 'autorizacao', extract(year from data_inicio)::int, count(*)::int
from public.autorizacoes_administracao
group by extract(year from data_inicio)
on conflict (tipo, ano) do update
set ultimo_numero = greatest(private.series_documentais.ultimo_numero, excluded.ultimo_numero);

create or replace function private.proximo_numero_documento(p_tipo text, p_data date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ano integer := extract(year from p_data)::int;
  v_numero integer;
  v_prefixo text;
begin
  if (select auth.uid()) is null or not (select private.tem_papel(array['admin','corretor'])) then
    raise exception 'Sem permissao para numerar documentos.';
  end if;

  v_prefixo := case p_tipo
    when 'contrato' then 'CTR'
    when 'aditivo' then 'ADT'
    when 'laudo' then 'LAU'
    when 'autorizacao' then 'AUT'
    else null
  end;
  if v_prefixo is null or p_data is null then raise exception 'Serie documental invalida.'; end if;

  insert into private.series_documentais (tipo, ano, ultimo_numero)
  values (p_tipo, v_ano, 1)
  on conflict (tipo, ano) do update
  set ultimo_numero = private.series_documentais.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  return v_prefixo || '-' || lpad(v_numero::text, 4, '0') || '/' || v_ano::text;
end;
$$;
revoke execute on function private.proximo_numero_documento(text,date) from public, anon;
grant execute on function private.proximo_numero_documento(text,date) to authenticated;

-- Mantem compatibilidade com a RPC de criacao de contratos ja existente.
create or replace function private.proximo_numero_contrato(p_ano int)
returns text language sql security invoker set search_path = '' as $$
  select private.proximo_numero_documento('contrato', make_date(p_ano, 1, 1));
$$;
revoke execute on function private.proximo_numero_contrato(int) from public, anon;
grant execute on function private.proximo_numero_contrato(int) to authenticated;

create or replace function private.numerar_documento_automaticamente()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'contratos' and new.numero_contrato is null then
    new.numero_contrato := private.proximo_numero_documento('contrato', new.data_inicio);
  elsif tg_table_name = 'autorizacoes_administracao' and new.numero is null then
    new.numero := private.proximo_numero_documento('autorizacao', new.data_inicio);
  elsif tg_table_name = 'laudos_vistoria' and new.numero is null then
    new.numero := private.proximo_numero_documento('laudo', new.data);
  elsif tg_table_name = 'aditivos_contratuais' and new.numero is null then
    new.numero := private.proximo_numero_documento('aditivo', new.data);
  end if;
  return new;
end;
$$;
revoke execute on function private.numerar_documento_automaticamente() from public, anon, authenticated;

drop trigger if exists numerar_contrato on public.contratos;
create trigger numerar_contrato before insert on public.contratos
for each row execute function private.numerar_documento_automaticamente();
drop trigger if exists numerar_autorizacao on public.autorizacoes_administracao;
create trigger numerar_autorizacao before insert on public.autorizacoes_administracao
for each row execute function private.numerar_documento_automaticamente();
drop trigger if exists numerar_laudo on public.laudos_vistoria;
create trigger numerar_laudo before insert on public.laudos_vistoria
for each row execute function private.numerar_documento_automaticamente();

create unique index if not exists laudos_vistoria_numero_key
on public.laudos_vistoria(numero) where numero is not null;

create table if not exists public.aditivos_contratuais (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  numero text not null,
  data date not null default current_date,
  tipo text not null default 'outro' check (tipo in ('prazo','valor','clausulas','outro')),
  titulo text,
  descricao text,
  drive_file_id text,
  drive_file_name text,
  drive_mime_type text,
  drive_file_size bigint,
  created_at timestamptz not null default now()
);
create unique index if not exists aditivos_contratuais_numero_key on public.aditivos_contratuais(numero) where numero is not null;
create index if not exists aditivos_contratuais_contrato_idx on public.aditivos_contratuais(contrato_id, data desc);

drop trigger if exists numerar_aditivo on public.aditivos_contratuais;
create trigger numerar_aditivo before insert on public.aditivos_contratuais
for each row execute function private.numerar_documento_automaticamente();

alter table public.aditivos_contratuais enable row level security;
drop policy if exists "equipe_select" on public.aditivos_contratuais;
drop policy if exists "operacao_insert" on public.aditivos_contratuais;
drop policy if exists "operacao_update" on public.aditivos_contratuais;
drop policy if exists "admin_delete" on public.aditivos_contratuais;
create policy "equipe_select" on public.aditivos_contratuais for select to authenticated using (true);
create policy "operacao_insert" on public.aditivos_contratuais for insert to authenticated with check ((select private.tem_papel(array['admin','corretor'])));
create policy "operacao_update" on public.aditivos_contratuais for update to authenticated using ((select private.tem_papel(array['admin','corretor']))) with check ((select private.tem_papel(array['admin','corretor'])));
create policy "admin_delete" on public.aditivos_contratuais for delete to authenticated using ((select private.tem_papel(array['admin'])));
grant select, insert, update, delete on public.aditivos_contratuais to authenticated;
revoke all on public.aditivos_contratuais from anon;
