-- Complemento separado para manter o endereco do imovel estruturado.
alter table public.imoveis
  add column if not exists complemento text;

comment on column public.imoveis.complemento is
  'Complemento do endereco, como apartamento, bloco, sala ou fundos.';

-- Registros legados continuam acessiveis, mas novos cadastros e alteracoes
-- precisam manter CPF/CNPJ preenchido e no formato exibido pelo sistema.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'proprietarios_documento_formatado'
      and conrelid = 'public.proprietarios'::regclass
  ) then
    alter table public.proprietarios
      add constraint proprietarios_documento_formatado
      check (
        (tipo_pessoa = 'fisica' and cpf_cnpj ~ '^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$')
        or (tipo_pessoa = 'juridica' and cpf_cnpj ~ '^[0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2}$')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pessoas_documento_formatado'
      and conrelid = 'public.pessoas'::regclass
  ) then
    alter table public.pessoas
      add constraint pessoas_documento_formatado
      check (
        (tipo_pessoa = 'fisica' and cpf_cnpj ~ '^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$')
        or (tipo_pessoa = 'juridica' and cpf_cnpj ~ '^[0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2}$')
      ) not valid;
  end if;
end $$;
