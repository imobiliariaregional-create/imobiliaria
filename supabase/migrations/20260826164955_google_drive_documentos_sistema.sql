-- Metadados do Google Drive. Os campos arquivo_url permanecem para leitura dos anexos legados.
alter table public.laudos_vistoria
  add column if not exists drive_file_id text,
  add column if not exists drive_file_name text,
  add column if not exists drive_mime_type text,
  add column if not exists drive_file_size bigint;

alter table public.notas_fiscais
  add column if not exists drive_file_id text,
  add column if not exists drive_file_name text,
  add column if not exists drive_mime_type text,
  add column if not exists drive_file_size bigint;

alter table public.contratos_gerados
  add column if not exists drive_file_id text,
  add column if not exists drive_file_name text,
  add column if not exists drive_mime_type text,
  add column if not exists drive_file_size bigint;

create table if not exists public.configuracoes_documentos (
  id boolean primary key default true check (id),
  papel_timbrado_drive_file_id text,
  papel_timbrado_drive_file_name text,
  papel_timbrado_drive_mime_type text,
  papel_timbrado_drive_file_size bigint,
  updated_at timestamptz not null default now()
);

insert into public.configuracoes_documentos (id) values (true) on conflict (id) do nothing;
alter table public.configuracoes_documentos enable row level security;
drop policy if exists "equipe_le_configuracoes_documentos" on public.configuracoes_documentos;
create policy "equipe_le_configuracoes_documentos" on public.configuracoes_documentos for select to authenticated using (true);
drop policy if exists "admin_atualiza_configuracoes_documentos" on public.configuracoes_documentos;
create policy "admin_atualiza_configuracoes_documentos" on public.configuracoes_documentos for update to authenticated
using ((select private.tem_papel(array['admin']))) with check ((select private.tem_papel(array['admin'])));
grant select on public.configuracoes_documentos to authenticated;
grant update (papel_timbrado_drive_file_id, papel_timbrado_drive_file_name, papel_timbrado_drive_mime_type, papel_timbrado_drive_file_size, updated_at) on public.configuracoes_documentos to authenticated;

create unique index if not exists laudos_vistoria_drive_file_id_key on public.laudos_vistoria(drive_file_id) where drive_file_id is not null;
create unique index if not exists notas_fiscais_drive_file_id_key on public.notas_fiscais(drive_file_id) where drive_file_id is not null;
create unique index if not exists contratos_gerados_drive_file_id_key on public.contratos_gerados(drive_file_id) where drive_file_id is not null;
