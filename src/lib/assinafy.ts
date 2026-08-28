import { supabase } from "@/lib/supabase";

interface EnviarResultado {
  documentId: string;
  assignmentId: string;
  status: string;
}

interface StatusResultado {
  status: string;
  isClosed: boolean;
  resumo: { signer_count: number; completed_count: number } | null;
  artifacts: Record<string, string>;
}

async function invocar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("assinafy", { body });
  if (error) {
    const resposta = "context" in error ? (error as { context?: Response }).context : undefined;
    if (resposta) {
      let corpo: { error?: string } | null = null;
      try {
        corpo = await resposta.clone().json();
      } catch {
        // corpo não era JSON; segue com a mensagem genérica
      }
      if (corpo?.error) throw new Error(corpo.error);
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** Converte um Blob (ex: PDF baixado do Drive) em base64, para enviar ao Assinafy. */
export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function enviarParaAssinatura(
  pdfBase64: string,
  fileName: string,
  signatarios: { nome: string; email: string }[]
): Promise<EnviarResultado> {
  return invocar<EnviarResultado>({ action: "enviar", pdfBase64, fileName, signatarios });
}

export function consultarStatusAssinatura(documentId: string): Promise<StatusResultado> {
  return invocar<StatusResultado>({ action: "status", documentId });
}

export async function obterDocumentoAssinado(documentId: string, artifactName: string): Promise<Blob> {
  const { base64 } = await invocar<{ base64: string }>({ action: "baixar", documentId, artifactName });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

export async function baixarDocumentoAssinado(documentId: string, artifactName: string, fileName: string): Promise<void> {
  const blob = await obterDocumentoAssinado(documentId, artifactName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Rótulos amigáveis para os status de documento do Assinafy. */
export const STATUS_LABEL: Record<string, string> = {
  uploaded: "Enviado",
  metadata_processing: "Processando",
  metadata_ready: "Pronto",
  pending_signature: "Aguardando assinatura",
  certificated: "Assinado",
  declined: "Recusado",
  expired: "Expirado",
};
