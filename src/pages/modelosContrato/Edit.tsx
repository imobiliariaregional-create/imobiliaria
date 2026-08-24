import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Button, Card, LoadingState } from "@/components/ui";
import { ModeloContratoForm, type ModeloContratoPayload } from "@/components/ModeloContratoForm";
import type { ModeloContrato } from "@/lib/types";
import { confirmDeletion } from "@/lib/actions";
import { useAuth } from "@/lib/auth";

export function EditarModeloContratoPage() {
  const { papel } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ModeloContrato | null | undefined>(undefined);

  useEffect(() => {
    supabase.from("modelos_contrato").select("*").eq("id", id).single<ModeloContrato>().then(({ data }) => setData(data));
  }, [id]);

  async function handleSubmit(payload: ModeloContratoPayload) {
    const { error } = await supabase.from("modelos_contrato").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    navigate("/modelos-contrato");
  }

  async function handleDelete() {
    if (!confirmDeletion("Excluir este modelo de contrato?")) return;
    const { error } = await supabase.from("modelos_contrato").delete().eq("id", id);
    if (error) throw new Error(error.message);
    navigate("/modelos-contrato");
  }

  if (data === undefined) return <LoadingState />;
  if (data === null) return <p className="text-sm text-slate-500">Modelo não encontrado.</p>;

  return (
    <div>
      <PageHeader title={data.nome} />
      {(papel === "admin" || papel === "corretor") ? (
        <ModeloContratoForm onSubmit={handleSubmit} defaultValues={data} />
      ) : (
        <Card className="p-4 text-sm text-slate-600">Seu perfil possui acesso somente de leitura.</Card>
      )}
      <div className="mt-4">
        {papel === "admin" && <Button type="button" variant="danger" onClick={handleDelete}>Excluir modelo</Button>}
      </div>
    </div>
  );
}
