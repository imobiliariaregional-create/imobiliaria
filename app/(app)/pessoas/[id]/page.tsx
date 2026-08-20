import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Button } from "@/components/ui";
import { PessoaForm } from "@/components/pessoa-form";
import type { Pessoa } from "@/lib/types";
import { updatePessoa, deletePessoa } from "../actions";

export default async function EditarPessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("pessoas").select("*").eq("id", id).single<Pessoa>();

  if (!data) notFound();

  const updateWithId = updatePessoa.bind(null, id);
  const deleteWithId = deletePessoa.bind(null, id);

  return (
    <div>
      <PageHeader title={data.nome} />
      <PessoaForm action={updateWithId} defaultValues={data} />
      <form action={deleteWithId} className="max-w-xl mt-4">
        <Button type="submit" variant="danger">Excluir pessoa</Button>
      </form>
    </div>
  );
}
