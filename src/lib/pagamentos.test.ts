import { describe, expect, it } from "vitest";
import { gerarPagamentosIniciais } from "@/lib/pagamentos";

const base = {
  id: "00000000-0000-0000-0000-000000000001",
  tipo: "administracao" as const,
  valor_aluguel: 2_000,
  dia_pagamento: 31,
  data_inicio: "2026-08-15",
  duracao_meses: 12,
  vigencia_final: "2027-08-15",
  percentual_administracao: 10,
  percentual_comissao: null,
  valor_comissao_fixo: null,
  valor_venda: null,
  forma_comissao_venda: null,
};

describe("geração de pagamentos", () => {
  it("gera exatamente a quantidade de meses do contrato", () => {
    const pagamentos = gerarPagamentosIniciais(base);
    expect(pagamentos).toHaveLength(12);
    expect(pagamentos[0].mes_referencia).toBe("2026-08-01");
    expect(pagamentos[11].mes_referencia).toBe("2027-07-01");
  });

  it("preserva o bruto histórico e calcula 10% de comissão", () => {
    const [pagamento] = gerarPagamentosIniciais(base);
    expect(pagamento.valor_bruto).toBe(2_000);
    expect(pagamento.valor).toBe(200);
  });

  it("respeita o percentual de administração configurado", () => {
    const [pagamento] = gerarPagamentosIniciais({ ...base, percentual_administracao: 8.5 });
    expect(pagamento.valor).toBe(170);
  });

  it("limita o vencimento ao último dia do mês", () => {
    const pagamentos = gerarPagamentosIniciais({ ...base, data_inicio: "2025-02-10", duracao_meses: 1 });
    expect(pagamentos[0].data_vencimento).toBe("2025-02-28");
  });

  it("calcula comissão percentual de venda", () => {
    const [pagamento] = gerarPagamentosIniciais({
      ...base,
      tipo: "venda",
      valor_aluguel: null,
      duracao_meses: null,
      vigencia_final: null,
      valor_venda: 300_000,
      forma_comissao_venda: "percentual",
      percentual_comissao: 5,
    });
    expect(pagamento.valor_bruto).toBe(300_000);
    expect(pagamento.valor).toBe(15_000);
  });
});
