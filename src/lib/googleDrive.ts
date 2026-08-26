import { supabase } from "@/lib/supabase";

async function request(body: BodyInit, contentType?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
  if (contentType) headers["Content-Type"] = contentType;
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive`, { method: "POST", headers, body });
  if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "Falha na integração com o Google Drive."); }
  return response;
}

export type DriveCategory = "autorizacao" | "contrato_locacao" | "contrato_venda" | "laudo" | "nota_fiscal" | "papel_timbrado";

export interface DriveUploadOptions {
  category: DriveCategory;
  folders?: Array<string | null | undefined>;
  fileName?: string;
}

export async function uploadDriveFile(file: File, options: DriveUploadOptions) {
  const data = new FormData();
  data.append("file", file);
  data.append("category", options.category);
  data.append("folders", JSON.stringify((options.folders ?? []).filter(Boolean)));
  if (options.fileName) data.append("fileName", options.fileName);
  return request(data).then((response) => response.json() as Promise<{ id: string; name: string; mimeType: string; size: string }>);
}
export async function getDriveFileBlob(fileId: string, mimeType?: string | null) {
  const response = await request(JSON.stringify({ action: "download", fileId, mimeType }), "application/json");
  return response.blob();
}
export async function downloadDriveFile(fileId: string, fileName: string, mimeType?: string | null) {
  const url = URL.createObjectURL(await getDriveFileBlob(fileId, mimeType));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}
export async function deleteDriveFile(fileId: string, category: DriveCategory = "autorizacao") { await request(JSON.stringify({ action: "delete", fileId, category }), "application/json"); }
