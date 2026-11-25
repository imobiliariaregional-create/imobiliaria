import { supabase } from "@/lib/supabase";
import { fetchLetterheadDataUrl } from "@/lib/letterhead";
import { gerarContratoPdfBlob } from "@/lib/exportContrato";
import { resolverPlaceholders, resolverPlaceholdersAdministracao, substituirPlaceholders } from "@/lib/placeholders";
import {
  buscarAutorizacaoDoImovel,
  buscarDadosAdministradora,
  camposAdministradoraFaltando,
  usaContratoAdministracao,
  usaDadosAdministradora,
  type DadosAdministradora,
} from "@/lib/administradora";
import type { AutorizacaoAdministracao, Contrato, Imovel, Pessoa, Proprietario } from "@/lib/types";
import type { CabecalhoDocumento } from "@/lib/contratoDocumento";

/** PDF com o papel timbrado, igual ao "Exportar PDF" do documento do contrato. */
export async function gerarPdfDocumento(conteudo: string, cabecalho?: CabecalhoDocumento): Promise<Blob> {
  const letterheadDataUrl = await fetchLetterheadDataUrl();
  return gerarContratoPdfBlob(conteudo, { letterheadDataUrl, cabecalho });
}

async function administradoraParaModelo(conteudoModelo: string): Promise<DadosAdministradora | null> {
  if (!usaDadosAdministradora(conteudoModelo)) return null;
  const dados = await buscarDadosAdministradora();
  const faltando = camposAdministradoraFaltando(dados);
  if (faltando.length > 0) {
    throw new Error(`Preencha os Dados da imobiliária em Modelos de Contrato antes de gerar. Faltam: ${faltando.join(", ")}.`);
  }
  return dados;
}

/**
 * Texto de um aditivo de contrato. O #numero_aditivo fica no texto e só é
 * trocado ao salvar, quando o banco gera o número.
 */
export async function resolverAditivoContrato(contrato: Contrato, conteudoModelo: string): Promise<string> {
  const imovel = contrato.imoveis;
  if (!imovel) throw new Error("Contrato sem imóvel.");
  if (!imovel.proprietario_id) throw new Error("O imóvel deste contrato não tem proprietário cadastrado.");

  const [{ data: proprietario, error }, pessoa] = await Promise.all([
    supabase.from("proprietarios").select("*").eq("id", imovel.proprietario_id).single<Proprietario>(),
    contrato.pessoas !== undefined
      ? Promise.resolve(contrato.pessoas ?? null)
      : contrato.pessoa_id
        ? supabase.from("pessoas").select("*").eq("id", contrato.pessoa_id).single<Pessoa>().then((r) => r.data)
        : Promise.resolve(null),
  ]);
  if (error || !proprietario) throw new Error("Não foi possível carregar o proprietário do imóvel.");

  const administradora = await administradoraParaModelo(conteudoModelo);
  let autorizacao: AutorizacaoAdministracao | null = null;
  if (usaContratoAdministracao(conteudoModelo)) {
    autorizacao = await buscarAutorizacaoDoImovel(imovel.id);
    if (!autorizacao) {
      throw new Error("Este imóvel não está em nenhum contrato de administração ativo. Cadastre-o em Autorizações de administração antes de gerar.");
    }
  }

  const valores = resolverPlaceholders({ contrato, imovel, proprietario, pessoa, administradora, autorizacao });
  delete valores.numero_aditivo;
  return substituirPlaceholders(conteudoModelo, valores);
}

/** Texto do contrato de administração (ou do aditivo de inclusão) a partir da autorização. */
export async function resolverContratoAdministracao(autorizacao: AutorizacaoAdministracao, conteudoModelo: string): Promise<string> {
  const proprietario = autorizacao.proprietarios;
  if (!proprietario) throw new Error("Autorização sem proprietário.");
  const imoveis = (autorizacao.autorizacao_imoveis ?? [])
    .map((link) => link.imoveis)
    .filter((imovel): imovel is Imovel => Boolean(imovel));
  if (imoveis.length === 0) throw new Error("Selecione ao menos um imóvel na autorização antes de gerar o contrato.");

  const administradora = await administradoraParaModelo(conteudoModelo);
  const valores = resolverPlaceholdersAdministracao({ proprietario, imoveis, autorizacao, administradora });
  return substituirPlaceholders(conteudoModelo, valores);
}
