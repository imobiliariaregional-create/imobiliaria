"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fromForm(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? ""),
    cpf_cnpj: (formData.get("cpf_cnpj") as string) || null,
    telefone: (formData.get("telefone") as string) || null,
    email: (formData.get("email") as string) || null,
    chave_pix: (formData.get("chave_pix") as string) || null,
    observacoes: (formData.get("observacoes") as string) || null,
  };
}

export async function createProprietario(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("proprietarios").insert(fromForm(formData));
  if (error) throw new Error(error.message);
  revalidatePath("/proprietarios");
  redirect("/proprietarios");
}

export async function updateProprietario(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("proprietarios").update(fromForm(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/proprietarios");
  redirect("/proprietarios");
}

export async function deleteProprietario(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proprietarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/proprietarios");
  redirect("/proprietarios");
}
