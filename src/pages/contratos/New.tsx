import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, EmptyState, LoadingState } from "@/components/ui";
import { ContratoForm, type ContratoPayload } from "@/components/ContratoForm";
import { gerarPagamentosIniciais } from "@/lib/pagamentos";
import type { Imovel, Pessoa } from "@/lib/types";

export function NovoContratoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const imovelIdParam = searchParams.get("imovel_id") ?? undefined;

  const [imoveis, setImoveis] = useState<Imovel[] | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("imoveis").select("*").order("created_at", { ascending: false }).returns<Imovel[]>(),
      supabase.from("pessoas").select("*").order("nome").returns<Pessoa[]>(),
    ]).then(([imoveisRes, pessoasRes]) => {
      setImoveis(imoveisRes.data ?? []);
      setPessoas(pessoasRes.data ?? []);
    });
  }, []);

  async function handleSubmit(data: ContratoPayload) {
    const { data: contrato, error } = await supabase.from("contratos").insert(data).select("*").single();
    if (error) throw new Error(error.message);

    const pagamentos = gerarPagamentosIniciais(contrato);
    if (pagamentos.length > 0) {
      const { error: pagError } = await supabase.from("pagamentos_mensais").insert(pagamentos);
      if (pagError) throw new Error(pagError.message);
    }

    navigate(`/contratos/${contrato.id}`);
  }

  if (imoveis === null) return <LoadingState />;

  if (imoveis.length === 0) {
    return (
      <div>
        <PageHeader title="Novo contrato" />
        <EmptyState message="Cadastre um imóvel antes de criar um contrato." />
      </div>
    );
  }

  const imovelFixo = imovelIdParam ? imoveis.find((i) => i.id === imovelIdParam) : undefined;

  return (
    <div>
      <PageHeader title="Novo contrato" />
      <ContratoForm
        onSubmit={handleSubmit}
        mode="create"
        imoveis={imoveis}
        pessoas={pessoas}
        imovelFixo={imovelFixo}
      />
    </div>
  );
}
