import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui";
import { ModeloContratoForm, type ModeloContratoPayload } from "@/components/ModeloContratoForm";

export function NovoModeloContratoPage() {
  const navigate = useNavigate();

  async function handleSubmit(data: ModeloContratoPayload) {
    const { error } = await supabase.from("modelos_contrato").insert(data);
    if (error) throw new Error(error.message);
    navigate("/modelos-contrato");
  }

  return (
    <div>
      <PageHeader title="Novo modelo de contrato" />
      <ModeloContratoForm onSubmit={handleSubmit} />
    </div>
  );
}
