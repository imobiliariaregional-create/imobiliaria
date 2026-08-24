import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, ErrorState, LoadingState } from "@/components/ui";
import { ImovelForm, type ImovelPayload } from "@/components/ImovelForm";
import type { Proprietario } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function NovoImovelPage() {
  const { papel, perfilLoading } = useAuth();
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

  if (proprietarios === null || perfilLoading) return <LoadingState />;
  if (papel !== "admin" && papel !== "corretor") return <ErrorState message="Seu perfil possui acesso somente de leitura aos imóveis." />;

  return (
    <div>
      <PageHeader title="Novo imóvel" />
      <ImovelForm onSubmit={handleSubmit} proprietarios={proprietarios} />
    </div>
  );
}
