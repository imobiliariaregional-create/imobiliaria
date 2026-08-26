import { describe, expect, it } from "vitest";
import { formatCEP, formatCNPJ, formatCPF, formatPhone, formatPixKey, isValidCEP, isValidCNPJ, isValidCPF, isValidPhone, isValidPixKey, normalizeSearch, parseBRLInput, upper } from "@/lib/forms";

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

describe("CEP brasileiro", () => {
  it("formata e valida oito dígitos", () => {
    expect(formatCEP("68750000")).toBe("68750-000");
    expect(formatCEP("68750-0009")).toBe("68750-000");
    expect(isValidCEP("68750-000")).toBe(true);
    expect(isValidCEP("68750000")).toBe(false);
    expect(isValidCEP("68750-00")).toBe(false);
  });
});

describe("valor monetário brasileiro", () => {
  it("interpreta reais digitados sem exigir centavos", () => {
    expect(parseBRLInput("1000")).toBe(1000);
    expect(parseBRLInput("R$ 1.000,00")).toBe(1000);
    expect(parseBRLInput("1250,75")).toBe(1250.75);
    expect(parseBRLInput("")).toBeNull();
  });
});

describe("telefone e PIX", () => {
  it("formata e valida telefone nacional", () => {
    expect(formatPhone("91987654321")).toBe("(91) 98765-4321");
    expect(formatPhone("9132345678")).toBe("(91) 3234-5678");
    expect(isValidPhone("(91) 98765-4321")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });

  it("formata e valida a chave conforme o tipo PIX", () => {
    expect(formatPixKey("52998224725", "cpf")).toBe("529.982.247-25");
    expect(isValidPixKey("529.982.247-25", "cpf")).toBe(true);
    expect(formatPixKey("USUARIO@EXEMPLO.COM", "email")).toBe("usuario@exemplo.com");
    expect(isValidPixKey("usuario@exemplo.com", "email")).toBe(true);
    expect(isValidPixKey("529.982.247-25", "cnpj")).toBe(false);
  });
});
