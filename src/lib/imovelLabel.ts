import { supabase } from "@/lib/supabase";
import type { Contrato, Imovel } from "@/lib/types";

/** Busca o contrato ativo de cada imóvel informado, numa única query. */
export async function mapaContratosAtivosPorImovel(imovelIds: string[]): Promise<Map<string, Contrato>> {
  if (imovelIds.length === 0) return new Map();
  const { data } = await supabase
    .from("contratos")
    .select("*, pessoas(*)")
    .eq("status", "ativo")
    .in("imovel_id", imovelIds)
    .returns<Contrato[]>();

  const map = new Map<string, Contrato>();
  for (const c of data ?? []) {
    const atual = map.get(c.imovel_id);
    if (!atual || c.created_at > atual.created_at) map.set(c.imovel_id, c);
  }
  return map;
}

export function enderecoImovel(imovel: Pick<Imovel, "rua" | "numero" | "bairro" | "complemento" | "cidade" | "uf" | "cep">): string {
  return [
    [imovel.rua, imovel.numero].filter(Boolean).join(", "),
    imovel.bairro,
    imovel.complemento,
    [imovel.cidade, imovel.uf].filter(Boolean).join("/") || null,
    imovel.cep ? `CEP ${imovel.cep}` : null,
  ].filter(Boolean).join(" · ");
}

/** Nome do inquilino/comprador do contrato ativo, ou endereço como alternativa (imóvel vago). */
export function imovelLabel(imovel: Pick<Imovel, "rua" | "numero" | "bairro" | "complemento" | "cidade" | "uf" | "cep">, contratoAtivo?: Contrato | null): string {
  return contratoAtivo?.pessoas?.nome || enderecoImovel(imovel);
}
