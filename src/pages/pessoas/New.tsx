import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui";
import { PessoaForm } from "@/components/PessoaForm";
import type { Pessoa } from "@/lib/types";

export function NovaPessoaPage() {
  const navigate = useNavigate();

  async function handleSubmit(data: Omit<Pessoa, "id" | "created_at">) {
    const { error } = await supabase.from("pessoas").insert(data);
    if (error) throw new Error(error.message);
    navigate("/pessoas");
  }

  return (
    <div>
      <PageHeader title="Nova pessoa" />
      <PessoaForm onSubmit={handleSubmit} />
    </div>
  );
}
