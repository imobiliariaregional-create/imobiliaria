-- Papel timbrado: imagem única (fundo de página) usada ao exportar contratos em PDF/Word.
-- Bucket público (não é dado sensível) para simplificar a geração de PDF/Word no navegador
-- (evita ficar renovando signed URL a cada exportação).

insert into storage.buckets (id, name, public) values ('papel-timbrado', 'papel-timbrado', true)
  on conflict (id) do nothing;

create policy "public_read_papel_timbrado" on storage.objects for select to public
  using (bucket_id = 'papel-timbrado');
create policy "authenticated_write_papel_timbrado" on storage.objects for insert to authenticated
  with check (bucket_id = 'papel-timbrado');
create policy "authenticated_update_papel_timbrado" on storage.objects for update to authenticated
  using (bucket_id = 'papel-timbrado');
create policy "authenticated_delete_papel_timbrado" on storage.objects for delete to authenticated
  using (bucket_id = 'papel-timbrado');
