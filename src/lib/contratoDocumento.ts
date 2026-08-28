import type { TipoOperacao, TipoImovel } from "@/lib/types";
import { formatDate } from "@/lib/format";

export interface CabecalhoDocumento {
  numeroContrato: string | null;
  data: string | null; // ISO (yyyy-mm-dd ou timestamp)
  tipoImovel: TipoImovel | null;
  tipoOperacao: TipoOperacao;
}

const TITULOS: Record<TipoOperacao, string> = {
  aluguel: "CONTRATO DE LOCAÇÃO DE IMÓVEL",
  administracao: "CONTRATO DE ADMINISTRAÇÃO DE IMÓVEL",
  venda: "CONTRATO DE COMPRA E VENDA DE IMÓVEL",
};

export function tituloDocumento(tipoOperacao: TipoOperacao): string {
  return TITULOS[tipoOperacao];
}

export function linhasCabecalho(cabecalho: CabecalhoDocumento): string[] {
  return [
    cabecalho.numeroContrato ? `Número: ${cabecalho.numeroContrato}` : null,
    cabecalho.data ? `Data: ${formatDate(cabecalho.data.slice(0, 10))}` : null,
    cabecalho.tipoImovel ? `Tipo de imóvel: ${cabecalho.tipoImovel === "comercial" ? "Comercial" : "Residencial"}` : null,
  ].filter((linha): linha is string => linha !== null);
}
