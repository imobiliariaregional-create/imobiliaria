import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, LoadingState } from "@/components/ui";
import { ImovelForm, type ImovelPayload } from "@/components/ImovelForm";
import type { Proprietario } from "@/lib/types";

export function NovoImovelPage() {
  const navigate = useNavigate();
  const [proprietarios, setProprietarios] = useState<Proprietario[] | null>(null);

  useEffect(() => {
    supabase
      .from("proprietarios")
      .select("*")
      .order("nome")
      .returns<Proprietario[]>()
      .then(({ data }) => setProprietarios(data ?? []));
  }, []);

  async function handleSubmit(data: ImovelPayload) {
    const { error } = await supabase.from("imoveis").insert(data);
    if (error) throw new Error(error.message);
    navigate("/imoveis");
  }

  if (proprietarios === null) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Novo imóvel" />
      <ImovelForm onSubmit={handleSubmit} proprietarios={proprietarios} />
    </div>
  );
}
