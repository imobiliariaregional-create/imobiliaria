import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, EmptyState, LoadingState } from "@/components/ui";
import { ContratoForm, type ContratoPayload } from "@/components/ContratoForm";
import { mapaContratosAtivosPorImovel } from "@/lib/imovelLabel";
import type { Contrato, Imovel, Pessoa } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function NovoContratoPage() {
  const { papel, perfilLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const imovelIdParam = searchParams.get("imovel_id") ?? undefined;

  const [imoveis, setImoveis] = useState<Imovel[] | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [contratosAtivos, setContratosAtivos] = useState<Map<string, Contrato>>(new Map());

  useEffect(() => {
    Promise.all([
      supabase.from("imoveis").select("*").order("created_at", { ascending: false }).returns<Imovel[]>(),
      supabase.from("pessoas").select("*").order("nome").returns<Pessoa[]>(),
    ]).then(async ([imoveisRes, pessoasRes]) => {
      const imoveis = imoveisRes.data ?? [];
      setImoveis(imoveis);
      setPessoas(pessoasRes.data ?? []);
      setContratosAtivos(await mapaContratosAtivosPorImovel(imoveis.map((i) => i.id)));
    });
  }, []);

  async function handleSubmit(data: ContratoPayload) {
    const { data: contrato, error } = await supabase.rpc("criar_contrato_com_pagamentos", { p_payload: data });
    if (error) throw new Error(error.message);
    navigate(`/contratos/${(contrato as unknown as Contrato).id}`);
  }

  if (imoveis === null || perfilLoading) return <LoadingState />;

  if (papel !== "admin" && papel !== "corretor") {
    return <EmptyState message="Seu perfil possui acesso somente de leitura aos contratos." />;
  }

  const imoveisDisponiveis = imoveis.filter((imovel) => imovel.status === "disponivel" && !contratosAtivos.has(imovel.id));

  if (imoveisDisponiveis.length === 0) {
    return (
      <div>
        <PageHeader title="Novo contrato" />
        <EmptyState message="Não há imóveis disponíveis sem contrato ativo." />
      </div>
    );
  }

  const imovelFixo = imovelIdParam ? imoveisDisponiveis.find((i) => i.id === imovelIdParam) : undefined;

  return (
    <div>
      <PageHeader title="Novo contrato" />
      <ContratoForm
        onSubmit={handleSubmit}
        mode="create"
        imoveis={imoveisDisponiveis}
        pessoas={pessoas}
        imovelFixo={imovelFixo}
        contratosAtivosPorImovel={contratosAtivos}
      />
    </div>
  );
}
