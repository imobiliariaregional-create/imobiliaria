import { addMonthsISO } from "@/lib/format";
import type { Contrato } from "@/lib/types";

export interface NovoPagamento {
  contrato_id: string;
  mes_referencia: string;
  valor_bruto: number;
  valor: number;
  data_vencimento: string;
  status: "pendente";
}

const LIMITE_MESES = 60;

function vencimentoDoMes(mesReferenciaISO: string, diaPagamento: number | null) {
  const [year, month] = mesReferenciaISO.split("-").map(Number);
  const dia = diaPagamento ?? 5;
  const ultimoDiaDoMes = new Date(year, month, 0).getDate();
  const diaValido = Math.min(dia, ultimoDiaDoMes);
  return `${year}-${String(month).padStart(2, "0")}-${String(diaValido).padStart(2, "0")}`;
}

/** Calcula os pagamentos (valores a receber pela imobiliária) a gerar na criação de um contrato. */
export function gerarPagamentosIniciais(contrato: {
  id: string;
  tipo: Contrato["tipo"];
  valor_aluguel: number | null;
  dia_pagamento: number | null;
  data_inicio: string;
  duracao_meses: number | null;
  vigencia_final: string | null;
  percentual_administracao: number | null;
  percentual_comissao: number | null;
  valor_comissao_fixo: number | null;
  valor_venda: number | null;
  forma_comissao_venda: Contrato["forma_comissao_venda"];
}): NovoPagamento[] {
  const mesInicio = contrato.data_inicio.slice(0, 7) + "-01";

  if (contrato.tipo === "aluguel") {
    return [
      {
        contrato_id: contrato.id,
        mes_referencia: mesInicio,
        valor_bruto: Number(contrato.valor_aluguel ?? 0),
        valor: Number(contrato.valor_aluguel ?? 0),
        data_vencimento: vencimentoDoMes(mesInicio, contrato.dia_pagamento),
        status: "pendente",
      },
    ];
  }

  if (contrato.tipo === "venda") {
    const valorComissao =
      contrato.forma_comissao_venda === "fixo"
        ? Number(contrato.valor_comissao_fixo ?? 0)
        : (Number(contrato.valor_venda ?? 0) * Number(contrato.percentual_comissao ?? 0)) / 100;

    return [
      {
        contrato_id: contrato.id,
        mes_referencia: mesInicio,
        valor_bruto: Number(contrato.valor_venda ?? 0),
        valor: valorComissao,
        data_vencimento: contrato.data_inicio,
        status: "pendente",
      },
    ];
  }

  // Administração: comissão configurada sobre o aluguel, gerada mensalmente.
  const valorMensal = Number(contrato.valor_aluguel ?? 0) * Number(contrato.percentual_administracao ?? 10) / 100;
  const pagamentos: NovoPagamento[] = [];
  const quantidadeMeses = Math.min(Math.max(contrato.duracao_meses ?? 12, 1), LIMITE_MESES);
  for (let i = 0; i < quantidadeMeses; i++) {
    const mesAtual = addMonthsISO(mesInicio, i);
    pagamentos.push({
      contrato_id: contrato.id,
      mes_referencia: mesAtual,
      valor_bruto: Number(contrato.valor_aluguel ?? 0),
      valor: valorMensal,
      data_vencimento: vencimentoDoMes(mesAtual, contrato.dia_pagamento),
      status: "pendente",
    });
  }
  return pagamentos;
}
