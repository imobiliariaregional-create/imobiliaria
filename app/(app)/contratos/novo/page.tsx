import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { ContratoForm } from "@/components/contrato-form";
import type { Imovel, Pessoa } from "@/lib/types";
import { createContrato } from "../actions";

export default async function NovoContratoPage({
  searchParams,
}: {
  searchParams: Promise<{ imovel_id?: string }>;
}) {
  const { imovel_id } = await searchParams;
  const supabase = await createClient();
  const [{ data: imoveis }, { data: pessoas }] = await Promise.all([
    supabase.from("imoveis").select("*").order("created_at", { ascending: false }).returns<Imovel[]>(),
    supabase.from("pessoas").select("*").order("nome").returns<Pessoa[]>(),
  ]);

  if (!imoveis || imoveis.length === 0) {
    return (
      <div>
        <PageHeader title="Novo contrato" />
        <EmptyState message="Cadastre um imóvel antes de criar um contrato." />
      </div>
    );
  }

  const imovelFixo = imovel_id ? imoveis.find((i) => i.id === imovel_id) : undefined;

  return (
    <div>
      <PageHeader title="Novo contrato" />
      <ContratoForm
        action={createContrato}
        mode="create"
        imoveis={imoveis}
        pessoas={pessoas ?? []}
        imovelFixo={imovelFixo}
      />
    </div>
  );
}
