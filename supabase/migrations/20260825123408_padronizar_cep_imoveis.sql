-- Converte automaticamente CEPs antigos que possuem exatamente oito dígitos.
update public.imoveis
set cep = substring(cep from 1 for 5) || '-' || substring(cep from 6 for 3)
where cep ~ '^[0-9]{8}$';

-- Mantém registros legados acessíveis, mas exige o padrão oficial em novos
-- cadastros e em imóveis que forem alterados com CEP preenchido.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'imoveis_cep_formatado'
      and conrelid = 'public.imoveis'::regclass
  ) then
    alter table public.imoveis
      add constraint imoveis_cep_formatado
      check (cep is null or cep = '' or cep ~ '^[0-9]{5}-[0-9]{3}$')
      not valid;
  end if;
end $$;
