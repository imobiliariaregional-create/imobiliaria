import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, Badge, EmptyState, LoadingState } from "@/components/ui";
import { formatBRL, formatDate, formatMonth, todayISO, addDaysISO, diffDiasISO } from "@/lib/format";
import { imovelLabel } from "@/lib/imovelLabel";
import type { Contrato, PagamentoMensal, ContaConsumo, LaudoVistoria } from "@/lib/types";

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [contratosAVencer, setContratosAVencer] = useState<Contrato[]>([]);
  const [contratosVencidos, setContratosVencidos] = useState<Contrato[]>([]);
  const [visitasAgendar, setVisitasAgendar] = useState<{ contrato: Contrato; proxima: string }[]>([]);
  const [vistoriaSaidaPendente, setVistoriaSaidaPendente] = useState<Contrato[]>([]);
  const [pagamentosPendentes, setPagamentosPendentes] = useState<PagamentoMensal[]>([]);
  const [contasPendentes, setContasPendentes] = useState<ContaConsumo[]>([]);
  const [totalRecebidoMes, setTotalRecebidoMes] = useState(0);

  useEffect(() => {
    const hoje = todayISO();
    const em90Dias = addDaysISO(hoje, 90);
    const mesAtual = hoje.slice(0, 7);

    async function load() {
      const [contratosAtivosRes, candidatosVistoriaRes, pagamentosRes, contasRes, pagamentosDoMesRes] = await Promise.all([
        supabase
          .from("contratos")
          .select("*, imoveis(*), pessoas(*)")
          .eq("status", "ativo")
          .returns<Contrato[]>(),
        supabase
          .from("contratos")
          .select("*, imoveis(*), pessoas(*)")
          .or(`status.neq.ativo,vigencia_final.lt.${hoje}`)
          .returns<Contrato[]>(),
        supabase
          .from("pagamentos_mensais")
          .select("*, contratos(*, imoveis(*), pessoas(*))")
          .in("status", ["pendente", "atrasado"])
          .lte("data_vencimento", hoje)
          .order("data_vencimento", { ascending: true })
          .returns<PagamentoMensal[]>(),
        supabase
          .from("contas_consumo")
          .select("*, imoveis(*)")
          .eq("status_pagamento", "pendente")
          .order("mes_referencia", { ascending: true })
          .returns<ContaConsumo[]>(),
        supabase
          .from("pagamentos_mensais")
          .select("valor")
          .eq("status", "pago")
          .gte("data_pagamento", `${mesAtual}-01`),
      ]);

      const contratosAtivos = contratosAtivosRes.data ?? [];

      const aVencer = contratosAtivos
        .filter((c) => c.vigencia_final && c.vigencia_final >= hoje && c.vigencia_final <= em90Dias)
        .sort((a, b) => (a.vigencia_final ?? "").localeCompare(b.vigencia_final ?? ""));
      const vencidos = contratosAtivos
        .filter((c) => c.vigencia_final && c.vigencia_final < hoje)
        .sort((a, b) => (a.vigencia_final ?? "").localeCompare(b.vigencia_final ?? ""));

      const visitas = contratosAtivos
        .filter((c) => c.periodo_visita_dias)
        .map((c) => ({
          contrato: c,
          proxima: addDaysISO(c.data_ultima_visita ?? c.data_inicio, c.periodo_visita_dias!),
        }))
        .filter((v) => diffDiasISO(v.proxima, hoje) <= 2)
        .sort((a, b) => a.proxima.localeCompare(b.proxima));

      const candidatosVistoria = candidatosVistoriaRes.data ?? [];
      let semVistoriaSaida: Contrato[] = [];
      if (candidatosVistoria.length > 0) {
        const { data: laudosSaida } = await supabase
          .from("laudos_vistoria")
          .select("contrato_id")
          .eq("tipo", "saida")
          .in(
            "contrato_id",
            candidatosVistoria.map((c) => c.id)
          )
          .returns<Pick<LaudoVistoria, "contrato_id">[]>();
        const idsComVistoria = new Set((laudosSaida ?? []).map((l) => l.contrato_id));
        semVistoriaSaida = candidatosVistoria.filter((c) => !idsComVistoria.has(c.id));
      }

      setContratosAVencer(aVencer);
      setContratosVencidos(vencidos);
      setVisitasAgendar(visitas);
      setVistoriaSaidaPendente(semVistoriaSaida);
      setPagamentosPendentes(pagamentosRes.data ?? []);
      setContasPendentes(contasRes.data ?? []);
      setTotalRecebidoMes((pagamentosDoMesRes.data ?? []).reduce((acc, p: any) => acc + Number(p.valor), 0));
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Recebido pela imobiliária este mês</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{formatBRL(totalRecebidoMes)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Pagamentos pendentes/atrasados</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{pagamentosPendentes.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Contas de água/energia pendentes</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{contasPendentes.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-medium text-slate-900 mb-4">Contratos a vencer (próximos 90 dias)</h2>
          {contratosAVencer.length > 0 ? (
            <ul className="space-y-3">
              {contratosAVencer.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!, c)}
                    </Link>
                    <p className="text-slate-500">Vigência final: {formatDate(c.vigencia_final)}</p>
                  </div>
                  <Badge color="yellow">{c.tipo}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhum contrato a vencer nos próximos 90 dias." />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium text-slate-900 mb-4">Contratos vencidos</h2>
          {contratosVencidos.length > 0 ? (
            <ul className="space-y-3">
              {contratosVencidos.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!, c)}
                    </Link>
                    <p className="text-slate-500">Venceu em: {formatDate(c.vigencia_final)}</p>
                  </div>
                  <Badge color="red">vencido</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhum contrato vencido." />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium text-slate-900 mb-4">Visitas a agendar (aviso de 48h)</h2>
          {visitasAgendar.length > 0 ? (
            <ul className="space-y-3">
              {visitasAgendar.map(({ contrato: c, proxima }) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!, c)}
                    </Link>
                    <p className="text-slate-500">Próxima visita: {formatDate(proxima)}</p>
                  </div>
                  <Badge color={diffDiasISO(proxima, todayISO()) < 0 ? "red" : "yellow"}>
                    {diffDiasISO(proxima, todayISO()) < 0 ? "atrasada" : "avisar inquilino"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhuma visita para agendar." />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium text-slate-900 mb-4">Vistoria de saída pendente</h2>
          {vistoriaSaidaPendente.length > 0 ? (
            <ul className="space-y-3">
              {vistoriaSaidaPendente.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!, c)}
                    </Link>
                    <p className="text-slate-500">Contrato {c.status} {c.vigencia_final ? `· venceu em ${formatDate(c.vigencia_final)}` : ""}</p>
                  </div>
                  <Badge color="red">sem vistoria de saída</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhuma vistoria de saída pendente." />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium text-slate-900 mb-4">Pagamentos pendentes/atrasados</h2>
          {pagamentosPendentes.length > 0 ? (
            <ul className="space-y-3">
              {pagamentosPendentes.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link to={`/contratos/${p.contrato_id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(p.contratos!.imoveis!, p.contratos)}
                    </Link>
                    <p className="text-slate-500">Vencimento: {formatDate(p.data_vencimento)} · {formatBRL(p.valor)}</p>
                  </div>
                  <Badge color={p.status === "atrasado" ? "red" : "yellow"}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhum pagamento pendente." />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium text-slate-900 mb-4">Contas de água/energia pendentes</h2>
          {contasPendentes.length > 0 ? (
            <ul className="space-y-3">
              {contasPendentes.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link to={`/imoveis/${c.imovel_id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!)}
                    </Link>
                    <p className="text-slate-500">{c.mes_referencia.slice(0, 7)}</p>
                  </div>
                  <Badge color="blue">{c.tipo}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhuma conta pendente." />
          )}
        </Card>
      </div>
    </div>
  );
}
