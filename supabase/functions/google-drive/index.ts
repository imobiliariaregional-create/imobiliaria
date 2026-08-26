import "@supabase/functions-js/edge-runtime.d.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
class HttpError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }

async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError("Sessão obrigatória.", 401);
  if (!url || !anon) throw new Error("Ambiente Supabase incompleto.");
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: authorization, apikey: anon } });
  if (!userResponse.ok) throw new HttpError("Sessão inválida ou expirada.", 401);
  const user = await userResponse.json();
  const profileResponse = await fetch(`${url}/rest/v1/perfis?user_id=eq.${user.id}&select=papel`, { headers: { Authorization: authorization, apikey: anon, Accept: "application/json" } });
  const profiles = profileResponse.ok ? await profileResponse.json() : [];
  return profiles[0]?.papel as string | undefined;
}

let cachedToken: { value: string; expiresAt: number } | null = null;
async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Integração com Google Drive não configurada. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN.");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body.error_description || "Não foi possível autenticar no Google Drive.");
  cachedToken = { value: body.access_token as string, expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function googleFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await accessToken()}` } });
  if (!response.ok) throw new HttpError(`Erro do Google Drive (${response.status}): ${(await response.text()).slice(0, 300)}`, response.status);
  return response;
}

const categoryFolders: Record<string, string[]> = {
  autorizacao: ["01 - AUTORIZACOES DE ADMINISTRACAO"],
  contrato_locacao: ["02 - CONTRATOS DE LOCACAO"],
  contrato_venda: ["03 - CONTRATOS DE VENDA"],
  laudo: ["04 - LAUDOS DE VISTORIA"],
  nota_fiscal: ["05 - NOTAS FISCAIS"],
  papel_timbrado: ["06 - PAPEL TIMBRADO"],
};

function cleanName(value: string, fallback = "SEM IDENTIFICACAO") {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\\/?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim().replace(/^\.+|\.+$/g, "");
  return (cleaned || fallback).slice(0, 120);
}
function allowed(role: string | undefined, category: string) {
  if (role === "admin") return true;
  if (category === "nota_fiscal") return role === "financeiro";
  return role === "corretor" && category !== "papel_timbrado";
}
function escapeQuery(value: string) { return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
async function ensureFolder(parentId: string, rawName: string) {
  const name = cleanName(rawName);
  const q = encodeURIComponent(`name = '${escapeQuery(name)}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const found = await (await googleFetch(`/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`)).json();
  if (found.files?.[0]?.id) return found.files[0].id as string;
  const created = await (await googleFetch("/drive/v3/files?fields=id,name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }) })).json();
  return created.id as string;
}
async function targetFolder(category: string, folders: string[]) {
  let parentId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
  if (!parentId) throw new Error("GOOGLE_DRIVE_FOLDER_ID não configurada.");
  const parts = [...(categoryFolders[category] ?? []), ...folders].slice(0, 8);
  for (const part of parts) parentId = await ensureFolder(parentId, part);
  return parentId;
}

async function upload(file: File, category: string, folders: string[], requestedName?: string) {
  const folderId = await targetFolder(category, folders);
  if (file.size > 15 * 1024 * 1024) throw new HttpError("O anexo deve ter no máximo 15 MB.");
  const boundary = `regional_${crypto.randomUUID()}`;
  const originalExtension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  const requestedHasExtension = requestedName?.includes(".");
  const metadata = JSON.stringify({ name: cleanName(requestedName ? `${requestedName}${requestedHasExtension ? "" : originalExtension}` : file.name, "ARQUIVO"), parents: [folderId] });
  const prefix = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`);
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--`);
  const bytes = new Uint8Array(prefix.length + file.size + suffix.length);
  bytes.set(prefix); bytes.set(new Uint8Array(await file.arrayBuffer()), prefix.length); bytes.set(suffix, prefix.length + file.size);
  const response = await googleFetch("/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: bytes });
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const role = await requireUser(req);
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const category = String(form.get("category") || "");
      if (!categoryFolders[category]) throw new HttpError("Categoria de documento inválida.");
      if (!allowed(role, category)) throw new HttpError("Sem permissão para enviar este tipo de documento.", 403);
      if (!(file instanceof File)) throw new HttpError("Selecione um arquivo.");
      let folders: string[] = [];
      try { folders = JSON.parse(String(form.get("folders") || "[]")); } catch { throw new HttpError("Organização de pastas inválida."); }
      if (!Array.isArray(folders) || folders.some((item) => typeof item !== "string")) throw new HttpError("Organização de pastas inválida.");
      return json(await upload(file, category, folders, String(form.get("fileName") || "") || undefined));
    }
    const body = await req.json();
    if (!body.fileId) throw new HttpError("Arquivo não informado.");
    if (body.action === "delete") {
      if (!allowed(role, String(body.category || "autorizacao"))) throw new HttpError("Sem permissão para excluir este documento.", 403);
      await googleFetch(`/drive/v3/files/${encodeURIComponent(body.fileId)}`, { method: "DELETE" }); return json({ ok: true });
    }
    if (body.action === "download") {
      const response = await googleFetch(`/drive/v3/files/${encodeURIComponent(body.fileId)}?alt=media`);
      return new Response(response.body, { headers: { ...cors, "Content-Type": body.mimeType || response.headers.get("content-type") || "application/octet-stream" } });
    }
    throw new HttpError("Ação inválida.");
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Erro inesperado." }, error instanceof HttpError ? error.status : 500); }
});
