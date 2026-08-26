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

async function accessToken() {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Integração com Google Drive não configurada. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN.");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body.error_description || "Não foi possível autenticar no Google Drive.");
  return body.access_token as string;
}

async function googleFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await accessToken()}` } });
  if (!response.ok) throw new HttpError(`Erro do Google Drive (${response.status}): ${(await response.text()).slice(0, 300)}`, response.status);
  return response;
}

async function upload(file: File) {
  const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID não configurada.");
  if (file.size > 15 * 1024 * 1024) throw new HttpError("O anexo deve ter no máximo 15 MB.");
  const boundary = `regional_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: file.name, parents: [folderId] });
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
      if (!role || !["admin", "corretor"].includes(role)) throw new HttpError("Sem permissão para enviar contratos de autorização.", 403);
      const file = (await req.formData()).get("file");
      if (!(file instanceof File)) throw new HttpError("Selecione um arquivo.");
      return json(await upload(file));
    }
    const body = await req.json();
    if (!body.fileId) throw new HttpError("Arquivo não informado.");
    if (body.action === "delete") {
      if (!role || !["admin", "corretor"].includes(role)) throw new HttpError("Sem permissão para excluir contratos de autorização.", 403);
      await googleFetch(`/drive/v3/files/${encodeURIComponent(body.fileId)}`, { method: "DELETE" }); return json({ ok: true });
    }
    if (body.action === "download") {
      const response = await googleFetch(`/drive/v3/files/${encodeURIComponent(body.fileId)}?alt=media`);
      return new Response(response.body, { headers: { ...cors, "Content-Type": body.mimeType || response.headers.get("content-type") || "application/octet-stream" } });
    }
    throw new HttpError("Ação inválida.");
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Erro inesperado." }, error instanceof HttpError ? error.status : 500); }
});
