import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, EmptyState, LoadingState } from "@/components/ui";
import { ContratoForm, type ContratoPayload } from "@/components/ContratoForm";
import { gerarPagamentosIniciais } from "@/lib/pagamentos";
import { mapaContratosAtivosPorImovel } from "@/lib/imovelLabel";
import type { Contrato, Imovel, Pessoa } from "@/lib/types";

export function NovoContratoPage() {
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
    const { data: numeroContrato, error: numeroError } = await supabase.rpc("proximo_numero_contrato", {
      p_ano: Number(data.data_inicio.slice(0, 4)),
    });
    if (numeroError) throw new Error(numeroError.message);

    const payload = {
      ...data,
      numero_contrato: numeroContrato,
      data_ultima_visita: data.periodo_visita_dias ? data.data_inicio : null,
    };

    const { data: contrato, error } = await supabase.from("contratos").insert(payload).select("*").single();
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
        contratosAtivosPorImovel={contratosAtivos}
      />
    </div>
  );
}
