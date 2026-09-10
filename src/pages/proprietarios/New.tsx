import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, ErrorState, LoadingState } from "@/components/ui";
import { ProprietarioForm, type ProprietarioPayload } from "@/components/ProprietarioForm";
import { useAuth } from "@/lib/auth";

export function NovoProprietarioPage() {
  const { papel, perfilLoading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(data: ProprietarioPayload) {
    const { error } = await supabase.from("proprietarios").insert(data);
    if (error) throw new Error(error.message);
    navigate("/proprietarios");
  }

  if (perfilLoading) return <LoadingState />;
  if (papel !== "admin" && papel !== "corretor") return <ErrorState message="Seu perfil possui acesso somente de leitura aos proprietários." />;

  return (
    <div>
      <PageHeader title="Novo proprietário" />
      <ProprietarioForm onSubmit={handleSubmit} />
    </div>
  );
}
