import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Button, Card, LoadingState } from "@/components/ui";
import { ProprietarioForm } from "@/components/ProprietarioForm";
import type { Proprietario } from "@/lib/types";
import { confirmDeletion } from "@/lib/actions";
import { useAuth } from "@/lib/auth";

export function EditarProprietarioPage() {
  const { papel } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Proprietario | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from("proprietarios")
      .select("*")
      .eq("id", id)
      .single<Proprietario>()
      .then(({ data }) => setData(data));
  }, [id]);

  async function handleSubmit(payload: Omit<Proprietario, "id" | "created_at">) {
    const { error } = await supabase.from("proprietarios").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    navigate("/proprietarios");
  }

  async function handleDelete() {
    if (!confirmDeletion("Excluir este proprietário?")) return;
    const { error } = await supabase.from("proprietarios").delete().eq("id", id);
    if (error) throw new Error(error.message);
    navigate("/proprietarios");
  }

  if (data === undefined) return <LoadingState />;
  if (data === null) return <p className="text-sm text-slate-500">Proprietário não encontrado.</p>;

  return (
    <div>
      <PageHeader title={data.nome} />
      {(papel === "admin" || papel === "corretor") ? (
        <ProprietarioForm onSubmit={handleSubmit} defaultValues={data} />
      ) : (
        <Card className="max-w-xl p-4 text-sm text-slate-600">Seu perfil possui acesso somente de leitura.</Card>
      )}
      <div className="max-w-xl mt-4">
        {papel === "admin" && <Button type="button" variant="danger" onClick={handleDelete}>Excluir proprietário</Button>}
      </div>
    </div>
  );
}
