import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, ErrorState, LoadingState } from "@/components/ui";
import { PessoaForm } from "@/components/PessoaForm";
import type { Pessoa } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function NovaPessoaPage() {
  const { papel, perfilLoading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(data: Omit<Pessoa, "id" | "created_at">) {
    const { error } = await supabase.from("pessoas").insert(data);
    if (error) throw new Error(error.message);
    navigate("/pessoas");
  }

  if (perfilLoading) return <LoadingState />;
  if (papel !== "admin" && papel !== "corretor") return <ErrorState message="Seu perfil possui acesso somente de leitura às pessoas." />;

  return (
    <div>
      <PageHeader title="Nova pessoa" />
      <PessoaForm onSubmit={handleSubmit} />
    </div>
  );
}
