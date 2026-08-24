import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, Badge, EmptyState, LoadingState } from "@/components/ui";
import { formatBRL, formatDate, formatMonth, todayISO, addDaysISO, diffDiasISO } from "@/lib/format";
import { imovelLabel } from "@/lib/imovelLabel";
import type { Contrato, PagamentoMensal, ContaConsumo, LaudoVistoria } from "@/lib/types";
import { ArrowUpRight, Banknote, CalendarClock, CircleAlert, Droplets, FileClock, House, WalletCards } from "lucide-react";

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
          .eq("status", "pendente")
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

  const totalPendencias = pagamentosPendentes.length + contasPendentes.length + contratosVencidos.length;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Visão geral</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.25rem]">Olá, equipe Regional</h1>
          <p className="mt-2 text-sm text-slate-500">Acompanhe os números e as prioridades da sua operação.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-600 shadow-sm">
          <CalendarClock size={16} className="text-brand-700" /> Atualizado agora
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="relative overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Banknote size={21} /></span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Este mês</span></div>
          <p className="mt-5 text-sm font-medium text-slate-500">Receita recebida</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{formatBRL(totalRecebidoMes)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><WalletCards size={21} /></span><ArrowUpRight size={17} className="text-slate-300" /></div>
          <p className="mt-5 text-sm font-medium text-slate-500">Pagamentos pendentes</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{pagamentosPendentes.length}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-sky-50 text-sky-700"><Droplets size={21} /></span><ArrowUpRight size={17} className="text-slate-300" /></div>
          <p className="mt-5 text-sm font-medium text-slate-500">Contas de consumo</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{contasPendentes.length}</p>
        </Card>
        <Card className="border-slate-800 bg-[#10251e] p-5 text-white">
          <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-emerald-200"><CircleAlert size={21} /></span><span className="size-2 rounded-full bg-amber-300 shadow-[0_0_0_5px_rgba(252,211,77,0.12)]" /></div>
          <p className="mt-5 text-sm font-medium text-emerald-50/55">Total de pendências</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{totalPendencias}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><FileClock size={18} /></span><div><h2 className="text-sm font-semibold text-slate-900">Contratos a vencer</h2><p className="text-xs text-slate-500">Próximos 90 dias</p></div></div>
          {contratosAVencer.length > 0 ? (
            <ul className="divide-y divide-slate-100 px-5">
              {contratosAVencer.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!, c)}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">Vigência final: {formatDate(c.vigencia_final)}</p>
                  </div>
                  <Badge color="yellow">{c.tipo}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhum contrato a vencer nos próximos 90 dias." />
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-700"><CircleAlert size={18} /></span><div><h2 className="text-sm font-semibold text-slate-900">Contratos vencidos</h2><p className="text-xs text-slate-500">Exigem atenção da equipe</p></div></div>
          {contratosVencidos.length > 0 ? (
            <ul className="divide-y divide-slate-100 px-5">
              {contratosVencidos.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!, c)}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">Venceu em: {formatDate(c.vigencia_final)}</p>
                  </div>
                  <Badge color="red">vencido</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhum contrato vencido." />
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><CalendarClock size={18} /></span><div><h2 className="text-sm font-semibold text-slate-900">Visitas a agendar</h2><p className="text-xs text-slate-500">Avisos com 48 horas</p></div></div>
          {visitasAgendar.length > 0 ? (
            <ul className="divide-y divide-slate-100 px-5">
              {visitasAgendar.map(({ contrato: c, proxima }) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!, c)}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">Próxima visita: {formatDate(proxima)}</p>
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

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className="grid size-9 place-items-center rounded-xl bg-orange-50 text-orange-700"><House size={18} /></span><div><h2 className="text-sm font-semibold text-slate-900">Vistorias de saída</h2><p className="text-xs text-slate-500">Pendências após encerramento</p></div></div>
          {vistoriaSaidaPendente.length > 0 ? (
            <ul className="divide-y divide-slate-100 px-5">
              {vistoriaSaidaPendente.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!, c)}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">Contrato {c.status} {c.vigencia_final ? `· venceu em ${formatDate(c.vigencia_final)}` : ""}</p>
                  </div>
                  <Badge color="red">sem vistoria de saída</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhuma vistoria de saída pendente." />
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><WalletCards size={18} /></span><div><h2 className="text-sm font-semibold text-slate-900">Pagamentos em aberto</h2><p className="text-xs text-slate-500">Pendentes e atrasados</p></div></div>
          {pagamentosPendentes.length > 0 ? (
            <ul className="divide-y divide-slate-100 px-5">
              {pagamentosPendentes.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <div>
                    <Link to={`/contratos/${p.contrato_id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(p.contratos!.imoveis!, p.contratos)}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">Vencimento: {formatDate(p.data_vencimento)} · {formatBRL(p.valor)}</p>
                  </div>
                  <Badge color={p.data_vencimento < todayISO() ? "red" : "yellow"}>
                    {p.data_vencimento < todayISO() ? "atrasado" : "pendente"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhum pagamento pendente." />
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-700"><Droplets size={18} /></span><div><h2 className="text-sm font-semibold text-slate-900">Contas de consumo</h2><p className="text-xs text-slate-500">Água e energia pendentes</p></div></div>
          {contasPendentes.length > 0 ? (
            <ul className="divide-y divide-slate-100 px-5">
              {contasPendentes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <div>
                    <Link to={`/imoveis/${c.imovel_id}`} className="text-brand-700 hover:underline font-medium">
                      {imovelLabel(c.imoveis!)}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">{c.mes_referencia.slice(0, 7)}</p>
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
