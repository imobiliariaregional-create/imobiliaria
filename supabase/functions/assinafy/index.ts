// Edge Function: proxy seguro para a API do Assinafy.
// A chave de API (ASSINAFY_API_KEY) fica só aqui no servidor, nunca no navegador.
// Deploy: cole este arquivo em Supabase Dashboard -> Edge Functions -> New function -> "assinafy".
// Depois configure o secret em Edge Functions -> assinafy -> Secrets: ASSINAFY_API_KEY = <sua chave>.

const ASSINAFY_BASE = "https://api.assinafy.com.br/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function assinafyFetch(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get("ASSINAFY_API_KEY");
  if (!apiKey) throw new Error("ASSINAFY_API_KEY não configurada nos secrets da function.");
  const res = await fetch(`${ASSINAFY_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), "X-Api-Key": apiKey },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || `Erro Assinafy (${res.status})`);
  }
  return body.data;
}

let cachedAccountId: string | null = null;
async function getAccountId(): Promise<string> {
  if (cachedAccountId) return cachedAccountId;
  const accounts = await assinafyFetch("/accounts");
  if (!accounts?.length) throw new Error("Nenhuma conta Assinafy encontrada para essa API key.");
  cachedAccountId = accounts[0].id;
  return cachedAccountId;
}

/** Reaproveita o signatário se já existir com esse e-mail (Assinafy não permite e-mail duplicado). */
async function obterOuCriarSigner(accountId: string, fullName: string, email: string) {
  const existentes = await assinafyFetch(`/accounts/${accountId}/signers?search=${encodeURIComponent(email)}`);
  const existente = (existentes ?? []).find((s: { email?: string }) => s.email?.toLowerCase() === email.toLowerCase());
  if (existente) return existente;

  return assinafyFetch(`/accounts/${accountId}/signers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName, email }),
  });
}

async function enviarParaAssinatura(payload: {
  pdfBase64: string;
  fileName: string;
  signatarios: { nome: string; email: string }[];
}) {
  if (!payload.signatarios?.length) throw new Error("Informe ao menos um signatário.");
  const accountId = await getAccountId();

  const signerIds: string[] = [];
  for (const s of payload.signatarios) {
    const signer = await obterOuCriarSigner(accountId, s.nome, s.email);
    signerIds.push(signer.id);
  }

  const binary = atob(payload.pdfBase64);
  const pdfBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) pdfBytes[i] = binary.charCodeAt(i);

  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), payload.fileName);
  const documento = await assinafyFetch(`/accounts/${accountId}/documents`, {
    method: "POST",
    body: form,
  });

  const assignment = await assinafyFetch(`/documents/${documento.id}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "virtual",
      signers: signerIds.map((id) => ({ id, step: 1 })),
    }),
  });

  return { documentId: documento.id as string, assignmentId: assignment.id as string, status: documento.status as string };
}

async function consultarStatus(documentId: string) {
  const doc = await assinafyFetch(`/documents/${documentId}?expand=assignment`);
  return {
    status: doc.status as string,
    isClosed: !!doc.is_closed,
    resumo: doc.assignment?.summary ?? null,
    artifacts: (doc.artifacts ?? {}) as Record<string, string>,
  };
}

async function baixarAssinado(documentId: string, artifactName: string) {
  const apiKey = Deno.env.get("ASSINAFY_API_KEY");
  if (!apiKey) throw new Error("ASSINAFY_API_KEY não configurada nos secrets da function.");
  const res = await fetch(`${ASSINAFY_BASE}/documents/${documentId}/download/${artifactName}`, {
    headers: { "X-Api-Key": apiKey },
  });
  if (!res.ok) throw new Error("Erro ao baixar o documento assinado.");
  const buf = new Uint8Array(await res.arrayBuffer());
  return { base64: toBase64(buf) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, ...payload } = await req.json();
    if (action === "enviar") {
      return jsonResponse(await enviarParaAssinatura(payload as any));
    }
    if (action === "status") {
      return jsonResponse(await consultarStatus(payload.documentId));
    }
    if (action === "baixar") {
      return jsonResponse(await baixarAssinado(payload.documentId, payload.artifactName));
    }
    return jsonResponse({ error: "Ação inválida." }, 400);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erro desconhecido." }, 500);
  }
});
