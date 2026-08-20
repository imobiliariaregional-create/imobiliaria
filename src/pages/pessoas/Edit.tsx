import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Button, LoadingState } from "@/components/ui";
import { PessoaForm } from "@/components/PessoaForm";
import type { Pessoa } from "@/lib/types";

export function EditarPessoaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Pessoa | null | undefined>(undefined);

  useEffect(() => {
    supabase.from("pessoas").select("*").eq("id", id).single<Pessoa>().then(({ data }) => setData(data));
  }, [id]);

  async function handleSubmit(payload: Omit<Pessoa, "id" | "created_at">) {
    const { error } = await supabase.from("pessoas").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    navigate("/pessoas");
  }

  async function handleDelete() {
    const { error } = await supabase.from("pessoas").delete().eq("id", id);
    if (error) throw new Error(error.message);
    navigate("/pessoas");
  }

  if (data === undefined) return <LoadingState />;
  if (data === null) return <p className="text-sm text-slate-500">Pessoa não encontrada.</p>;

  return (
    <div>
      <PageHeader title={data.nome} />
      <PessoaForm onSubmit={handleSubmit} defaultValues={data} />
      <div className="max-w-xl mt-4">
        <Button type="button" variant="danger" onClick={handleDelete}>Excluir pessoa</Button>
      </div>
    </div>
  );
}
