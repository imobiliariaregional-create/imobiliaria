import { supabase } from "@/lib/supabase";
import type { PagamentoMensal } from "@/lib/types";

export interface DadosSubconta {
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  incomeValue: number;
  birthDate?: string;
  companyType?: string;
}

async function invocar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("asaas", { body });
  if (error) {
    const resposta = "context" in error ? (error as { context?: Response }).context : undefined;
    if (resposta) {
      let corpo: { error?: string } | null = null;
      try {
        corpo = await resposta.clone().json();
      } catch {
        // corpo não era JSON; segue com a mensagem genérica
      }
      if (corpo?.error) throw new Error(corpo.error);
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** Gera (ou reaproveita) o boleto do inquilino/comprador para esse pagamento. */
export function gerarBoleto(pagamentoId: string): Promise<PagamentoMensal> {
  return invocar<PagamentoMensal>({ action: "gerarBoleto", pagamentoId });
}

/** Reconsulta o status da cobrança no Asaas e atualiza o pagamento. */
export function consultarStatusBoleto(chargeId: string): Promise<PagamentoMensal> {
  return invocar<PagamentoMensal>({ action: "consultarStatus", chargeId });
}

/** Cria a subconta Asaas do proprietário (necessária para o split automático). */
export function criarSubconta(proprietarioId: string, dados: DadosSubconta): Promise<{ walletId: string; jaExistia: boolean }> {
  return invocar({ action: "criarSubconta", proprietarioId, ...dados });
}
