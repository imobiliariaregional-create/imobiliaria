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
  };
}

export async function createPessoa(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("pessoas").insert(fromForm(formData));
  if (error) throw new Error(error.message);
  revalidatePath("/pessoas");
  redirect("/pessoas");
}

export async function updatePessoa(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("pessoas").update(fromForm(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pessoas");
  redirect("/pessoas");
}

export async function deletePessoa(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pessoas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pessoas");
  redirect("/pessoas");
}
