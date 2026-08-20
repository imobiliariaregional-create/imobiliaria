"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gerarPagamentosIniciais } from "@/lib/pagamentos";
import { addMonthsISO } from "@/lib/format";

function num(formData: FormData, key: string) {
  const v = formData.get(key);
  if (!v || v === "") return null;
  return Number(v);
}

function fromForm(formData: FormData) {
  const tipo = String(formData.get("tipo"));
  return {
    imovel_id: String(formData.get("imovel_id")),
    pessoa_id: (formData.get("pessoa_id") as string) || null,
    tipo,
    valor_aluguel: tipo !== "venda" ? num(formData, "valor_aluguel") : null,
    dia_pagamento: tipo !== "venda" ? num(formData, "dia_pagamento") : null,
    data_inicio: String(formData.get("data_inicio")),
    vigencia_final: (formData.get("vigencia_final") as string) || null,
    forma_comissao_venda: tipo === "venda" ? (String(formData.get("forma_comissao_venda")) as any) : null,
    percentual_comissao: tipo === "venda" ? num(formData, "percentual_comissao") : null,
    valor_comissao_fixo: tipo === "venda" ? num(formData, "valor_comissao_fixo") : null,
    valor_venda: tipo === "venda" ? num(formData, "valor_venda") : null,
    observacoes: (formData.get("observacoes") as string) || null,
  };
}

export async function createContrato(formData: FormData) {
  const supabase = await createClient();
  const payload = fromForm(formData);

  const { data: contrato, error } = await supabase.from("contratos").insert(payload).select("*").single();
  if (error) throw new Error(error.message);

  const pagamentos = gerarPagamentosIniciais(contrato);
  if (pagamentos.length > 0) {
    const { error: pagError } = await supabase.from("pagamentos_mensais").insert(pagamentos);
    if (pagError) throw new Error(pagError.message);
  }

  revalidatePath("/contratos");
  revalidatePath("/pagamentos");
  revalidatePath(`/imoveis/${payload.imovel_id}`);
  redirect(`/contratos/${contrato.id}`);
}

export async function updateContrato(id: string, formData: FormData) {
  const supabase = await createClient();
  const payload = fromForm(formData);
  const status = String(formData.get("status") ?? "ativo");

  const { error } = await supabase.from("contratos").update({ ...payload, status }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/contratos");
  revalidatePath(`/contratos/${id}`);
  redirect(`/contratos/${id}`);
}

export async function deleteContrato(id: string, imovelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contratos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contratos");
  revalidatePath(`/imoveis/${imovelId}`);
  redirect(`/imoveis/${imovelId}`);
}

/** Gera o próximo pagamento mensal de um contrato de administração (uso manual, ex.: após renovação). */
export async function gerarProximoPagamento(contratoId: string) {
  const supabase = await createClient();
  const { data: contrato } = await supabase.from("contratos").select("*").eq("id", contratoId).single();
  if (!contrato) throw new Error("Contrato não encontrado.");

  const { data: ultimo } = await supabase
    .from("pagamentos_mensais")
    .select("mes_referencia")
    .eq("contrato_id", contratoId)
    .order("mes_referencia", { ascending: false })
    .limit(1)
    .single();

  const proximoMes = ultimo ? addMonthsISO(ultimo.mes_referencia, 1) : contrato.data_inicio.slice(0, 7) + "-01";
  const valorMensal = Number(contrato.valor_aluguel ?? 0) * 0.1;

  const [year, month] = proximoMes.split("-").map(Number);
  const dia = contrato.dia_pagamento ?? 5;
  const ultimoDiaDoMes = new Date(year, month, 0).getDate();
  const dataVencimento = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(dia, ultimoDiaDoMes)).padStart(2, "0")}`;

  const { error } = await supabase.from("pagamentos_mensais").insert({
    contrato_id: contratoId,
    mes_referencia: proximoMes,
    valor: valorMensal,
    data_vencimento: dataVencimento,
    status: "pendente",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/pagamentos");
}
