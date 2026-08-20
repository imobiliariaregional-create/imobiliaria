"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createNotaFiscal(formData: FormData) {
  const supabase = await createClient();
  const numero = (formData.get("numero") as string) || null;
  const valor = Number(formData.get("valor"));
  const data_emissao = String(formData.get("data_emissao"));
  const descricao = (formData.get("descricao") as string) || null;
  const contrato_id = (formData.get("contrato_id") as string) || null;
  const arquivo = formData.get("arquivo") as File | null;

  let arquivo_url: string | null = null;

  if (arquivo && arquivo.size > 0) {
    const nomeArquivo = `${Date.now()}-${arquivo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("notas-fiscais")
      .upload(nomeArquivo, arquivo, { contentType: arquivo.type });
    if (uploadError) throw new Error(uploadError.message);
    arquivo_url = nomeArquivo;
  }

  const { error } = await supabase.from("notas_fiscais").insert({
    numero,
    valor,
    data_emissao,
    descricao,
    contrato_id,
    arquivo_url,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/notas-fiscais");
  if (contrato_id) revalidatePath(`/contratos/${contrato_id}`);
  redirect("/notas-fiscais");
}

export async function deleteNotaFiscal(id: string, arquivoUrl: string | null, contratoId: string | null) {
  const supabase = await createClient();
  if (arquivoUrl) {
    await supabase.storage.from("notas-fiscais").remove([arquivoUrl]);
  }
  const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/notas-fiscais");
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
  redirect("/notas-fiscais");
}

export async function urlAssinadaNota(arquivoUrl: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("notas-fiscais").createSignedUrl(arquivoUrl, 60 * 5);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
