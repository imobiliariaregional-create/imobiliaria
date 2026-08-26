import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, EmptyState, LoadingState } from "@/components/ui";
import { ContratoForm, type ContratoPayload } from "@/components/ContratoForm";
import type { ImovelPayload } from "@/components/ImovelForm";
import type { PessoaPayload } from "@/components/PessoaForm";
import type { ProprietarioPayload } from "@/components/ProprietarioForm";
import { mapaContratosAtivosPorImovel } from "@/lib/imovelLabel";
import type { Contrato, Imovel, Pessoa, Proprietario } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function NovoContratoPage() {
  const { papel, perfilLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const imovelIdParam = searchParams.get("imovel_id") ?? undefined;

  const [imoveis, setImoveis] = useState<Imovel[] | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [contratosAtivos, setContratosAtivos] = useState<Map<string, Contrato>>(new Map());

  useEffect(() => {
    Promise.all([
      supabase.from("imoveis").select("*").order("created_at", { ascending: false }).returns<Imovel[]>(),
      supabase.from("pessoas").select("*").order("nome").returns<Pessoa[]>(),
      supabase.from("proprietarios").select("*").order("nome").returns<Proprietario[]>(),
    ]).then(async ([imoveisRes, pessoasRes, proprietariosRes]) => {
      const imoveis = imoveisRes.data ?? [];
      setImoveis(imoveis);
      setPessoas(pessoasRes.data ?? []);
      setProprietarios(proprietariosRes.data ?? []);
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

  async function handleCreateImovel(data: ImovelPayload) {
    if (data.status !== "disponivel") throw new Error("Para usar o imóvel neste contrato, mantenha o status como disponível.");
    const { data: created, error } = await supabase.from("imoveis").insert(data).select("*").single<Imovel>();
    if (error) throw new Error(error.message);
    setImoveis((current) => current ? [created, ...current] : [created]);
    return created;
  }

  async function handleCreatePessoa(data: PessoaPayload) {
    const { data: created, error } = await supabase.from("pessoas").insert(data).select("*").single<Pessoa>();
    if (error) throw new Error(error.message);
    setPessoas((current) => [...current, created].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    return created;
  }

  async function handleCreateProprietario(data: ProprietarioPayload) {
    const { data: created, error } = await supabase.from("proprietarios").insert(data).select("*").single<Proprietario>();
    if (error) throw new Error(error.message);
    setProprietarios((current) => [...current, created].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    return created;
  }

  const imoveisDisponiveis = imoveis.filter((imovel) => imovel.status === "disponivel" && !contratosAtivos.has(imovel.id));

  const imovelFixo = imovelIdParam ? imoveisDisponiveis.find((i) => i.id === imovelIdParam) : undefined;

  return (
    <div>
      <PageHeader title="Novo contrato" />
      <ContratoForm
        onSubmit={handleSubmit}
        mode="create"
        imoveis={imoveisDisponiveis}
        pessoas={pessoas}
        proprietarios={proprietarios}
        imovelFixo={imovelFixo}
        contratosAtivosPorImovel={contratosAtivos}
        onCreateImovel={handleCreateImovel}
        onCreatePessoa={handleCreatePessoa}
        onCreateProprietario={handleCreateProprietario}
      />
    </div>
  );
}
