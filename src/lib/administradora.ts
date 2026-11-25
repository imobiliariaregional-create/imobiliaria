import { supabase } from "@/lib/supabase";
import type { AutorizacaoAdministracao, CategoriaModelo, ConfiguracaoDocumentos, ModeloContrato, TipoOperacao } from "@/lib/types";

/** Dados da imobiliária que aparecem nos contratos como ADMINISTRADORA. */
export type DadosAdministradora = Pick<
  ConfiguracaoDocumentos,
  | "adm_razao_social"
  | "adm_cnpj"
  | "adm_creci"
  | "adm_endereco"
  | "adm_email"
  | "adm_telefone"
  | "adm_representante_nome"
  | "adm_representante_cpf"
  | "adm_representante_cargo"
>;

export const CAMPOS_ADMINISTRADORA = [
  "adm_razao_social",
  "adm_cnpj",
  "adm_creci",
  "adm_endereco",
  "adm_email",
  "adm_telefone",
  "adm_representante_nome",
  "adm_representante_cpf",
  "adm_representante_cargo",
] as const satisfies readonly (keyof DadosAdministradora)[];

export async function buscarDadosAdministradora(): Promise<DadosAdministradora | null> {
  const { data, error } = await supabase
    .from("configuracoes_documentos")
    .select(CAMPOS_ADMINISTRADORA.join(","))
    .eq("id", true)
    .maybeSingle<DadosAdministradora>();
  if (error) throw new Error(error.message);
  return data;
}

export async function salvarDadosAdministradora(dados: DadosAdministradora) {
  const { error } = await supabase
    .from("configuracoes_documentos")
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error(error.message);
}

/** Contrato de administração (autorização) ativo mais recente que inclui o imóvel. */
export async function buscarAutorizacaoDoImovel(imovelId: string): Promise<AutorizacaoAdministracao | null> {
  const { data, error } = await supabase
    .from("autorizacao_imoveis")
    .select("autorizacoes_administracao(*)")
    .eq("imovel_id", imovelId)
    .returns<{ autorizacoes_administracao: AutorizacaoAdministracao | null }[]>();
  if (error) throw new Error(error.message);
  const ativas = (data ?? [])
    .map((linha) => linha.autorizacoes_administracao)
    .filter((a): a is AutorizacaoAdministracao => a !== null && a.status === "ativa")
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  return ativas[0] ?? null;
}

export async function buscarModelosAtivos(categoria: CategoriaModelo, tipo: TipoOperacao): Promise<ModeloContrato[]> {
  const { data, error } = await supabase
    .from("modelos_contrato")
    .select("*")
    .eq("categoria", categoria)
    .eq("tipo_operacao", tipo)
    .eq("arquivado", false)
    .order("nome")
    .returns<ModeloContrato[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Os códigos usados no texto que dependem do contrato de administração. */
export function usaContratoAdministracao(conteudo: string) {
  return /#(numero|data)_contrato_administracao/i.test(conteudo);
}

export function usaDadosAdministradora(conteudo: string) {
  return /#[a-z_]*administradora/i.test(conteudo);
}

/** Lista os campos obrigatórios da administradora que ainda estão vazios. */
export function camposAdministradoraFaltando(dados: DadosAdministradora | null): string[] {
  const obrigatorios: [keyof DadosAdministradora, string][] = [
    ["adm_razao_social", "razão social"],
    ["adm_cnpj", "CNPJ"],
    ["adm_creci", "CRECI"],
    ["adm_endereco", "endereço"],
    ["adm_representante_nome", "nome do representante"],
    ["adm_representante_cpf", "CPF do representante"],
  ];
  return obrigatorios.filter(([campo]) => !dados?.[campo]?.trim()).map(([, rotulo]) => rotulo);
}
