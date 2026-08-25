import { describe, expect, it } from "vitest";
import { formatCNPJ, formatCPF, isValidCNPJ, isValidCPF, normalizeSearch, upper } from "@/lib/forms";

describe("documentos brasileiros", () => {
  it("formata e valida CPF", () => {
    expect(formatCPF("52998224725")).toBe("529.982.247-25");
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("formata e valida CNPJ", () => {
    expect(formatCNPJ("11222333000181")).toBe("11.222.333/0001-81");
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("00.000.000/0000-00")).toBe(false);
  });
});

describe("padronização de texto", () => {
  it("converte cadastro para caixa alta", () => {
    expect(upper("  Avenida São João  ")).toBe("AVENIDA SÃO JOÃO");
  });

  it("faz busca sem diferenciar caixa ou acentos", () => {
    expect(normalizeSearch("Administração")).toBe("administracao");
  });
});
