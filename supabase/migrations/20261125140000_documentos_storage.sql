-- Arquivos dos documentos passam do Google Drive para o Storage do Supabase.
-- Bucket privado "documentos"; a primeira pasta do caminho e a categoria
-- (autorizacao, contrato_locacao, contrato_venda, aditivo, laudo, nota_fiscal, papel_timbrado).
-- Mesmas regras de papel que a antiga funcao do Google Drive:
--   admin: tudo; corretor: tudo menos papel timbrado; financeiro: notas fiscais.
--   Qualquer usuario logado pode baixar.

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "documentos_select" on storage.objects;
drop policy if exists "documentos_insert" on storage.objects;
drop policy if exists "documentos_delete" on storage.objects;

create policy "documentos_select" on storage.objects for select to authenticated
using (bucket_id = 'documentos');

create policy "documentos_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos' and (
    (select private.tem_papel(array['admin']))
    or ((storage.foldername(name))[1] <> 'papel_timbrado' and (storage.foldername(name))[1] <> 'nota_fiscal'
        and (select private.tem_papel(array['corretor'])))
    or ((storage.foldername(name))[1] = 'nota_fiscal' and (select private.tem_papel(array['financeiro'])))
  )
);

create policy "documentos_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'documentos' and (
    (select private.tem_papel(array['admin']))
    or ((storage.foldername(name))[1] <> 'papel_timbrado' and (storage.foldername(name))[1] <> 'nota_fiscal'
        and (select private.tem_papel(array['corretor'])))
    or ((storage.foldername(name))[1] = 'nota_fiscal' and (select private.tem_papel(array['financeiro'])))
  )
);
