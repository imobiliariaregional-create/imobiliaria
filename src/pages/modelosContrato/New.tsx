import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, ErrorState, LoadingState } from "@/components/ui";
import { ModeloContratoForm, type ModeloContratoPayload } from "@/components/ModeloContratoForm";
import { useAuth } from "@/lib/auth";

export function NovoModeloContratoPage() {
  const { papel, perfilLoading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(data: ModeloContratoPayload) {
    const { error } = await supabase.from("modelos_contrato").insert(data);
    if (error) throw new Error(error.message);
    navigate("/modelos-contrato");
  }

  if (perfilLoading) return <LoadingState />;
  if (papel !== "admin" && papel !== "corretor") return <ErrorState message="Seu perfil possui acesso somente de leitura aos modelos." />;

  return (
    <div>
      <PageHeader title="Novo modelo de contrato" />
      <ModeloContratoForm onSubmit={handleSubmit} />
    </div>
  );
}
