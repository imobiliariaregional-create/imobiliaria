import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ImovelForm } from "@/components/imovel-form";
import type { Proprietario } from "@/lib/types";
import { createImovel } from "../actions";

export default async function NovoImovelPage() {
  const supabase = await createClient();
  const { data: proprietarios } = await supabase
    .from("proprietarios")
    .select("*")
    .order("nome")
    .returns<Proprietario[]>();

  return (
    <div>
      <PageHeader title="Novo imóvel" />
      <ImovelForm action={createImovel} proprietarios={proprietarios ?? []} />
    </div>
  );
}
