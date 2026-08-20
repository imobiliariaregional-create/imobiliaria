import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui";
import { ProprietarioForm } from "@/components/ProprietarioForm";
import type { Proprietario } from "@/lib/types";

export function NovoProprietarioPage() {
  const navigate = useNavigate();

  async function handleSubmit(data: Omit<Proprietario, "id" | "created_at">) {
    const { error } = await supabase.from("proprietarios").insert(data);
    if (error) throw new Error(error.message);
    navigate("/proprietarios");
  }

  return (
    <div>
      <PageHeader title="Novo proprietário" />
      <ProprietarioForm onSubmit={handleSubmit} />
    </div>
  );
}
