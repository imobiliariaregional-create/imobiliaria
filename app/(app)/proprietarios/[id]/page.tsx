import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Button } from "@/components/ui";
import { ProprietarioForm } from "@/components/proprietario-form";
import type { Proprietario } from "@/lib/types";
import { updateProprietario, deleteProprietario } from "../actions";

export default async function EditarProprietarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("proprietarios")
    .select("*")
    .eq("id", id)
    .single<Proprietario>();

  if (!data) notFound();

  const updateWithId = updateProprietario.bind(null, id);
  const deleteWithId = deleteProprietario.bind(null, id);

  return (
    <div>
      <PageHeader title={data.nome} />
      <ProprietarioForm action={updateWithId} defaultValues={data} />
      <form action={deleteWithId} className="max-w-xl mt-4">
        <Button type="submit" variant="danger">Excluir proprietário</Button>
      </form>
    </div>
  );
}
