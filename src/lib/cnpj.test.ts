import { describe, expect, it } from "vitest";
import { mapCNPJToForm } from "@/lib/cnpj";

describe("consulta pública de CNPJ", () => {
  it("converte a resposta da BrasilAPI para os campos do cadastro", () => {
    expect(mapCNPJToForm({
      cnpj: "19131243000197",
      razao_social: "Empresa Exemplo Ltda",
      descricao_tipo_de_logradouro: "Avenida",
      logradouro: "Brasil",
      numero: "100",
      bairro: "Centro",
      complemento: "Sala 2",
      municipio: "Curionópolis",
      uf: "PA",
      cep: "68523000",
      ddd_telefone_1: "94999990000",
      email: "CONTATO@EXEMPLO.COM",
    })).toEqual({
      nome: "EMPRESA EXEMPLO LTDA",
      endereco: "AVENIDA BRASIL, 100 · CENTRO · SALA 2 · CURIONÓPOLIS/PA · CEP 68523-000",
      telefone: "94999990000",
      email: "contato@exemplo.com",
    });
  });

  it("não duplica o número quando ele já aparece no logradouro", () => {
    expect(mapCNPJToForm({
      cnpj: "19131243000197",
      razao_social: "Open Knowledge Brasil",
      descricao_tipo_de_logradouro: "Avenida",
      logradouro: "Paulista 37",
      numero: "37",
    }).endereco).toBe("AVENIDA PAULISTA 37");
  });
});
