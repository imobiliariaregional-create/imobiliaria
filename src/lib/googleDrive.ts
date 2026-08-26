import { supabase } from "@/lib/supabase";

async function request(body: BodyInit, contentType?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
  if (contentType) headers["Content-Type"] = contentType;
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive`, { method: "POST", headers, body });
  if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "Falha na integração com o Google Drive."); }
  return response;
}

export async function uploadDriveFile(file: File) {
  const data = new FormData(); data.append("file", file);
  return request(data).then((response) => response.json() as Promise<{ id: string; name: string; mimeType: string; size: string }>);
}
export async function downloadDriveFile(fileId: string, fileName: string, mimeType?: string | null) {
  const response = await request(JSON.stringify({ action: "download", fileId, mimeType }), "application/json");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}
export async function deleteDriveFile(fileId: string) { await request(JSON.stringify({ action: "delete", fileId }), "application/json"); }
