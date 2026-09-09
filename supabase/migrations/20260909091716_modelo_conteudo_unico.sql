-- Os modelos de contrato deixam de ser divididos em clausulas separadas
-- (titulo + texto) e passam a ter um unico bloco de conteudo rico, que o
-- usuario organiza com espacamento livre (como no Word).
--
-- Adiciona a coluna nova e migra os dados existentes concatenando as
-- clausulas antigas num unico HTML. A coluna "clausulas" (jsonb) e mantida
-- sem uso, apenas como historico/backup.
alter table public.modelos_contrato add column if not exists conteudo text not null default '';
alter table public.contratos_gerados add column if not exists conteudo text not null default '';

create or replace function private.clausulas_para_conteudo(clausulas jsonb)
returns text language sql immutable as $$
  select coalesce(string_agg(
    (case when trim(coalesce(c->>'titulo', '')) <> '' then
      '<p><b>' || replace(replace(replace(c->>'titulo', '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</b></p>'
    else '' end)
    || (case when position('<' in coalesce(c->>'texto', '')) > 0 then coalesce(c->>'texto', '')
      else '<p>' || replace(replace(replace(replace(coalesce(c->>'texto', ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), chr(10), '<br>') || '</p>'
    end),
  ''), '')
  from jsonb_array_elements(clausulas) as c
$$;

update public.modelos_contrato set conteudo = private.clausulas_para_conteudo(clausulas) where conteudo = '' and jsonb_array_length(clausulas) > 0;
update public.contratos_gerados set conteudo = private.clausulas_para_conteudo(clausulas) where conteudo = '' and jsonb_array_length(clausulas) > 0;

drop function private.clausulas_para_conteudo(jsonb);
