import type { TipoImovel } from "@/lib/types";
import { formatDate } from "@/lib/format";

export interface CabecalhoDocumento {
  numeroContrato: string | null;
  data: string | null; // ISO (yyyy-mm-dd ou timestamp)
  tipoImovel: TipoImovel | null;
}

export function linhasCabecalho(cabecalho: CabecalhoDocumento): string[] {
  return [
    cabecalho.numeroContrato ? `Número: ${cabecalho.numeroContrato}` : null,
    cabecalho.data ? `Data: ${formatDate(cabecalho.data.slice(0, 10))}` : null,
    cabecalho.tipoImovel ? `Tipo de imóvel: ${cabecalho.tipoImovel === "comercial" ? "Comercial" : "Residencial"}` : null,
  ].filter((linha): linha is string => linha !== null);
}
