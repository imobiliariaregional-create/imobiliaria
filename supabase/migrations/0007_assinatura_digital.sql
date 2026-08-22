-- Rastreamento da assinatura digital (Assinafy) por documento gerado.

alter table contratos_gerados
  add column if not exists assinafy_document_id text,
  add column if not exists assinafy_assignment_id text,
  add column if not exists assinafy_status text,
  add column if not exists assinafy_resumo jsonb;
