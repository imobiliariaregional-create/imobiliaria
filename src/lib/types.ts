export type TipoOperacao = "aluguel" | "administracao" | "venda";
export type StatusImovel = "disponivel" | "ocupado" | "vendido";
export type StatusContrato = "ativo" | "encerrado" | "renovado";
export type StatusPagamento = "pago" | "pendente" | "atrasado";
export type TipoConsumo = "agua" | "energia";
export type StatusConsumo = "pago" | "pendente";
export type TipoLaudo = "entrada" | "renovacao";
export type FormaComissaoVenda = "percentual" | "fixo";

export interface Proprietario {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  chave_pix: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface Pessoa {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  created_at: string;
}

export interface Imovel {
  id: string;
  proprietario_id: string | null;
  rua: string;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  tipo_operacao: TipoOperacao;
  controla_agua: boolean;
  controla_energia: boolean;
  status: StatusImovel;
  observacoes: string | null;
  created_at: string;
  proprietarios?: Proprietario | null;
}

export interface Contrato {
  id: string;
  imovel_id: string;
  pessoa_id: string | null;
  tipo: TipoOperacao;
  valor_aluguel: number | null;
  dia_pagamento: number | null;
  data_inicio: string;
  vigencia_final: string | null;
  forma_comissao_venda: FormaComissaoVenda | null;
  percentual_comissao: number | null;
  valor_comissao_fixo: number | null;
  valor_venda: number | null;
  status: StatusContrato;
  observacoes: string | null;
  created_at: string;
  imoveis?: Imovel | null;
  pessoas?: Pessoa | null;
}

export interface PagamentoMensal {
  id: string;
  contrato_id: string;
  mes_referencia: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusPagamento;
  valor_repassado: number | null;
  data_repasse: string | null;
  created_at: string;
  contratos?: Contrato | null;
}

export interface ContaConsumo {
  id: string;
  imovel_id: string;
  tipo: TipoConsumo;
  mes_referencia: string;
  status_pagamento: StatusConsumo;
  data_pagamento: string | null;
  created_at: string;
  imoveis?: Imovel | null;
}

export interface LaudoVistoria {
  id: string;
  contrato_id: string;
  tipo: TipoLaudo;
  data: string;
  arquivo_url: string | null;
  observacoes: string | null;
  created_at: string;
  contratos?: Contrato | null;
}

export interface NotaFiscal {
  id: string;
  numero: string | null;
  valor: number;
  data_emissao: string;
  descricao: string | null;
  arquivo_url: string | null;
  contrato_id: string | null;
  created_at: string;
  contratos?: Contrato | null;
}
