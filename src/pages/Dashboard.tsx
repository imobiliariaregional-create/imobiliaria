import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, Badge, EmptyState, LoadingState } from "@/components/ui";
import { formatBRL, formatDate, todayISO, addMonthsISO } from "@/lib/format";
import type { Contrato, PagamentoMensal, ContaConsumo } from "@/lib/types";

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [contratosVencendo, setContratosVencendo] = useState<Contrato[]>([]);
  const [pagamentosPendentes, setPagamentosPendentes] = useState<PagamentoMensal[]>([]);
  const [contasPendentes, setContasPendentes] = useState<ContaConsumo[]>([]);
  const [totalRecebidoMes, setTotalRecebidoMes] = useState(0);

  useEffect(() => {
    const hoje = todayISO();
    const em60Dias = addMonthsISO(hoje, 2);
    const mesAtual = hoje.slice(0, 7);

    async function load() {
      const [contratosRes, pagamentosRes, contasRes, pagamentosDoMesRes] = await Promise.all([
        supabase
          .from("contratos")
          .select("*, imoveis(*)")
          .eq("status", "ativo")
          .not("vigencia_final", "is", null)
          .lte("vigencia_final", em60Dias)
          .order("vigencia_final", { ascending: true })
          .returns<Contrato[]>(),
        supabase
          .from("pagamentos_mensais")
          .select("*, contratos(*, imoveis(*))")
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

      setContratosVencendo(contratosRes.data ?? []);
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
          <h2 className="font-medium text-slate-900 mb-4">Contratos vencendo (próximos 60 dias)</h2>
          {contratosVencendo.length > 0 ? (
            <ul className="space-y-3">
              {contratosVencendo.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {c.imoveis?.rua}, {c.imoveis?.numero}
                    </Link>
                    <p className="text-slate-500">Vigência final: {formatDate(c.vigencia_final)}</p>
                  </div>
                  <Badge color="yellow">{c.tipo}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="Nenhum contrato vencendo nos próximos 60 dias." />
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
                      {p.contratos?.imoveis?.rua}, {p.contratos?.imoveis?.numero}
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

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-medium text-slate-900 mb-4">Contas de água/energia pendentes</h2>
          {contasPendentes.length > 0 ? (
            <ul className="space-y-3">
              {contasPendentes.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link to={`/imoveis/${c.imovel_id}`} className="text-brand-700 hover:underline font-medium">
                      {c.imoveis?.rua}, {c.imoveis?.numero}
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
