import { formatCEP, onlyDigits, upper } from "@/lib/forms";

export interface BrasilApiCNPJ {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  descricao_tipo_de_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  ddd_telefone_1?: string | null;
  ddd_telefone_2?: string | null;
  email?: string | null;
}

export interface CNPJFormData {
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
}

export function mapCNPJToForm(data: BrasilApiCNPJ): CNPJFormData {
  const logradouro = [data.descricao_tipo_de_logradouro, data.logradouro]
    .filter(Boolean)
    .join(" ")
    .trim();
  const numero = data.numero && !logradouro.endsWith(` ${data.numero}`) ? data.numero : "";
  const endereco = [
    [logradouro, numero].filter(Boolean).join(", "),
    data.bairro,
    data.complemento,
    [data.municipio, data.uf].filter(Boolean).join("/"),
    data.cep ? `CEP ${formatCEP(data.cep)}` : "",
  ].filter(Boolean).join(" · ");

  return {
    nome: upper(data.razao_social),
    endereco: upper(endereco),
    telefone: onlyDigits(data.ddd_telefone_1 || data.ddd_telefone_2 || ""),
    email: String(data.email ?? "").trim().toLocaleLowerCase("pt-BR"),
  };
}

export async function consultarCNPJ(cnpj: string) {
  const document = onlyDigits(cnpj);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${document}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) throw new Error("CNPJ não encontrado na base pública.");
    if (response.status === 429) throw new Error("Limite temporário de consultas atingido. Tente novamente em instantes.");
    if (!response.ok) throw new Error("Não foi possível consultar o CNPJ agora.");
    return mapCNPJToForm(await response.json() as BrasilApiCNPJ);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A consulta demorou demais. Verifique sua conexão e tente novamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
