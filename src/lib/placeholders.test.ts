import { describe, expect, it } from "vitest";
import { resolverPlaceholders, resolverPlaceholdersAdministracao, substituirPlaceholders } from "@/lib/placeholders";
import type { AutorizacaoAdministracao, Contrato, Imovel, Proprietario } from "@/lib/types";
import type { DadosAdministradora } from "@/lib/administradora";

const proprietario = {
  id: "p1", nome: "JOÃO DONO", cpf_cnpj: "111.111.111-11", tipo_pessoa: "fisica", taxa_administracao: 10,
  nacionalidade: "BRASILEIRO", estado_civil: null, profissao: null,
} as unknown as Proprietario;

const imovel = {
  id: "i1", proprietario_id: "p1", rua: "RUA A", numero: "10", bairro: "CENTRO", complemento: null,
  cidade: "CURIONÓPOLIS", uf: "PA", cep: null, tipo_imovel: "residencial",
} as unknown as Imovel;

const administradora: DadosAdministradora = {
  adm_razao_social: "IMOBILIÁRIA REGIONAL LTDA", adm_cnpj: "00.000.000/0001-00", adm_creci: "J-1234",
  adm_endereco: "RUA B, 1", adm_email: "contato@exemplo.com", adm_telefone: null,
  adm_representante_nome: "MARIA", adm_representante_cpf: "222.222.222-22", adm_representante_cargo: null,
};

const autorizacao = { id: "a1", numero: "AUT-0003/2026", data_inicio: "2026-03-10", status: "ativa" } as unknown as AutorizacaoAdministracao;

describe("códigos da administradora", () => {
  it("monta o contrato de administração com lista de imóveis e taxa", () => {
    const v = resolverPlaceholdersAdministracao({ proprietario, imoveis: [imovel], autorizacao, administradora });
    expect(v.nome_administradora).toBe("IMOBILIÁRIA REGIONAL LTDA");
    expect(v.numero_contrato_administracao).toBe("AUT-0003/2026");
    expect(v.data_contrato_administracao).toBe("10/03/2026");
    expect(v.taxa_administracao).toBe("10%");
    expect(v.taxa_administracao_extenso).toBe("dez por cento");
    expect(v.imoveis_administrados).toBe("a) RUA A, 10 - CENTRO - CURIONÓPOLIS/PA (residencial)");
  });

  it("na locação usa a taxa do contrato e deixa #numero_aditivo para depois", () => {
    const contrato = { id: "c1", tipo: "administracao", numero_contrato: "CTR-0001/2026", percentual_administracao: 8.5, data_inicio: "2026-04-01" } as unknown as Contrato;
    const v = resolverPlaceholders({ contrato, imovel, proprietario, pessoa: null, administradora, autorizacao });
    expect(v.taxa_administracao).toBe("8,5%");
    expect(v.nome_locador).toBe("JOÃO DONO");
    expect(substituirPlaceholders("#nome_administradora, procuradora de #nome_locador, aditivo #numero_aditivo", v))
      .toBe("IMOBILIÁRIA REGIONAL LTDA, procuradora de JOÃO DONO, aditivo #numero_aditivo");
  });
});
