"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

export async function marcarPagamentoPago(id: string, contratoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos_mensais")
    .update({ status: "pago", data_pagamento: todayISO() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pagamentos");
  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/dashboard");
}

export async function marcarPagamentoPendente(id: string, contratoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos_mensais")
    .update({ status: "pendente", data_pagamento: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pagamentos");
  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/dashboard");
}
