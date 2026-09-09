// Edge Function: proxy seguro para a API do Asaas (boletos dos inquilinos/compradores).
// A chave de API (ASAAS_API_KEY) fica só aqui no servidor, nunca no navegador.
//
// Deploy (via Supabase CLI, na raiz do projeto):
//   npx supabase functions deploy asaas
//   npx supabase secrets set ASAAS_API_KEY="..." ASAAS_BASE_URL="https://sandbox.asaas.com/api/v3" ASAAS_WEBHOOK_TOKEN="escolha-uma-senha-longa-aleatoria"
//
// IMPORTANTE: essa função precisa aceitar chamadas do PRÓPRIO Asaas (o webhook),
// que não têm sessão do Supabase. Por isso ela roda com "verify_jwt = false"
// (ver supabase/config.toml) e faz a própria checagem de autenticação por dentro:
// ações normais exigem sessão do usuário; o webhook exige o token configurado
// abaixo, batendo com o "Token de autenticação" cadastrado no painel do Asaas
// em Integrações -> Webhooks.
//
// Depois de configurar os secrets, cadastre o webhook no Asaas apontando para:
//   https://<seu-projeto>.supabase.co/functions/v1/asaas/webhook
// eventos: PAYMENT_RECEIVED e PAYMENT_CONFIRMED. Token de autenticação = ASAAS_WEBHOOK_TOKEN.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function exigirUsuarioAutenticado(req: Request) {
  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError("Sessão obrigatória.", 401);
  if (!supabaseUrl || !anonKey) throw new Error("Ambiente Supabase incompleto.");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: anonKey },
  });
  if (!response.ok) throw new HttpError("Sessão inválida ou expirada.", 401);
}

async function asaasFetch(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  const baseUrl = Deno.env.get("ASAAS_BASE_URL");
  if (!apiKey || !baseUrl) throw new Error("ASAAS_API_KEY/ASAAS_BASE_URL não configuradas nos secrets da function.");
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), "Content-Type": "application/json", access_token: apiKey },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mensagem = body?.errors?.[0]?.description || body?.message || `Erro Asaas (${res.status})`;
    throw new Error(mensagem);
  }
  return body;
}

/** Só dígitos — o Asaas não aceita CPF/CNPJ formatado com pontuação. */
function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Reaproveita o cliente Asaas se a pessoa já tiver um; senão busca por CPF/CNPJ ou cria. */
async function obterOuCriarCliente(pessoa: { id: string; nome: string; cpf_cnpj: string | null; email: string | null; telefone: string | null; asaas_customer_id: string | null }): Promise<string> {
  if (pessoa.asaas_customer_id) return pessoa.asaas_customer_id;
  if (!pessoa.cpf_cnpj) throw new Error(`${pessoa.nome} não tem CPF/CNPJ cadastrado — necessário para gerar boleto.`);

  const cpfCnpj = somenteDigitos(pessoa.cpf_cnpj);
  const existentes = await asaasFetch(`/customers?cpfCnpj=${cpfCnpj}`);
  const existente = existentes?.data?.[0];
  if (existente?.id) return existente.id as string;

  const criado = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: pessoa.nome,
      cpfCnpj,
      email: pessoa.email || undefined,
      mobilePhone: pessoa.telefone ? somenteDigitos(pessoa.telefone) : undefined,
    }),
  });
  return criado.id as string;
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Ambiente Supabase incompleto.");
  const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
  if (!res.ok) throw new Error(`Erro Supabase (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

interface DadosGerarBoleto {
  pagamentoId: string;
}

async function gerarBoleto({ pagamentoId }: DadosGerarBoleto) {
  const [pagamento] = await supabaseRest(
    `/pagamentos_mensais?id=eq.${pagamentoId}&select=*,contratos(*,pessoas(*))`
  );
  if (!pagamento) throw new HttpError("Pagamento não encontrado.", 404);
  const contrato = pagamento.contratos;
  const pessoa = contrato?.pessoas;
  if (!contrato || !pessoa) throw new HttpError("Este pagamento não tem inquilino/comprador vinculado.", 400);

  if (contrato.tipo === "administracao" && contrato.recebimento_aluguel !== "imobiliaria") {
    throw new HttpError(
      "Geração de boleto ainda não disponível para contratos onde o proprietário recebe diretamente (aguardando integração de split).",
      400
    );
  }

  const valorCobranca = contrato.tipo === "administracao" ? pagamento.valor_bruto : pagamento.valor;
  const customerId = await obterOuCriarCliente(pessoa);

  const cobranca = await asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "BOLETO",
      value: Number(valorCobranca),
      dueDate: pagamento.data_vencimento,
      description: `Aluguel referente a ${pagamento.mes_referencia?.slice(0, 7) ?? ""}`,
      fine: { value: 2, type: "PERCENTAGE" },
      interest: { value: 1 },
    }),
  });

  let linhaDigitavel: string | null = null;
  try {
    const identificacao = await asaasFetch(`/payments/${cobranca.id}/identificationField`);
    linhaDigitavel = identificacao?.identificationField ?? null;
  } catch {
    // Nem todo meio de pagamento tem linha digitavel de imediato; segue sem travar a geracao.
  }

  if (!pessoa.asaas_customer_id) {
    await supabaseRest(`/pessoas?id=eq.${pessoa.id}`, { method: "PATCH", body: JSON.stringify({ asaas_customer_id: customerId }) });
  }

  const [atualizado] = await supabaseRest(`/pagamentos_mensais?id=eq.${pagamentoId}`, {
    method: "PATCH",
    body: JSON.stringify({
      asaas_charge_id: cobranca.id,
      asaas_status: cobranca.status,
      asaas_boleto_url: cobranca.bankSlipUrl ?? cobranca.invoiceUrl ?? null,
      asaas_linha_digitavel: linhaDigitavel,
    }),
  });
  return atualizado;
}

async function consultarStatus(chargeId: string) {
  const cobranca = await asaasFetch(`/payments/${chargeId}`);
  const [atualizado] = await supabaseRest(`/pagamentos_mensais?asaas_charge_id=eq.${chargeId}`, {
    method: "PATCH",
    body: JSON.stringify({ asaas_status: cobranca.status }),
  });
  return atualizado ?? { asaas_status: cobranca.status };
}

const EVENTOS_PAGO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

async function receberWebhook(req: Request) {
  const tokenEsperado = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const tokenRecebido = req.headers.get("asaas-access-token");
  if (!tokenEsperado || tokenRecebido !== tokenEsperado) throw new HttpError("Token de webhook inválido.", 401);

  const corpo = await req.json();
  const evento = corpo?.event as string | undefined;
  const cobranca = corpo?.payment;
  if (!cobranca?.id) return jsonResponse({ ok: true });

  const patch: Record<string, unknown> = { asaas_status: cobranca.status };
  if (evento && EVENTOS_PAGO.has(evento)) {
    patch.status = "pago";
    patch.data_pagamento = cobranca.paymentDate ?? cobranca.clientPaymentDate ?? new Date().toISOString().slice(0, 10);
  }
  await supabaseRest(`/pagamentos_mensais?asaas_charge_id=eq.${cobranca.id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return jsonResponse({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  try {
    if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

    if (url.pathname.endsWith("/webhook")) {
      return await receberWebhook(req);
    }

    await exigirUsuarioAutenticado(req);
    const { action, ...payload } = await req.json();
    if (action === "gerarBoleto") {
      return jsonResponse(await gerarBoleto(payload as DadosGerarBoleto));
    }
    if (action === "consultarStatus") {
      return jsonResponse(await consultarStatus(payload.chargeId));
    }
    return jsonResponse({ error: "Ação inválida." }, 400);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Erro desconhecido." },
      err instanceof HttpError ? err.status : 500
    );
  }
});
