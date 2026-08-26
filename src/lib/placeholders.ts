import { formatBRL, formatDate, todayISO } from "@/lib/format";
import { numeroPorExtenso, valorPorExtensoBRL, dataPorExtenso } from "@/lib/extenso";
import type { Contrato, Imovel, Proprietario, Pessoa } from "@/lib/types";

export interface PlaceholderInfo {
  codigo: string;
  descricao: string;
  categoria: "Proprietário" | "Inquilino/Comprador" | "Imóvel" | "Contrato";
}

export interface DadosResolucao {
  contrato: Contrato;
  imovel: Imovel;
  proprietario: Proprietario;
  pessoa: Pessoa | null;
}

function enderecoCompletoImovel(imovel: Imovel): string {
  const partes = [
    imovel.numero ? `${imovel.rua}, ${imovel.numero}` : imovel.rua,
    imovel.bairro,
    imovel.complemento,
    imovel.cidade && imovel.uf ? `${imovel.cidade}/${imovel.uf}` : imovel.cidade,
    imovel.cep ? `CEP ${imovel.cep}` : null,
  ].filter(Boolean);
  return partes.join(" - ");
}

function numeroContratoExtenso(numero: string): string {
  const [seqStr, anoStr] = numero.split("/");
  const seq = Number(seqStr);
  const ano = Number(anoStr);
  if (Number.isNaN(seq) || Number.isNaN(ano)) return "";
  return `${numeroPorExtenso(seq)} barra ${numeroPorExtenso(ano)}`;
}

/** Monta o dicionário código -> valor com todos os placeholders (incluindo aliases por papel contratual). */
export function resolverPlaceholders({ contrato, imovel, proprietario, pessoa }: DadosResolucao): Record<string, string> {
  const hoje = todayISO();
  const v: Record<string, string> = {};

  // ===== Proprietário =====
  v.nome_proprietario = proprietario.nome ?? "";
  v.cpf_cnpj_proprietario = proprietario.cpf_cnpj ?? "";
  v.rg_proprietario = proprietario.rg ?? "";
  v.endereco_proprietario = proprietario.endereco ?? "";
  v.telefone_proprietario = proprietario.telefone ?? "";
  v.email_proprietario = proprietario.email ?? "";
  v.natureza_proprietario = proprietario.tipo_pessoa === "juridica" ? "Pessoa Jurídica" : "Pessoa Física";
  v.representante_nome_proprietario = proprietario.representante_nome ?? "";
  v.representante_cpf_proprietario = proprietario.representante_cpf ?? "";
  v.representante_rg_proprietario = proprietario.representante_rg ?? "";
  v.chave_pix_proprietario = proprietario.chave_pix ?? "";
  v.tipo_chave_pix_proprietario = proprietario.tipo_chave_pix ?? "";
  v.titular_conta_proprietario = proprietario.titular_conta ?? "";
  v.banco_proprietario = proprietario.banco ?? "";
  v.agencia_proprietario = proprietario.agencia ?? "";
  v.conta_proprietario = proprietario.conta ?? "";
  v.tipo_conta_proprietario = proprietario.tipo_conta ?? "";
  v.dados_bancarios_proprietario = [
    proprietario.banco ? `Banco: ${proprietario.banco}` : null,
    proprietario.agencia ? `Agência: ${proprietario.agencia}` : null,
    proprietario.conta ? `Conta ${proprietario.tipo_conta === "poupanca" ? "poupança" : "corrente"}: ${proprietario.conta}` : null,
    proprietario.chave_pix ? `PIX: ${proprietario.chave_pix}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  for (const alias of ["locador", "vendedor"]) {
    v[`nome_${alias}`] = v.nome_proprietario;
    v[`cpf_${alias}`] = v.cpf_cnpj_proprietario;
    v[`rg_${alias}`] = v.rg_proprietario;
    v[`endereco_${alias}`] = v.endereco_proprietario;
    v[`telefone_${alias}`] = v.telefone_proprietario;
    v[`email_${alias}`] = v.email_proprietario;
  }

  // ===== Inquilino/Comprador =====
  v.nome_pessoa = pessoa?.nome ?? "";
  v.cpf_cnpj_pessoa = pessoa?.cpf_cnpj ?? "";
  v.rg_pessoa = pessoa?.rg ?? "";
  v.endereco_pessoa = pessoa?.endereco ?? "";
  v.telefone_pessoa = pessoa?.telefone ?? "";
  v.email_pessoa = pessoa?.email ?? "";
  v.natureza_pessoa = pessoa?.tipo_pessoa === "juridica" ? "Pessoa Jurídica" : "Pessoa Física";
  v.representante_nome_pessoa = pessoa?.representante_nome ?? "";
  v.representante_cpf_pessoa = pessoa?.representante_cpf ?? "";
  v.representante_rg_pessoa = pessoa?.representante_rg ?? "";

  for (const alias of ["locatario", "comprador"]) {
    v[`nome_${alias}`] = v.nome_pessoa;
    v[`cpf_${alias}`] = v.cpf_cnpj_pessoa;
    v[`rg_${alias}`] = v.rg_pessoa;
    v[`endereco_${alias}`] = v.endereco_pessoa;
    v[`telefone_${alias}`] = v.telefone_pessoa;
    v[`email_${alias}`] = v.email_pessoa;
  }

  // ===== Imóvel =====
  v.endereco_imovel = enderecoCompletoImovel(imovel);
  v.rua_imovel = imovel.rua ?? "";
  v.numero_imovel = imovel.numero ?? "";
  v.bairro_imovel = imovel.bairro ?? "";
  v.complemento_imovel = imovel.complemento ?? "";
  v.cidade_imovel = imovel.cidade ?? "";
  v.uf_imovel = imovel.uf ?? "";
  v.cep_imovel = imovel.cep ?? "";
  v.tipo_imovel = imovel.tipo_imovel === "comercial" ? "Comercial" : "Residencial";
  v.descricao_imovel = imovel.descricao ?? "";

  // ===== Contrato =====
  v.numero_contrato = contrato.numero_contrato ?? "";
  v.numero_contrato_extenso = contrato.numero_contrato ? numeroContratoExtenso(contrato.numero_contrato) : "";
  v.data_inicio = formatDate(contrato.data_inicio);
  v.data_inicio_extenso = dataPorExtenso(contrato.data_inicio);
  v.vigencia_final = formatDate(contrato.vigencia_final);
  v.vigencia_final_extenso = contrato.vigencia_final ? dataPorExtenso(contrato.vigencia_final) : "";
  v.duracao_meses = contrato.duracao_meses != null ? String(contrato.duracao_meses) : "";
  v.duracao_meses_extenso =
    contrato.duracao_meses != null
      ? `${numeroPorExtenso(contrato.duracao_meses)} ${contrato.duracao_meses === 1 ? "mês" : "meses"}`
      : "";
  v.dia_pagamento = contrato.dia_pagamento != null ? String(contrato.dia_pagamento) : "";
  v.valor_aluguel = contrato.valor_aluguel != null ? formatBRL(contrato.valor_aluguel) : "";
  v.valor_aluguel_extenso = contrato.valor_aluguel != null ? valorPorExtensoBRL(contrato.valor_aluguel) : "";

  const valorTotal =
    contrato.valor_aluguel != null && contrato.duracao_meses != null ? contrato.valor_aluguel * contrato.duracao_meses : null;
  v.valor_total_contrato = valorTotal != null ? formatBRL(valorTotal) : "";
  v.valor_total_contrato_extenso = valorTotal != null ? valorPorExtensoBRL(valorTotal) : "";

  v.valor_venda = contrato.valor_venda != null ? formatBRL(contrato.valor_venda) : "";
  v.valor_venda_extenso = contrato.valor_venda != null ? valorPorExtensoBRL(contrato.valor_venda) : "";
  v.forma_comissao =
    contrato.forma_comissao_venda === "fixo" ? "Valor fixo" : contrato.forma_comissao_venda === "percentual" ? "Percentual" : "";
  v.percentual_comissao = contrato.percentual_comissao != null ? `${contrato.percentual_comissao}%` : "";
  v.valor_comissao_fixo = contrato.valor_comissao_fixo != null ? formatBRL(contrato.valor_comissao_fixo) : "";

  const valorComissao =
    contrato.forma_comissao_venda === "fixo"
      ? contrato.valor_comissao_fixo
      : contrato.valor_venda != null && contrato.percentual_comissao != null
        ? (contrato.valor_venda * contrato.percentual_comissao) / 100
        : null;
  v.valor_comissao_extenso = valorComissao != null ? valorPorExtensoBRL(valorComissao) : "";

  v.tipo_operacao = contrato.tipo === "venda" ? "Venda" : contrato.tipo === "administracao" ? "Administração" : "Aluguel";
  v.data_hoje = formatDate(hoje);
  v.data_hoje_extenso = dataPorExtenso(hoje);

  return v;
}

/** Substitui todas as ocorrências de #codigo no texto pelos valores resolvidos. */
export function substituirPlaceholders(texto: string, valores: Record<string, string>): string {
  return texto.replace(/#([a-zA-Z_]+)/g, (match, codigo) => {
    const chave = String(codigo).toLowerCase();
    return chave in valores ? valores[chave] : match;
  });
}

export const PLACEHOLDERS: PlaceholderInfo[] = [
  { codigo: "#nome_proprietario", descricao: "Nome/razão social do proprietário (aliases: #nome_locador, #nome_vendedor)", categoria: "Proprietário" },
  { codigo: "#cpf_cnpj_proprietario", descricao: "CPF/CNPJ do proprietário (aliases: #cpf_locador, #cpf_vendedor)", categoria: "Proprietário" },
  { codigo: "#rg_proprietario", descricao: "RG do proprietário (aliases: #rg_locador, #rg_vendedor)", categoria: "Proprietário" },
  { codigo: "#endereco_proprietario", descricao: "Endereço do proprietário (aliases: #endereco_locador, #endereco_vendedor)", categoria: "Proprietário" },
  { codigo: "#telefone_proprietario", descricao: "Telefone do proprietário", categoria: "Proprietário" },
  { codigo: "#email_proprietario", descricao: "E-mail do proprietário", categoria: "Proprietário" },
  { codigo: "#natureza_proprietario", descricao: "\"Pessoa Física\" ou \"Pessoa Jurídica\"", categoria: "Proprietário" },
  { codigo: "#representante_nome_proprietario", descricao: "Nome do representante legal (quando pessoa jurídica)", categoria: "Proprietário" },
  { codigo: "#representante_cpf_proprietario", descricao: "CPF do representante legal", categoria: "Proprietário" },
  { codigo: "#representante_rg_proprietario", descricao: "RG do representante legal", categoria: "Proprietário" },
  { codigo: "#chave_pix_proprietario", descricao: "Chave PIX do proprietário", categoria: "Proprietário" },
  { codigo: "#tipo_chave_pix_proprietario", descricao: "Tipo da chave PIX", categoria: "Proprietário" },
  { codigo: "#titular_conta_proprietario", descricao: "Titular da conta", categoria: "Proprietário" },
  { codigo: "#banco_proprietario", descricao: "Banco do proprietário", categoria: "Proprietário" },
  { codigo: "#agencia_proprietario", descricao: "Agência bancária do proprietário", categoria: "Proprietário" },
  { codigo: "#conta_proprietario", descricao: "Conta bancária do proprietário", categoria: "Proprietário" },
  { codigo: "#tipo_conta_proprietario", descricao: "Tipo de conta (corrente/poupança)", categoria: "Proprietário" },
  { codigo: "#dados_bancarios_proprietario", descricao: "Banco, agência, conta e PIX do proprietário, já formatados numa linha", categoria: "Proprietário" },

  { codigo: "#nome_pessoa", descricao: "Nome/razão social do inquilino ou comprador (aliases: #nome_locatario, #nome_comprador)", categoria: "Inquilino/Comprador" },
  { codigo: "#cpf_cnpj_pessoa", descricao: "CPF/CNPJ (aliases: #cpf_locatario, #cpf_comprador)", categoria: "Inquilino/Comprador" },
  { codigo: "#rg_pessoa", descricao: "RG (aliases: #rg_locatario, #rg_comprador)", categoria: "Inquilino/Comprador" },
  { codigo: "#endereco_pessoa", descricao: "Endereço (aliases: #endereco_locatario, #endereco_comprador)", categoria: "Inquilino/Comprador" },
  { codigo: "#telefone_pessoa", descricao: "Telefone", categoria: "Inquilino/Comprador" },
  { codigo: "#email_pessoa", descricao: "E-mail", categoria: "Inquilino/Comprador" },
  { codigo: "#natureza_pessoa", descricao: "\"Pessoa Física\" ou \"Pessoa Jurídica\"", categoria: "Inquilino/Comprador" },
  { codigo: "#representante_nome_pessoa", descricao: "Nome do representante legal (quando pessoa jurídica)", categoria: "Inquilino/Comprador" },
  { codigo: "#representante_cpf_pessoa", descricao: "CPF do representante legal", categoria: "Inquilino/Comprador" },
  { codigo: "#representante_rg_pessoa", descricao: "RG do representante legal", categoria: "Inquilino/Comprador" },

  { codigo: "#endereco_imovel", descricao: "Endereço completo formatado do imóvel", categoria: "Imóvel" },
  { codigo: "#rua_imovel", descricao: "Rua do imóvel", categoria: "Imóvel" },
  { codigo: "#numero_imovel", descricao: "Número do imóvel", categoria: "Imóvel" },
  { codigo: "#bairro_imovel", descricao: "Bairro do imóvel", categoria: "Imóvel" },
  { codigo: "#complemento_imovel", descricao: "Complemento do imóvel", categoria: "Imóvel" },
  { codigo: "#cidade_imovel", descricao: "Cidade do imóvel", categoria: "Imóvel" },
  { codigo: "#uf_imovel", descricao: "UF do imóvel", categoria: "Imóvel" },
  { codigo: "#cep_imovel", descricao: "CEP do imóvel", categoria: "Imóvel" },
  { codigo: "#tipo_imovel", descricao: "\"Residencial\" ou \"Comercial\"", categoria: "Imóvel" },
  { codigo: "#descricao_imovel", descricao: "Descrição/características cadastradas no imóvel", categoria: "Imóvel" },

  { codigo: "#numero_contrato", descricao: "Número do contrato (ex: 001/26)", categoria: "Contrato" },
  { codigo: "#numero_contrato_extenso", descricao: "Número do contrato por extenso", categoria: "Contrato" },
  { codigo: "#data_inicio", descricao: "Data de início do contrato", categoria: "Contrato" },
  { codigo: "#data_inicio_extenso", descricao: "Data de início por extenso", categoria: "Contrato" },
  { codigo: "#vigencia_final", descricao: "Data de vigência final (calculada)", categoria: "Contrato" },
  { codigo: "#vigencia_final_extenso", descricao: "Vigência final por extenso", categoria: "Contrato" },
  { codigo: "#duracao_meses", descricao: "Duração do contrato em meses", categoria: "Contrato" },
  { codigo: "#duracao_meses_extenso", descricao: "Duração do contrato por extenso", categoria: "Contrato" },
  { codigo: "#dia_pagamento", descricao: "Dia de pagamento do aluguel", categoria: "Contrato" },
  { codigo: "#valor_aluguel", descricao: "Valor do aluguel em R$", categoria: "Contrato" },
  { codigo: "#valor_aluguel_extenso", descricao: "Valor do aluguel por extenso", categoria: "Contrato" },
  { codigo: "#valor_total_contrato", descricao: "Valor total estimado do contrato (aluguel × duração)", categoria: "Contrato" },
  { codigo: "#valor_total_contrato_extenso", descricao: "Valor total estimado por extenso", categoria: "Contrato" },
  { codigo: "#valor_venda", descricao: "Valor de venda em R$", categoria: "Contrato" },
  { codigo: "#valor_venda_extenso", descricao: "Valor de venda por extenso", categoria: "Contrato" },
  { codigo: "#forma_comissao", descricao: "\"Percentual\" ou \"Valor fixo\"", categoria: "Contrato" },
  { codigo: "#percentual_comissao", descricao: "Percentual de comissão", categoria: "Contrato" },
  { codigo: "#valor_comissao_fixo", descricao: "Valor fixo de comissão em R$", categoria: "Contrato" },
  { codigo: "#valor_comissao_extenso", descricao: "Valor da comissão por extenso", categoria: "Contrato" },
  { codigo: "#tipo_operacao", descricao: "\"Aluguel\", \"Administração\" ou \"Venda\"", categoria: "Contrato" },
  { codigo: "#data_hoje", descricao: "Data de hoje (geração do documento)", categoria: "Contrato" },
  { codigo: "#data_hoje_extenso", descricao: "Data de hoje por extenso", categoria: "Contrato" },
];
