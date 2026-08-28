-- Permite importar um contrato ja pronto (PDF) direto na pagina do contrato,
-- em vez de gerar a partir de um modelo, para enviar para assinatura.
alter table public.contratos_gerados
  add column if not exists origem text not null default 'gerado' check (origem in ('gerado', 'importado')),
  add column if not exists arquivo_importado_drive_file_id text,
  add column if not exists arquivo_importado_drive_file_name text,
  add column if not exists arquivo_importado_drive_mime_type text,
  add column if not exists arquivo_importado_drive_file_size bigint;

-- Permite enviar autorizacoes de administracao (o PDF ja anexado) para assinatura digital.
alter table public.autorizacoes_administracao
  add column if not exists assinafy_document_id text,
  add column if not exists assinafy_assignment_id text,
  add column if not exists assinafy_status text,
  add column if not exists assinafy_resumo jsonb;
