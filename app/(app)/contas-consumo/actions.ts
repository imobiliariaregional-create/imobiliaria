"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

export async function criarContaConsumo(imovelId: string, formData: FormData) {
  const supabase = await createClient();
  const tipo = String(formData.get("tipo"));
  const mesReferencia = String(formData.get("mes_referencia")) + "-01";

  const { error } = await supabase.from("contas_consumo").insert({
    imovel_id: imovelId,
    tipo,
    mes_referencia: mesReferencia,
    status_pagamento: "pendente",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/imoveis/${imovelId}`);
  revalidatePath("/contas-consumo");
}

export async function marcarContaPaga(id: string, imovelId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contas_consumo")
    .update({ status_pagamento: "pago", data_pagamento: todayISO() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/imoveis/${imovelId}`);
  revalidatePath("/contas-consumo");
}

export async function marcarContaPendente(id: string, imovelId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contas_consumo")
    .update({ status_pagamento: "pendente", data_pagamento: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/imoveis/${imovelId}`);
  revalidatePath("/contas-consumo");
}

export async function excluirContaConsumo(id: string, imovelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contas_consumo").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/imoveis/${imovelId}`);
  revalidatePath("/contas-consumo");
}
