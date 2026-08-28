export type TipoOperacao = "aluguel" | "administracao" | "venda";
export type StatusImovel = "disponivel" | "ocupado" | "vendido";
export type StatusContrato = "ativo" | "encerrado" | "renovado";
export type StatusPagamento = "pago" | "pendente";
export type TipoConsumo = "agua" | "energia";
export type StatusConsumo = "pago" | "pendente";
export type TipoLaudo = "entrada" | "renovacao" | "saida";
export type FormaComissaoVenda = "percentual" | "fixo";
export type RecebimentoAluguel = "imobiliaria" | "proprietario";
export type TipoPessoa = "fisica" | "juridica";
export type TipoContaBancaria = "corrente" | "poupanca";
export type TipoImovel = "residencial" | "comercial";
export type TipoChavePix = "cpf" | "cnpj" | "telefone" | "email" | "aleatoria";
export type PapelUsuario = "admin" | "financeiro" | "corretor";
export type StatusAutorizacao = "ativa" | "encerrada" | "cancelada";

export interface Perfil {
  user_id: string;
  papel: PapelUsuario;
  created_at: string;
  updated_at: string;
}

export interface Proprietario {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  chave_pix: string | null;
  tipo_chave_pix: TipoChavePix | null;
  titular_conta: string | null;
  observacoes: string | null;
  endereco: string | null;
  rg: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: TipoContaBancaria | null;
  tipo_pessoa: TipoPessoa;
  representante_nome: string | null;
  representante_cpf: string | null;
  representante_rg: string | null;
  created_at: string;
}

export interface Pessoa {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  rg: string | null;
  endereco: string | null;
  tipo_pessoa: TipoPessoa;
  representante_nome: string | null;
  representante_cpf: string | null;
  representante_rg: string | null;
  created_at: string;
}

export interface Imovel {
  id: string;
  proprietario_id: string | null;
  rua: string;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  tipo_operacao: TipoOperacao;
  tipo_imovel: TipoImovel;
  descricao: string | null;
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
  numero_contrato: string | null;
  valor_aluguel: number | null;
  percentual_administracao: number | null;
  recebimento_aluguel: RecebimentoAluguel | null;
  dia_pagamento: number | null;
  data_inicio: string;
  duracao_meses: number | null;
  vigencia_final: string | null;
  periodo_visita_dias: number | null;
  data_ultima_visita: string | null;
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
  valor_bruto: number;
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
  numero: string | null;
  data: string;
  arquivo_url: string | null;
  drive_file_id: string | null;
  drive_file_name: string | null;
  drive_mime_type: string | null;
  drive_file_size: number | null;
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
  drive_file_id: string | null;
  drive_file_name: string | null;
  drive_mime_type: string | null;
  drive_file_size: number | null;
  contrato_id: string | null;
  pagamento_mensal_id: string | null;
  created_at: string;
  contratos?: Contrato | null;
}

export interface ClausulaDocumento {
  id: string;
  titulo: string | null;
  texto: string;
}

export interface ModeloContrato {
  id: string;
  nome: string;
  tipo_operacao: TipoOperacao;
  clausulas: ClausulaDocumento[];
  created_at: string;
}

export type OrigemContratoGerado = "gerado" | "importado";

export interface ContratoGerado {
  id: string;
  contrato_id: string;
  modelo_id: string | null;
  clausulas: ClausulaDocumento[];
  created_at: string;
  origem: OrigemContratoGerado;
  arquivo_importado_drive_file_id: string | null;
  arquivo_importado_drive_file_name: string | null;
  arquivo_importado_drive_mime_type: string | null;
  arquivo_importado_drive_file_size: number | null;
  assinafy_document_id: string | null;
  assinafy_assignment_id: string | null;
  assinafy_status: string | null;
  assinafy_resumo: { signer_count: number; completed_count: number } | null;
  drive_file_id: string | null;
  drive_file_name: string | null;
  drive_mime_type: string | null;
  drive_file_size: number | null;
}

export type TipoAditivo = "prazo" | "valor" | "clausulas" | "outro";
export interface AditivoContratual {
  id: string;
  contrato_id: string;
  numero: string | null;
  data: string;
  tipo: TipoAditivo;
  titulo: string | null;
  descricao: string | null;
  drive_file_id: string | null;
  drive_file_name: string | null;
  drive_mime_type: string | null;
  drive_file_size: number | null;
  created_at: string;
}

export interface ConfiguracaoDocumentos {
  id: boolean;
  papel_timbrado_drive_file_id: string | null;
  papel_timbrado_drive_file_name: string | null;
  papel_timbrado_drive_mime_type: string | null;
  papel_timbrado_drive_file_size: number | null;
  updated_at: string;
}

export interface AutorizacaoAdministracao {
  id: string;
  proprietario_id: string;
  numero: string | null;
  data_inicio: string;
  data_fim: string | null;
  status: StatusAutorizacao;
  observacoes: string | null;
  drive_file_id: string | null;
  drive_file_name: string | null;
  drive_mime_type: string | null;
  drive_file_size: number | null;
  assinafy_document_id: string | null;
  assinafy_assignment_id: string | null;
  assinafy_status: string | null;
  assinafy_resumo: { signer_count: number; completed_count: number } | null;
  created_at: string;
  updated_at: string;
  proprietarios?: Proprietario | null;
  autorizacao_imoveis?: { imovel_id: string; imoveis?: Imovel | null }[];
}
