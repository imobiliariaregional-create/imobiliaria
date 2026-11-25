import { supabase } from "@/lib/supabase";

/**
 * Arquivos dos documentos (autorizações, contratos, aditivos, laudos, notas, papel timbrado).
 *
 * Os arquivos novos ficam no Storage do próprio Supabase, bucket "documentos". O id
 * gravado no banco (colunas drive_file_id) começa com "sb:" seguido do caminho no bucket.
 * Ids sem esse prefixo são de arquivos antigos, enviados ao Google Drive antes da troca:
 * continuam no Drive e o sistema ainda tenta baixá-los pela função antiga.
 */
const BUCKET = "documentos";
const PREFIXO = "sb:";

export type DriveCategory = "autorizacao" | "contrato_locacao" | "contrato_venda" | "aditivo" | "laudo" | "nota_fiscal" | "papel_timbrado";

export interface DriveUploadOptions {
  category: DriveCategory;
  folders?: Array<string | null | undefined>;
  fileName?: string;
}

/** Nome seguro para caminho do Storage: sem acentos, só letras, números, ponto, hífen e sublinhado. */
export function nomeSeguro(value: string, fallback = "ARQUIVO") {
  const limpo = value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+|[._]+$/g, "");
  return (limpo || fallback).slice(0, 100);
}

export function ehArquivoAntigoDoDrive(fileId: string) {
  return !fileId.startsWith(PREFIXO);
}

export async function uploadDriveFile(file: File, options: DriveUploadOptions) {
  const nome = options.fileName || file.name || "ARQUIVO";
  const extensao = /\.[a-z0-9]{1,5}$/i.exec(file.name)?.[0] ?? "";
  const base = nomeSeguro(nome.replace(/\.[a-z0-9]{1,5}$/i, ""));
  const pastas = (options.folders ?? []).filter((p): p is string => Boolean(p)).map((p) => nomeSeguro(p));
  const caminho = [options.category, ...pastas, `${crypto.randomUUID().slice(0, 8)}-${base}${extensao.toLowerCase()}`].join("/");
  const mimeType = file.type || "application/octet-stream";
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, file, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Não foi possível salvar o arquivo: ${error.message}`);
  return { id: PREFIXO + caminho, name: nome.endsWith(extensao) ? nome : nome + extensao, mimeType, size: String(file.size) };
}

export async function getDriveFileBlob(fileId: string, mimeType?: string | null) {
  if (!ehArquivoAntigoDoDrive(fileId)) {
    const { data, error } = await supabase.storage.from(BUCKET).download(fileId.slice(PREFIXO.length));
    if (error || !data) throw new Error(`Não foi possível baixar o arquivo: ${error?.message ?? "arquivo não encontrado"}`);
    return data;
  }
  return baixarDoDriveAntigo(fileId, mimeType);
}

export async function downloadDriveFile(fileId: string, fileName: string, mimeType?: string | null) {
  const url = URL.createObjectURL(await getDriveFileBlob(fileId, mimeType));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}

/**
 * Apaga o arquivo. Arquivos antigos do Google Drive não são apagados (a integração
 * pode estar desligada); ficam no Drive e podem ser removidos lá, se quiser.
 */
export async function deleteDriveFile(fileId: string, _category?: DriveCategory) {
  if (ehArquivoAntigoDoDrive(fileId)) return;
  const { error } = await supabase.storage.from(BUCKET).remove([fileId.slice(PREFIXO.length)]);
  if (error) throw new Error(`Não foi possível apagar o arquivo: ${error.message}`);
}

async function baixarDoDriveAntigo(fileId: string, mimeType?: string | null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "download", fileId, mimeType }),
  }).catch(() => null);
  if (!response?.ok) {
    throw new Error("Este arquivo foi salvo no Google Drive antes da mudança e não pode ser baixado pelo sistema. Abra-o direto na pasta do Google Drive.");
  }
  return response.blob();
}
