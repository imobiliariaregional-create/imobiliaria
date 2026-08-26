import { supabase } from "@/lib/supabase";
import { deleteDriveFile, getDriveFileBlob, uploadDriveFile } from "@/lib/googleDrive";
import type { ConfiguracaoDocumentos } from "@/lib/types";

const BUCKET = "papel-timbrado";
const PATH = "timbrado.png";

/** URL pública da imagem de papel timbrado, ou null se nenhuma foi enviada ainda. */
export async function getLetterheadUrl(): Promise<string | null> {
  const config = await getConfig();
  if (config?.papel_timbrado_drive_file_id) {
    return URL.createObjectURL(await getDriveFileBlob(config.papel_timbrado_drive_file_id, config.papel_timbrado_drive_mime_type));
  }
  // Compatibilidade temporária com o papel timbrado enviado antes da migração para o Drive.
  const { data } = await supabase.storage.from(BUCKET).list("", { search: PATH });
  if (!data || data.length === 0) return null;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(PATH);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

export async function uploadLetterhead(file: File): Promise<void> {
  const previous = await getConfig();
  const uploaded = await uploadDriveFile(file, { category: "papel_timbrado", fileName: "PAPEL TIMBRADO" });
  const { error } = await supabase.from("configuracoes_documentos").update({
    papel_timbrado_drive_file_id: uploaded.id,
    papel_timbrado_drive_file_name: uploaded.name,
    papel_timbrado_drive_mime_type: uploaded.mimeType,
    papel_timbrado_drive_file_size: Number(uploaded.size),
    updated_at: new Date().toISOString(),
  }).eq("id", true);
  if (error) { await deleteDriveFile(uploaded.id, "papel_timbrado"); throw new Error(error.message); }
  if (previous?.papel_timbrado_drive_file_id) await deleteDriveFile(previous.papel_timbrado_drive_file_id, "papel_timbrado");
}

export async function removeLetterhead(): Promise<void> {
  const config = await getConfig();
  if (config?.papel_timbrado_drive_file_id) await deleteDriveFile(config.papel_timbrado_drive_file_id, "papel_timbrado");
  const { error } = await supabase.from("configuracoes_documentos").update({
    papel_timbrado_drive_file_id: null, papel_timbrado_drive_file_name: null,
    papel_timbrado_drive_mime_type: null, papel_timbrado_drive_file_size: null,
    updated_at: new Date().toISOString(),
  }).eq("id", true);
  if (error) throw new Error(error.message);
}

/** Baixa a imagem e converte para data URL (necessário para embutir no PDF/Word gerado no navegador). */
export async function fetchLetterheadDataUrl(): Promise<string | null> {
  const config = await getConfig();
  let blob: Blob;
  if (config?.papel_timbrado_drive_file_id) blob = await getDriveFileBlob(config.papel_timbrado_drive_file_id, config.papel_timbrado_drive_mime_type);
  else {
    const url = await getLetterheadUrl();
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    blob = await res.blob();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getConfig(): Promise<ConfiguracaoDocumentos | null> {
  const { data, error } = await supabase.from("configuracoes_documentos").select("*").eq("id", true).maybeSingle<ConfiguracaoDocumentos>();
  if (error && !["42P01", "PGRST205"].includes(error.code)) throw new Error(error.message);
  return data ?? null;
}
