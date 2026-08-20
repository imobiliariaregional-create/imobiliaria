"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarLaudo(contratoId: string, formData: FormData) {
  const supabase = await createClient();
  const tipo = String(formData.get("tipo"));
  const data = String(formData.get("data"));
  const observacoes = (formData.get("observacoes") as string) || null;
  const arquivo = formData.get("arquivo") as File | null;

  let arquivo_url: string | null = null;

  if (arquivo && arquivo.size > 0) {
    const nomeArquivo = `${contratoId}/${Date.now()}-${arquivo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("laudos-vistoria")
      .upload(nomeArquivo, arquivo, { contentType: arquivo.type });
    if (uploadError) throw new Error(uploadError.message);
    arquivo_url = nomeArquivo;
  }

  const { error } = await supabase.from("laudos_vistoria").insert({
    contrato_id: contratoId,
    tipo,
    data,
    observacoes,
    arquivo_url,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/contratos/${contratoId}`);
}

export async function excluirLaudo(id: string, contratoId: string, arquivoUrl: string | null) {
  const supabase = await createClient();
  if (arquivoUrl) {
    await supabase.storage.from("laudos-vistoria").remove([arquivoUrl]);
  }
  const { error } = await supabase.from("laudos_vistoria").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/contratos/${contratoId}`);
}

export async function urlAssinadaLaudo(arquivoUrl: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("laudos-vistoria")
    .createSignedUrl(arquivoUrl, 60 * 5);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
