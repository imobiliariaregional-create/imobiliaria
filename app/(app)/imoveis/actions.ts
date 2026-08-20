"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fromForm(formData: FormData) {
  return {
    proprietario_id: (formData.get("proprietario_id") as string) || null,
    rua: String(formData.get("rua") ?? ""),
    numero: (formData.get("numero") as string) || null,
    bairro: (formData.get("bairro") as string) || null,
    cidade: (formData.get("cidade") as string) || null,
    uf: (formData.get("uf") as string) || null,
    cep: (formData.get("cep") as string) || null,
    tipo_operacao: String(formData.get("tipo_operacao") ?? "aluguel"),
    controla_agua: formData.get("controla_agua") === "on",
    controla_energia: formData.get("controla_energia") === "on",
    status: String(formData.get("status") ?? "disponivel"),
    observacoes: (formData.get("observacoes") as string) || null,
  };
}

export async function createImovel(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("imoveis").insert(fromForm(formData));
  if (error) throw new Error(error.message);
  revalidatePath("/imoveis");
  redirect("/imoveis");
}

export async function updateImovel(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("imoveis").update(fromForm(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/imoveis");
  redirect(`/imoveis/${id}`);
}

export async function deleteImovel(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("imoveis").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/imoveis");
  redirect("/imoveis");
}
