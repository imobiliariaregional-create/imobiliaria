-- Imobiliaria como ADMINISTRADORA (mandataria do locador) nas locacoes de administracao.
--
-- 1. Dados da imobiliaria usados nos modelos (#nome_administradora etc.).
-- 2. Taxa de administracao padrao no cadastro do proprietario.
-- 3. Categoria e arquivamento dos modelos, com protecao do ultimo modelo ativo.
-- 4. Modelos novos: locacao (administracao e kitnet) com a ADMINISTRADORA,
--    contrato de administracao, aditivo de renovacao e aditivo de inclusao de imovel.
--    Os modelos existentes nao sao alterados.

-- ========== 1. DADOS DA IMOBILIARIA ==========
alter table public.configuracoes_documentos
  add column if not exists adm_razao_social text,
  add column if not exists adm_cnpj text,
  add column if not exists adm_creci text,
  add column if not exists adm_endereco text,
  add column if not exists adm_email text,
  add column if not exists adm_telefone text,
  add column if not exists adm_representante_nome text,
  add column if not exists adm_representante_cpf text,
  add column if not exists adm_representante_cargo text;

grant update (
  adm_razao_social, adm_cnpj, adm_creci, adm_endereco, adm_email, adm_telefone,
  adm_representante_nome, adm_representante_cpf, adm_representante_cargo
) on public.configuracoes_documentos to authenticated;

-- ========== 2. TAXA PADRAO DO PROPRIETARIO ==========
alter table public.proprietarios
  add column if not exists taxa_administracao numeric(5,2) not null default 10
  check (taxa_administracao > 0 and taxa_administracao <= 100);

-- ========== 3. CATEGORIA E ARQUIVAMENTO DOS MODELOS ==========
alter table public.modelos_contrato
  add column if not exists categoria text not null default 'contrato',
  add column if not exists arquivado boolean not null default false,
  add column if not exists arquivado_em timestamptz;

alter table public.modelos_contrato drop constraint if exists modelos_contrato_categoria_check;
alter table public.modelos_contrato add constraint modelos_contrato_categoria_check
  check (categoria in ('contrato', 'contrato_administracao', 'aditivo_contrato', 'aditivo_administracao'));

create index if not exists idx_modelos_contrato_ativos
  on public.modelos_contrato(categoria, tipo_operacao) where not arquivado;

-- Nao deixa um par (categoria, tipo de operacao) sem nenhum modelo ativo,
-- seja por exclusao, arquivamento ou mudanca de categoria/tipo.
create or replace function private.proteger_ultimo_modelo_ativo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sai_do_grupo boolean;
  v_acao text;
begin
  if tg_op = 'DELETE' then
    v_sai_do_grupo := not old.arquivado;
    v_acao := 'excluir';
  else
    v_sai_do_grupo := not old.arquivado and (
      new.arquivado
      or new.categoria is distinct from old.categoria
      or new.tipo_operacao is distinct from old.tipo_operacao
    );
    v_acao := 'arquivar ou mudar o tipo de';
  end if;

  if v_sai_do_grupo and not exists (
    select 1 from public.modelos_contrato m
    where m.id <> old.id and not m.arquivado
      and m.categoria = old.categoria and m.tipo_operacao = old.tipo_operacao
  ) then
    raise exception 'Este e o unico modelo ativo desse tipo. Crie ou restaure outro modelo do mesmo tipo antes de % este.', v_acao;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke execute on function private.proteger_ultimo_modelo_ativo() from public, anon, authenticated;

drop trigger if exists proteger_ultimo_modelo_ativo on public.modelos_contrato;
create trigger proteger_ultimo_modelo_ativo before update or delete on public.modelos_contrato
for each row execute function private.proteger_ultimo_modelo_ativo();

-- ========== 4. MODELOS NOVOS ==========
-- Cada insert so acontece se ainda nao existir um modelo com o mesmo nome,
-- para a migracao poder ser executada de novo sem duplicar nada.

-- 4.1 Locacao de administracao com a ADMINISTRADORA
insert into public.modelos_contrato (nome, tipo_operacao, categoria, conteudo)
select 'CONTRATO DE LOCAÇÃO DE IMÓVEL - ADMINISTRAÇÃO (COM ADMINISTRADORA)', 'administracao', 'contrato', $modelo$
<p style="text-align: center;"><b>CONTRATO DE LOCAÇÃO DE IMÓVEL</b></p>
<p><br></p>
<p><b>Qualificação das Partes</b></p>
<p><b>LOCADOR(A):</b> #nome_locador#qualificacao_locador, inscrito(a) no CPF/CNPJ sob o nº #cpf_locador, com endereço em #endereco_locador, e-mail #email_locador, telefone #telefone_locador, doravante denominado(a) simplesmente LOCADOR(A), neste ato representado(a) por sua mandatária, a ADMINISTRADORA abaixo qualificada;</p>
<p><b>ADMINISTRADORA:</b> #nome_administradora, inscrita no CNPJ sob o nº #cnpj_administradora, registrada no CRECI sob o nº #creci_administradora, com sede em #endereco_administradora, e-mail #email_administradora, telefone #telefone_administradora, neste ato representada por #representante_administradora, inscrito(a) no CPF sob o nº #cpf_representante_administradora, doravante denominada simplesmente ADMINISTRADORA, que comparece por si e na qualidade de mandatária do(a) LOCADOR(A), com os poderes que lhe foram conferidos pelo Contrato de Administração de Imóveis nº #numero_contrato_administracao, firmado em #data_contrato_administracao; e</p>
<p><b>LOCATÁRIO(A):</b> #nome_locatario#qualificacao_locatario, inscrito(a) no CPF/CNPJ sob o nº #cpf_locatario, com endereço em #endereco_locatario, e-mail #email_locatario, telefone #telefone_locatario, doravante denominado(a) simplesmente LOCATÁRIO(A).</p>
<p>As partes acima identificadas, por si e por seus representantes legais infra-assinados, celebram o presente Contrato de Locação, regido pelas cláusulas e condições a seguir:</p>
<p><b>1 - Documentos Contratuais</b></p>
<p>Integram este instrumento na forma de anexos: a) fatura de energia; b) protocolo de entrega das chaves; c) laudo de vistoria.</p>
<p><b>2 - Descrição/Localização do Imóvel e Utilização</b></p>
<p>O imóvel objeto deste contrato está localizado em #endereco_imovel, classificado como #tipo_imovel, com a seguinte descrição: #descricao_imovel. Destina-se exclusivamente ao uso indicado pelas partes.</p>
<p><b>3 - Preço, Prazo e Forma de Pagamento</b></p>
<p>Valor mensal: #valor_aluguel (#valor_aluguel_extenso).</p>
<p>Vencimento: dia #dia_pagamento de cada mês.</p>
<p>Valor total estimado do contrato: #valor_total_contrato (#valor_total_contrato_extenso).</p>
<p>Início do contrato: #data_inicio.</p>
<p>Término do contrato: #vigencia_final.</p>
<p>Duração do contrato: #duracao_meses_extenso.</p>
<p>Dados bancários para pagamento: #dados_bancarios_proprietario.</p>
<p><b>4 - Reajustamento</b></p>
<p>O aluguel mensal pactuado na Cláusula 3 será reajustado após 12 (doze) meses de vigência, tendo como limite o índice IGP-M, divulgado pela FGV, ou, na sua falta, outro que o substitua.</p>
<p><b>5 - Transferência/Cessão</b></p>
<p>É vedado ao(a) LOCATÁRIO(A) e ao(a) LOCADOR(A), transferir, sublocar ou emprestar o imóvel, bem como, negociar com terceiros qualquer direitos decorrentes deste Instrumento, em especial, créditos representados por títulos de qualquer natureza, sem prévia, formal e expressa anuência da outra parte, tornando-se nula qualquer operação não autorizada previamente.</p>
<p><b>6 - Taxas e impostos</b></p>
<p>Será de responsabilidade do(a) LOCATÁRIO(A) o pagamento das taxas de energia e água referentes ao período de locação do imóvel, devendo apresentar as guias quitadas ao(a) LOCADOR(A). O(A) LOCATÁRIO(A) declara ter ciência da obrigação de transferir a titularidade da unidade consumidora de energia junto à EQUATORIAL e à concessionária de água junto á BRK.</p>
<p><b>7 - Vistorias</b></p>
<p>O(A) LOCATÁRIO(A), declara que vistoriou o imóvel, e que o mesmo está sendo entregue nas condições especificadas no Termo de Vistoria de Imóvel, anexo a este Instrumento, devendo restituí-lo, quando finda a locação, nas mesmas condições em que o recebeu.</p>
<p><b>8 - Obras/Manutenção</b></p>
<p>Salvo as obras que importem na segurança estrutural do imóvel, e demais benfeitorias consideradas necessárias, todas as outras são de responsabilidade do(a) LOCATÁRIO(A), que deverá manter imóvel em boas condições de higiene e limpeza. O imóvel deverá ser devolvido com a pintura nas mesmas condições encontradas, além de conservar as instalações hidráulicas, sanitárias e elétricas sempre em perfeitas condições de funcionamento para atender às necessidades do(a) LOCADOR(A). Além disso, a manutenção/reparação e infiltrações no geral ficará por conta do(a) LOCATÁRIO(A).</p>
<p><b>9 - Desapropriação/Interdição</b></p>
<p>Em caso de desapropriação ou interdição pelo poder público, o(a) LOCADOR(A) fica desobrigada das cláusulas deste contrato, ressalvado ao(a) LOCATÁRIO(A) o direito de pleitear indenização junto ao responsável.</p>
<p><b>10 - Venda do imóvel</b></p>
<p>Em caso de alienação ou venda do imóvel a terceiros, e não exercendo o(a) LOCATÁRIO(A) o seu direito de preferência, esta autorizará a visita de interessados mediante agendamento prévio e compromete-se a desocupar o imóvel no prazo legal de até 90 (noventa) dias contados da notificação formal, sem que isso caracterize infração ou quebra de contrato.</p>
<p><b>11 - Devolução antecipada</b></p>
<p>A devolução antecipada, salvo força maior comprovada, exige aviso prévio de 30 dias e sujeita o(a) LOCATÁRIO(A) a multa equivalente a 3 (três) meses de aluguel, proporcional ao tempo restante do contrato.</p>
<p>Como calcular: Pega-se o valor total da multa estabelecido no contrato, divide-se pelo número total de meses do acordo e multiplica-se pelos meses restantes para o fim da vigência.</p>
<p><b>12 - Forma de pagamento e rescisão</b></p>
<p>O pagamento seguirá exclusivamente a forma prevista na Cláusula 3. Findo o prazo do contrato sem aditivo de prorrogação, este se extingue; a rescisão por iniciativa do(a) LOCATÁRIO(A) exige os mesmos 30 dias de aviso e multa da Cláusula 11, e por iniciativa do(a) LOCADOR(A) decorre de infração contratual ou inadimplemento.</p>
<p><b>13 - Rescisão antecipada e multa proporcional</b></p>
<p>O presente contrato possui vigência de #duracao_meses. Caso o(a) LOCATÁRIO(A) resolva rescindir o contrato antes do término do prazo avençado, deverá notificar o(a) LOCADOR(A) ou sua Administradora por escrito e com antecedência mínima de 30 (trinta) dias (aviso prévio), ficando sujeito ao pagamento de multa rescisória contratual.</p>
<p>A multa contratual integral é fixada no valor equivalente a 3 (três) valor(es) do aluguel vigente à época da infração. Nos termos do artigo 4º da Lei nº 8.245/91, a referida multa será cobrada de forma estritamente proporcional ao tempo restante para o encerramento do contrato, mediante a aplicação da seguinte fórmula matemática: Multa Devida = (Valor da Multa Integral / Prazo Total do Contrato em Meses) X Meses Restantes a Cumprir.</p>
<p>Para fins do cálculo previsto no parágrafo anterior, a fração superior a 15 (quinze) dias no mês de saída será considerada como 1 (um) mês integral a ser contabilizado na proporcionalidade.</p>
<p>O não cumprimento do aviso prévio de 30 (trinta) dias sujeitará o(a) LOCATÁRIO(A) ao pagamento do valor equivalente a 1 (um) aluguel mensal vigente, cobrado cumulativamente com a multa rescisória proporcional descrita no Parágrafo Primeiro.</p>
<p>O(A) LOCATÁRIO(A) ficará isento(a) do pagamento da multa rescisória apenas se a devolução do imóvel decorrer de transferência de seu local de trabalho prestado a empregador (público ou privado), para prestar serviços em localidades diversas daquela onde iniciou a locação, mediante notificação por escrito com antecedência mínima de 30 (trinta) dias e apresentação de comprovante oficial expedido pelo empregador.</p>
<p><b>14 - Dos encargos por atraso no pagamento</b></p>
<p>Em caso de atraso no pagamento do aluguel e/ou encargos até a data estipulada no vencimento, o valor devido será acrescido de multa moratória de 2% (dois por cento) sobre o valor do débito, somado a juros de mora de 1% (um por cento) ao mês, calculados pro rata die até a data do efetivo pagamento. A presente cobrança possui fundamento legal na obrigação do locatário de pagar pontualmente o aluguel e os encargos da locação, nos termos do Art. 23, inciso I, da Lei Federal nº 8.245/1991 (Lei do Inquilinato), sujeitando o devedor às penalidades da mora.</p>
<p><b>15 - Da vistoria e visita trimestral</b></p>
<p>Fica resguardado ao LOCADOR e/ou à Imobiliária administradora o direito de realizar visitas e vistorias periódicas a cada trimestre (3 meses) no imóvel locado, mediante prévio agendamento com a devida antecedência, com o objetivo de verificar o estado de conservação, manutenção das instalações e o cumprimento das obrigações contratuais, conforme respaldado no Art. 23, inciso IX, da Lei nº 8.245/1991.</p>
<p><b>16 - Devolução das chaves</b></p>
<p>A entrega das chaves ocorrerá após vistoria de saída comparada ao laudo inicial, mediante apresentação dos comprovantes de quitação de contas e cancelamento de serviços vinculados ao imóvel, devolvido limpo, pintado na cor original e sem reparos pendentes; havendo reparos necessários não realizados, o(a) LOCADOR(A) poderá recusar a devolução até sua conclusão, prevalecendo, em caso de desacordo, laudo de perito por ela indicado, a expensas do LOCATÁRIO(A).</p>
<p><b>17 - Da Administradora</b></p>
<p>A ADMINISTRADORA atua neste contrato exclusivamente na qualidade de mandatária do(a) LOCADOR(A), nos termos do Contrato de Administração de Imóveis referido na qualificação das partes, praticando em nome deste(a) os atos de administração da presente locação, e não responde pessoalmente pelas obrigações atribuídas ao(à) LOCADOR(A) neste instrumento, na forma do art. 663 do Código Civil.</p>
<p>Parágrafo primeiro. Todas as comunicações, notificações, avisos e pedidos relativos a esta locação, inclusive o aviso prévio de desocupação e os pedidos de autorização previstos neste contrato, deverão ser dirigidos por escrito à ADMINISTRADORA, valendo como se feitos ao(à) LOCADOR(A).</p>
<p>Parágrafo segundo. Compete à ADMINISTRADORA, em nome do(a) LOCADOR(A), realizar as vistorias de entrada, periódicas e de saída, entregar e receber as chaves, autorizar ou recusar obras, benfeitorias e a permanência de terceiros no imóvel, bem como exercer os demais direitos atribuídos ao(à) LOCADOR(A) neste instrumento.</p>
<p>Parágrafo terceiro. Extinto o Contrato de Administração, o(a) LOCADOR(A) ou a ADMINISTRADORA comunicará o fato por escrito ao(à) LOCATÁRIO(A). A partir do recebimento dessa comunicação, a presente locação prossegue diretamente entre LOCADOR(A) e LOCATÁRIO(A), nas mesmas condições, cessando a participação da ADMINISTRADORA, e as comunicações passam a ser dirigidas ao(à) LOCADOR(A) no endereço constante deste contrato ou no que vier a ser informado por escrito.</p>
<p><b>18 - Boa-fé</b></p>
<p>As partes declaram pleno conhecimento das cláusulas deste contrato e comprometem-se a agir com lealdade e boa-fé, desde a celebração até a integral execução deste instrumento.</p>
<p><b>19 - Disposições Finais</b></p>
<p>As partes elegem expressamente o Foro da Comarca de Curionópolis, Estado do Pará, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer dúvidas, litígios ou ações oriundas da interpretação ou execução deste contrato.</p>
<p>Curionópolis, Pará, #data_hoje.</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_administradora<br>por si e como procuradora de #nome_locador<br>CNPJ #cnpj_administradora<br>ADMINISTRADORA, por si e representando o(a) LOCADOR(A)</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_locatario<br>#cpf_locatario<br>LOCATÁRIO(A)</p>
$modelo$
where not exists (select 1 from public.modelos_contrato where nome = 'CONTRATO DE LOCAÇÃO DE IMÓVEL - ADMINISTRAÇÃO (COM ADMINISTRADORA)');

-- 4.2 Locacao de kitnet com a ADMINISTRADORA
insert into public.modelos_contrato (nome, tipo_operacao, categoria, conteudo)
select 'CONTRATO DE LOCAÇÃO DE IMÓVEL - KITNET (COM ADMINISTRADORA)', 'administracao', 'contrato', $modelo$
<p style="text-align: center;"><b>CONTRATO DE LOCAÇÃO DE IMÓVEL</b></p>
<p><br></p>
<p><b>Qualificação das Partes</b></p>
<p><b>LOCADOR(A):</b> #nome_locador#qualificacao_locador, inscrito(a) no CPF/CNPJ sob o nº #cpf_locador, com endereço em #endereco_locador, e-mail #email_locador, telefone #telefone_locador, doravante denominado(a) simplesmente LOCADOR(A), neste ato representado(a) por sua mandatária, a ADMINISTRADORA abaixo qualificada;</p>
<p><b>ADMINISTRADORA:</b> #nome_administradora, inscrita no CNPJ sob o nº #cnpj_administradora, registrada no CRECI sob o nº #creci_administradora, com sede em #endereco_administradora, e-mail #email_administradora, telefone #telefone_administradora, neste ato representada por #representante_administradora, inscrito(a) no CPF sob o nº #cpf_representante_administradora, doravante denominada simplesmente ADMINISTRADORA, que comparece por si e na qualidade de mandatária do(a) LOCADOR(A), com os poderes que lhe foram conferidos pelo Contrato de Administração de Imóveis nº #numero_contrato_administracao, firmado em #data_contrato_administracao; e</p>
<p><b>LOCATÁRIO(A):</b> #nome_locatario#qualificacao_locatario, inscrito(a) no CPF/CNPJ sob o nº #cpf_locatario, com endereço em #endereco_locatario, e-mail #email_locatario, telefone #telefone_locatario, doravante denominado(a) simplesmente LOCATÁRIO(A).</p>
<p>As partes acima identificadas, por si e por seus representantes legais infra-assinados, celebram o presente Contrato de Locação, regido pelas cláusulas e condições a seguir:</p>
<p><b>1 - Documentos Contratuais</b></p>
<p>Integram este instrumento na forma de anexos: a) fatura de energia; b) protocolo de entrega das chaves; c) laudo de vistoria.</p>
<p><b>2 - Descrição/Localização do Imóvel e Utilização</b></p>
<p>O imóvel objeto deste contrato está localizado em #endereco_imovel, classificado como #tipo_imovel, com a seguinte descrição: #descricao_imovel. Destina-se exclusivamente ao uso indicado pelas partes.</p>
<p><b>3 - Preço, Prazo e Forma de Pagamento</b></p>
<p>Valor mensal: #valor_aluguel (#valor_aluguel_extenso).</p>
<p>Vencimento: dia #dia_pagamento de cada mês.</p>
<p>Valor total estimado do contrato: #valor_total_contrato (#valor_total_contrato_extenso).</p>
<p>Início do contrato: #data_inicio.</p>
<p>Término do contrato: #vigencia_final.</p>
<p>Duração do contrato: #duracao_meses_extenso.</p>
<p>Dados bancários para pagamento: #dados_bancarios_proprietario.</p>
<p><b>4 - Reajustamento</b></p>
<p>O aluguel mensal pactuado na Cláusula 3 será reajustado após 12 (doze) meses de vigência, tendo como limite o índice IGP-M, divulgado pela FGV, ou, na sua falta, outro que o substitua.</p>
<p><b>5 - Transferência/Cessão</b></p>
<p>É vedado ao(a) LOCATÁRIO(A) e ao(a) LOCADOR(A), transferir, sublocar ou emprestar o imóvel, bem como, negociar com terceiros qualquer direitos decorrentes deste Instrumento, em especial, créditos representados por títulos de qualquer natureza, sem prévia, formal e expressa anuência da outra parte, tornando-se nula qualquer operação não autorizada previamente.</p>
<p>A permanência de visitantes ou hóspedes na kitnet é permitida apenas em caráter estritamente temporário.</p>
<p>Entende-se por hospedagem temporária a estadia ininterrupta de terceiros por até 15 dias. Caso a permanência do visitante ultrapasse esse prazo sem notificação e autorização prévia da Administradora, a situação será caracterizada como sublocação/cessão irregular da locação ou inclusão de novo morador não autorizado.</p>
<p>Constatada a permanência habitacional não autorizada de terceiros, a Administradora poderá aplicar multa por infração contratual e readequar a taxa de consumo de água e energia (caso estas sejam cobradas de forma compartilhada ou inclusas no valor do aluguel), sem prejuízo da rescisão imediata do contrato.</p>
<p><b>6 - Taxas e impostos</b></p>
<p>Será de responsabilidade do(a) LOCATÁRIO(A) o pagamento das taxas de energia e água referentes ao período de locação do imóvel, devendo apresentar as guias quitadas ao(a) LOCADOR(A). O(A) LOCATÁRIO(A) declara ter ciência da obrigação de transferir a titularidade da unidade consumidora de energia junto à EQUATORIAL e à concessionária de água junto á BRK.</p>
<p><b>7 - Vistorias</b></p>
<p>O(A) LOCATÁRIO(A), declara que vistoriou o imóvel, e que o mesmo está sendo entregue nas condições especificadas no Termo de Vistoria de Imóvel, anexo a este Instrumento, devendo restituí-lo, quando finda a locação, nas mesmas condições em que o recebeu.</p>
<p><b>8 - Obras/Manutenção</b></p>
<p>Salvo as obras que importem na segurança estrutural do imóvel, e demais benfeitorias consideradas necessárias, todas as outras são de responsabilidade do(a) LOCATÁRIO(A), que deverá manter imóvel em boas condições de higiene e limpeza. O imóvel deverá ser devolvido com a pintura nas mesmas condições encontradas, além de conservar as instalações hidráulicas, sanitárias e elétricas sempre em perfeitas condições de funcionamento para atender às necessidades do(a) LOCADOR(A). Além disso, a manutenção/reparação e infiltrações no geral ficará por conta do(a) LOCATÁRIO(A).</p>
<p><b>9 - Desapropriação/Interdição</b></p>
<p>Em caso de desapropriação ou interdição pelo poder público, o(a) LOCADOR(A) fica desobrigada das cláusulas deste contrato, ressalvado ao(a) LOCATÁRIO(A) o direito de pleitear indenização junto ao responsável.</p>
<p><b>10 - Venda do imóvel</b></p>
<p>Em caso de alienação ou venda do imóvel a terceiros, e não exercendo o(a) LOCATÁRIO(A) o seu direito de preferência, esta autorizará a visita de interessados mediante agendamento prévio e compromete-se a desocupar o imóvel no prazo legal de até 90 (noventa) dias contados da notificação formal, sem que isso caracterize infração ou quebra de contrato.</p>
<p><b>11 - Devolução antecipada</b></p>
<p>A devolução antecipada, salvo força maior comprovada, exige aviso prévio de 30 dias e sujeita o(a) LOCATÁRIO(A) a multa equivalente a 3 (três) meses de aluguel, proporcional ao tempo restante do contrato.</p>
<p>Como calcular: Pega-se o valor total da multa estabelecido no contrato, divide-se pelo número total de meses do acordo e multiplica-se pelos meses restantes para o fim da vigência.</p>
<p><b>12 - Forma de pagamento e rescisão</b></p>
<p>O pagamento seguirá exclusivamente a forma prevista na Cláusula 3. Findo o prazo do contrato sem aditivo de prorrogação, este se extingue; a rescisão por iniciativa do(a) LOCATÁRIO(A) exige os mesmos 30 dias de aviso e multa da Cláusula 11, e por iniciativa do(a) LOCADOR(A) decorre de infração contratual ou inadimplemento.</p>
<p><b>13 - Rescisão antecipada e multa proporcional</b></p>
<p>O presente contrato possui vigência de #duracao_meses. Caso o(a) LOCATÁRIO(A) resolva rescindir o contrato antes do término do prazo avençado, deverá notificar o(a) LOCADOR(A) ou sua Administradora por escrito e com antecedência mínima de 30 (trinta) dias (aviso prévio), ficando sujeito ao pagamento de multa rescisória contratual.</p>
<p>A multa contratual integral é fixada no valor equivalente a 3 (três) valor(es) do aluguel vigente à época da infração. Nos termos do artigo 4º da Lei nº 8.245/91, a referida multa será cobrada de forma estritamente proporcional ao tempo restante para o encerramento do contrato, mediante a aplicação da seguinte fórmula matemática: Multa Devida = (Valor da Multa Integral / Prazo Total do Contrato em Meses) X Meses Restantes a Cumprir.</p>
<p>Para fins do cálculo previsto no parágrafo anterior, a fração superior a 15 (quinze) dias no mês de saída será considerada como 1 (um) mês integral a ser contabilizado na proporcionalidade.</p>
<p>O não cumprimento do aviso prévio de 30 (trinta) dias sujeitará o(a) LOCATÁRIO(A) ao pagamento do valor equivalente a 1 (um) aluguel mensal vigente, cobrado cumulativamente com a multa rescisória proporcional descrita no Parágrafo Primeiro.</p>
<p>O(A) LOCATÁRIO(A) ficará isento(a) do pagamento da multa rescisória apenas se a devolução do imóvel decorrer de transferência de seu local de trabalho prestado a empregador (público ou privado), para prestar serviços em localidades diversas daquela onde iniciou a locação, mediante notificação por escrito com antecedência mínima de 30 (trinta) dias e apresentação de comprovante oficial expedido pelo empregador.</p>
<p><b>14 - Dos encargos por atraso no pagamento</b></p>
<p>Em caso de atraso no pagamento do aluguel e/ou encargos até a data estipulada no vencimento, o valor devido será acrescido de multa moratória de 2% (dois por cento) sobre o valor do débito, somado a juros de mora de 1% (um por cento) ao mês, calculados pro rata die até a data do efetivo pagamento. A presente cobrança possui fundamento legal na obrigação do locatário de pagar pontualmente o aluguel e os encargos da locação, nos termos do Art. 23, inciso I, da Lei Federal nº 8.245/1991 (Lei do Inquilinato), sujeitando o devedor às penalidades da mora.</p>
<p><b>15 - Das regras de convivência e regimento interno</b></p>
<p>Por se tratar de imóvel integrante de um conjunto/complexo de residências multifamiliares com uso de áreas comuns (corredores, acessos, lavanderias ou pátios), o(a) LOCATÁRIO(A) compromete-se a cumprir e fazer cumprir rigorosamente as seguintes normas de boa convivência:</p>
<p>Silêncio: Respeitar o horário de silêncio obrigatório das 22h00 às 07h00, sendo proibido o uso de aparelhos sonoros, instrumentos musicais ou ruídos em volume que perturbem o sossego dos demais vizinhos;</p>
<p>Uso de Áreas Comuns: É expressamente proibido depositar móveis, entulhos, lixo, bicicletas ou quaisquer objetos pessoais nos corredores, passagens e áreas de circulação comum;</p>
<p>Festas e Eventos: É vedada a realização de festas, reuniões ruidosas ou aglomerações nas áreas comuns do condomínio/vila de kitnets.</p>
<p>O descumprimento comprovado de qualquer uma das regras de convivência aqui listadas sujeitará o(a) LOCATÁRIO(A) à advertência por escrito e, em caso de reincidência, à aplicação de multa no valor equivalente a 50% (cinquenta por cento) do valor do aluguel mensal, podendo ensejar a rescisão motivada do contrato de locação por infração contratual.</p>
<p><b>16 - Da vistoria e visita trimestral</b></p>
<p>Fica resguardado ao LOCADOR e/ou à Imobiliária administradora o direito de realizar visitas e vistorias periódicas a cada trimestre (3 meses) no imóvel locado, mediante prévio agendamento com a devida antecedência, com o objetivo de verificar o estado de conservação, manutenção das instalações e o cumprimento das obrigações contratuais, conforme respaldado no Art. 23, inciso IX, da Lei nº 8.245/1991.</p>
<p><b>17 - Devolução das chaves</b></p>
<p>A entrega das chaves ocorrerá após vistoria de saída comparada ao laudo inicial, mediante apresentação dos comprovantes de quitação de contas e cancelamento de serviços vinculados ao imóvel, devolvido limpo, pintado na cor original e sem reparos pendentes; havendo reparos necessários não realizados, o(a) LOCADOR(A) poderá recusar a devolução até sua conclusão, prevalecendo, em caso de desacordo, laudo de perito por ela indicado, a expensas do LOCATÁRIO(A).</p>
<p><b>18 - Da Administradora</b></p>
<p>A ADMINISTRADORA atua neste contrato exclusivamente na qualidade de mandatária do(a) LOCADOR(A), nos termos do Contrato de Administração de Imóveis referido na qualificação das partes, praticando em nome deste(a) os atos de administração da presente locação, e não responde pessoalmente pelas obrigações atribuídas ao(à) LOCADOR(A) neste instrumento, na forma do art. 663 do Código Civil.</p>
<p>Parágrafo primeiro. Todas as comunicações, notificações, avisos e pedidos relativos a esta locação, inclusive o aviso prévio de desocupação e os pedidos de autorização previstos neste contrato, deverão ser dirigidos por escrito à ADMINISTRADORA, valendo como se feitos ao(à) LOCADOR(A).</p>
<p>Parágrafo segundo. Compete à ADMINISTRADORA, em nome do(a) LOCADOR(A), realizar as vistorias de entrada, periódicas e de saída, entregar e receber as chaves, autorizar ou recusar obras, benfeitorias e a permanência de terceiros no imóvel, bem como exercer os demais direitos atribuídos ao(à) LOCADOR(A) neste instrumento.</p>
<p>Parágrafo terceiro. Extinto o Contrato de Administração, o(a) LOCADOR(A) ou a ADMINISTRADORA comunicará o fato por escrito ao(à) LOCATÁRIO(A). A partir do recebimento dessa comunicação, a presente locação prossegue diretamente entre LOCADOR(A) e LOCATÁRIO(A), nas mesmas condições, cessando a participação da ADMINISTRADORA, e as comunicações passam a ser dirigidas ao(à) LOCADOR(A) no endereço constante deste contrato ou no que vier a ser informado por escrito.</p>
<p><b>19 - Boa-fé</b></p>
<p>As partes declaram pleno conhecimento das cláusulas deste contrato e comprometem-se a agir com lealdade e boa-fé, desde a celebração até a integral execução deste instrumento.</p>
<p><b>20 - Disposições Finais</b></p>
<p>As partes elegem expressamente o Foro da Comarca de Curionópolis, Estado do Pará, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer dúvidas, litígios ou ações oriundas da interpretação ou execução deste contrato.</p>
<p>Curionópolis, Pará, #data_hoje.</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_administradora<br>por si e como procuradora de #nome_locador<br>CNPJ #cnpj_administradora<br>ADMINISTRADORA, por si e representando o(a) LOCADOR(A)</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_locatario<br>#cpf_locatario<br>LOCATÁRIO(A)</p>
$modelo$
where not exists (select 1 from public.modelos_contrato where nome = 'CONTRATO DE LOCAÇÃO DE IMÓVEL - KITNET (COM ADMINISTRADORA)');

-- 4.3 Contrato de administracao (proprietario x imobiliaria)
insert into public.modelos_contrato (nome, tipo_operacao, categoria, conteudo)
select 'CONTRATO DE ADMINISTRAÇÃO DE IMÓVEIS', 'administracao', 'contrato_administracao', $modelo$
<p style="text-align: center;"><b>CONTRATO DE ADMINISTRAÇÃO DE IMÓVEIS COM OUTORGA DE MANDATO</b></p>
<p style="text-align: center;"><b>Nº #numero_contrato_administracao</b></p>
<p><br></p>
<p><b>Qualificação das Partes</b></p>
<p><b>PROPRIETÁRIO(A):</b> #nome_proprietario#qualificacao_proprietario, inscrito(a) no CPF/CNPJ sob o nº #cpf_cnpj_proprietario, com endereço em #endereco_proprietario, e-mail #email_proprietario, telefone #telefone_proprietario, doravante denominado(a) simplesmente PROPRIETÁRIO(A); e</p>
<p><b>ADMINISTRADORA:</b> #nome_administradora, inscrita no CNPJ sob o nº #cnpj_administradora, registrada no CRECI sob o nº #creci_administradora, com sede em #endereco_administradora, e-mail #email_administradora, telefone #telefone_administradora, neste ato representada por #representante_administradora, inscrito(a) no CPF sob o nº #cpf_representante_administradora, doravante denominada simplesmente ADMINISTRADORA.</p>
<p>As partes acima identificadas celebram o presente Contrato de Administração de Imóveis, com outorga de mandato, regido pelos artigos 653 e seguintes do Código Civil e pelas cláusulas e condições a seguir:</p>
<p><b>1 - Objeto</b></p>
<p>O(A) PROPRIETÁRIO(A) confia à ADMINISTRADORA a administração da locação dos seguintes imóveis de sua propriedade: #imoveis_administrados.</p>
<p>Parágrafo único. Outros imóveis do(a) PROPRIETÁRIO(A) poderão ser incluídos nesta administração mediante termo aditivo, aplicando-se a eles todas as condições deste contrato.</p>
<p><b>2 - Do mandato e dos poderes</b></p>
<p>Para a execução deste contrato, o(a) PROPRIETÁRIO(A) nomeia e constitui a ADMINISTRADORA sua bastante procuradora, conferindo-lhe poderes especiais e expressos para, em seu nome e por sua conta, em relação aos imóveis administrados:</p>
<p>a) anunciar, divulgar e mostrar os imóveis a interessados;</p>
<p>b) selecionar locatários, analisar cadastros e exigir garantias locatícias;</p>
<p>c) negociar as condições da locação e celebrar, assinar, prorrogar, aditar, renovar e rescindir contratos de locação, termos de vistoria e demais instrumentos a eles relacionados;</p>
<p>d) receber valores e dar quitação, quando o contrato de locação previr o pagamento à ADMINISTRADORA;</p>
<p>e) expedir e receber notificações, avisos e comunicações relativas às locações;</p>
<p>f) realizar vistorias de entrada, periódicas e de saída, entregar e receber chaves e autorizar ou recusar obras, benfeitorias e a permanência de terceiros nos imóveis;</p>
<p>g) representar o(a) PROPRIETÁRIO(A) perante concessionárias de serviços públicos, condomínios, repartições públicas e cartórios, no que se refira às locações;</p>
<p>h) promover a cobrança extrajudicial de aluguéis e encargos em atraso.</p>
<p><b>3 - Da cobrança judicial</b></p>
<p>Havendo necessidade de medida judicial relativa às locações, como ação de despejo, cobrança, execução, consignação, revisional ou renovatória, a ADMINISTRADORA indicará advogado de sua confiança, ao qual o(a) PROPRIETÁRIO(A) outorgará procuração com os poderes da cláusula ad judicia. Os honorários contratuais do advogado serão ajustados à parte, diretamente entre o(a) PROPRIETÁRIO(A) e o profissional, e os honorários de sucumbência pertencem ao advogado, nos termos do art. 23 da Lei nº 8.906/1994.</p>
<p><b>4 - Da remuneração</b></p>
<p>Pela administração, a ADMINISTRADORA fará jus a taxa mensal de #taxa_administracao (#taxa_administracao_extenso) sobre o valor do aluguel de cada imóvel locado, devida durante todo o período em que o imóvel permanecer locado por intermédio desta administração. Não há cobrança de taxa enquanto o imóvel estiver desocupado.</p>
<p>Parágrafo primeiro. O aluguel é pago pelo(a) LOCATÁRIO(A) diretamente ao(à) PROPRIETÁRIO(A), que repassará a taxa à ADMINISTRADORA na data de vencimento do aluguel do respectivo mês, prevista no contrato de locação.</p>
<p>Parágrafo segundo. Quando o contrato de locação previr o pagamento do aluguel à ADMINISTRADORA, esta reterá a taxa e repassará o saldo ao(à) PROPRIETÁRIO(A) após a compensação do pagamento.</p>
<p><b>5 - Da ausência de garantia</b></p>
<p>A ADMINISTRADORA não garante o pagamento de aluguéis, encargos ou indenizações devidos pelos locatários, nem responde pela inadimplência ou por danos por eles causados aos imóveis, obrigando-se a empregar diligência na cobrança e na adoção das medidas previstas neste contrato.</p>
<p><b>6 - Das obrigações do(a) PROPRIETÁRIO(A)</b></p>
<p>Compete ao(à) PROPRIETÁRIO(A): a) informar à ADMINISTRADORA o recebimento dos aluguéis pagos diretamente a ele(a), bem como eventual atraso, para permitir a cobrança; b) arcar com os tributos e despesas que lhe cabem por lei, especialmente os previstos no art. 22 da Lei nº 8.245/1991; c) comunicar por escrito qualquer alteração de seus dados cadastrais ou bancários.</p>
<p><b>7 - Da exclusividade</b></p>
<p>Durante a vigência deste contrato, o(a) PROPRIETÁRIO(A) não poderá locar os imóveis administrados diretamente ou por intermédio de terceiros, nem confiar sua administração a outra pessoa ou empresa.</p>
<p><b>8 - Do prazo e da extinção</b></p>
<p>Este contrato vigora por prazo indeterminado, a partir de #data_contrato_administracao, e pode ser denunciado por qualquer das partes mediante aviso por escrito com antecedência mínima de 30 (trinta) dias, sem multa ou indenização.</p>
<p>Parágrafo único. Extinto este contrato, cessam a taxa de administração e a participação da ADMINISTRADORA nas locações em curso, que prosseguirão diretamente entre o(a) PROPRIETÁRIO(A) e os locatários. A ADMINISTRADORA comunicará a extinção aos locatários por escrito e entregará ao(à) PROPRIETÁRIO(A) os contratos, chaves e documentos em seu poder.</p>
<p><b>9 - Do foro</b></p>
<p>As partes elegem expressamente o Foro da Comarca de Curionópolis, Estado do Pará, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer dúvidas, litígios ou ações oriundas da interpretação ou execução deste contrato.</p>
<p>Curionópolis, Pará, #data_hoje.</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_proprietario<br>#cpf_cnpj_proprietario<br>PROPRIETÁRIO(A)</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_administradora<br>CNPJ #cnpj_administradora<br>ADMINISTRADORA</p>
$modelo$
where not exists (select 1 from public.modelos_contrato where nome = 'CONTRATO DE ADMINISTRAÇÃO DE IMÓVEIS');

-- 4.4 Aditivo de renovacao da locacao administrada (prorroga e retifica as partes)
insert into public.modelos_contrato (nome, tipo_operacao, categoria, conteudo)
select 'TERMO ADITIVO DE RENOVAÇÃO - LOCAÇÃO ADMINISTRADA', 'administracao', 'aditivo_contrato', $modelo$
<p style="text-align: center;"><b>TERMO ADITIVO Nº #numero_aditivo AO CONTRATO DE LOCAÇÃO DE IMÓVEL Nº #numero_contrato</b></p>
<p><br></p>
<p><b>Qualificação das Partes</b></p>
<p><b>LOCADOR(A):</b> #nome_locador#qualificacao_locador, inscrito(a) no CPF/CNPJ sob o nº #cpf_locador, com endereço em #endereco_locador, doravante denominado(a) simplesmente LOCADOR(A), neste ato representado(a) por sua mandatária, a ADMINISTRADORA abaixo qualificada;</p>
<p><b>ADMINISTRADORA:</b> #nome_administradora, inscrita no CNPJ sob o nº #cnpj_administradora, registrada no CRECI sob o nº #creci_administradora, com sede em #endereco_administradora, neste ato representada por #representante_administradora, inscrito(a) no CPF sob o nº #cpf_representante_administradora, doravante denominada simplesmente ADMINISTRADORA, que comparece por si e na qualidade de mandatária do(a) LOCADOR(A), com os poderes que lhe foram conferidos pelo Contrato de Administração de Imóveis nº #numero_contrato_administracao, firmado em #data_contrato_administracao; e</p>
<p><b>LOCATÁRIO(A):</b> #nome_locatario#qualificacao_locatario, inscrito(a) no CPF/CNPJ sob o nº #cpf_locatario, com endereço em #endereco_locatario, doravante denominado(a) simplesmente LOCATÁRIO(A).</p>
<p>As partes acima identificadas resolvem aditar o Contrato de Locação de Imóvel nº #numero_contrato, referente ao imóvel situado em #endereco_imovel, mediante as cláusulas e condições a seguir:</p>
<p><b>1 - Da retificação das partes</b></p>
<p>Fica retificada a qualificação das partes do contrato original, para constar que figura como LOCADOR(A) o(a) proprietário(a) do imóvel, #nome_locador, acima qualificado(a), e que #nome_administradora participa da locação exclusivamente como ADMINISTRADORA e mandatária do(a) LOCADOR(A), e não como locadora. As menções do contrato original à imobiliária como locadora passam a ser entendidas como feitas ao(à) LOCADOR(A), representado(a) pela ADMINISTRADORA.</p>
<p><b>2 - Da prorrogação</b></p>
<p>O prazo da locação fica prorrogado por #duracao_meses_extenso, com início em #data_inicio e término em #vigencia_final.</p>
<p><b>3 - Do aluguel</b></p>
<p>A partir de #data_inicio, o aluguel mensal passa a ser de #valor_aluguel (#valor_aluguel_extenso), com vencimento no dia #dia_pagamento de cada mês, mantida a forma de pagamento prevista no contrato.</p>
<p><b>4 - Da Administradora</b></p>
<p>Ficam incluídas no contrato as seguintes disposições:</p>
<p>A ADMINISTRADORA atua no contrato exclusivamente na qualidade de mandatária do(a) LOCADOR(A), nos termos do Contrato de Administração de Imóveis referido na qualificação das partes, praticando em nome deste(a) os atos de administração da locação, e não responde pessoalmente pelas obrigações atribuídas ao(à) LOCADOR(A), na forma do art. 663 do Código Civil.</p>
<p>Parágrafo primeiro. Todas as comunicações, notificações, avisos e pedidos relativos à locação, inclusive o aviso prévio de desocupação e os pedidos de autorização previstos no contrato, deverão ser dirigidos por escrito à ADMINISTRADORA, valendo como se feitos ao(à) LOCADOR(A).</p>
<p>Parágrafo segundo. Compete à ADMINISTRADORA, em nome do(a) LOCADOR(A), realizar as vistorias de entrada, periódicas e de saída, entregar e receber as chaves, autorizar ou recusar obras, benfeitorias e a permanência de terceiros no imóvel, bem como exercer os demais direitos atribuídos ao(à) LOCADOR(A) no contrato.</p>
<p>Parágrafo terceiro. Extinto o Contrato de Administração, o(a) LOCADOR(A) ou a ADMINISTRADORA comunicará o fato por escrito ao(à) LOCATÁRIO(A). A partir do recebimento dessa comunicação, a locação prossegue diretamente entre LOCADOR(A) e LOCATÁRIO(A), nas mesmas condições, cessando a participação da ADMINISTRADORA, e as comunicações passam a ser dirigidas ao(à) LOCADOR(A) no endereço constante do contrato ou no que vier a ser informado por escrito.</p>
<p><b>5 - Da ratificação</b></p>
<p>Permanecem em vigor todas as demais cláusulas e condições do contrato original que não tenham sido alteradas por este termo aditivo.</p>
<p>Curionópolis, Pará, #data_hoje.</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_administradora<br>por si e como procuradora de #nome_locador<br>CNPJ #cnpj_administradora<br>ADMINISTRADORA, por si e representando o(a) LOCADOR(A)</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_locatario<br>#cpf_locatario<br>LOCATÁRIO(A)</p>
$modelo$
where not exists (select 1 from public.modelos_contrato where nome = 'TERMO ADITIVO DE RENOVAÇÃO - LOCAÇÃO ADMINISTRADA');

-- 4.5 Aditivo de inclusao de imovel no contrato de administracao
insert into public.modelos_contrato (nome, tipo_operacao, categoria, conteudo)
select 'TERMO ADITIVO DE INCLUSÃO DE IMÓVEL - CONTRATO DE ADMINISTRAÇÃO', 'administracao', 'aditivo_administracao', $modelo$
<p style="text-align: center;"><b>TERMO ADITIVO AO CONTRATO DE ADMINISTRAÇÃO DE IMÓVEIS Nº #numero_contrato_administracao</b></p>
<p style="text-align: center;"><b>INCLUSÃO DE IMÓVEL</b></p>
<p><br></p>
<p><b>Qualificação das Partes</b></p>
<p><b>PROPRIETÁRIO(A):</b> #nome_proprietario#qualificacao_proprietario, inscrito(a) no CPF/CNPJ sob o nº #cpf_cnpj_proprietario, com endereço em #endereco_proprietario, doravante denominado(a) simplesmente PROPRIETÁRIO(A); e</p>
<p><b>ADMINISTRADORA:</b> #nome_administradora, inscrita no CNPJ sob o nº #cnpj_administradora, registrada no CRECI sob o nº #creci_administradora, com sede em #endereco_administradora, neste ato representada por #representante_administradora, inscrito(a) no CPF sob o nº #cpf_representante_administradora, doravante denominada simplesmente ADMINISTRADORA.</p>
<p>As partes acima identificadas resolvem aditar o Contrato de Administração de Imóveis nº #numero_contrato_administracao, firmado em #data_contrato_administracao, mediante as cláusulas e condições a seguir:</p>
<p><b>1 - Da inclusão de imóvel</b></p>
<p>Em razão da inclusão de novo(s) imóvel(is) na administração, a Cláusula 1 do contrato passa a vigorar com a seguinte relação de imóveis administrados: #imoveis_administrados.</p>
<p><b>2 - Das condições aplicáveis</b></p>
<p>Aplicam-se aos imóveis incluídos todas as condições do contrato, inclusive o mandato e os poderes nele conferidos à ADMINISTRADORA e a taxa de administração de #taxa_administracao (#taxa_administracao_extenso) sobre o valor do aluguel.</p>
<p><b>3 - Da ratificação</b></p>
<p>Permanecem em vigor todas as demais cláusulas e condições do contrato original que não tenham sido alteradas por este termo aditivo.</p>
<p>Curionópolis, Pará, #data_hoje.</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_proprietario<br>#cpf_cnpj_proprietario<br>PROPRIETÁRIO(A)</p>
<p><br></p>
<p><br></p>
<p style="text-align: center;">_______________________________________________<br>#nome_administradora<br>CNPJ #cnpj_administradora<br>ADMINISTRADORA</p>
$modelo$
where not exists (select 1 from public.modelos_contrato where nome = 'TERMO ADITIVO DE INCLUSÃO DE IMÓVEL - CONTRATO DE ADMINISTRAÇÃO');
