import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, Button, LoadingState } from "@/components/ui";
import { formatBRL, formatDate, formatMonth, todayISO } from "@/lib/format";
import type { PagamentoMensal } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export function PagamentosListPage() {
  const [data, setData] = useState<PagamentoMensal[] | null>(null);
  const hoje = todayISO();

  async function reload() {
    const { data } = await supabase
      .from("pagamentos_mensais")
      .select("*, contratos(*, imoveis(*))")
      .order("mes_referencia", { ascending: false })
      .returns<PagamentoMensal[]>();
    setData(data ?? []);
  }

  useEffect(() => {
    reload();
  }, []);

  async function toggle(p: PagamentoMensal) {
    const pago = p.status === "pago";
    const { error } = await supabase
      .from("pagamentos_mensais")
      .update({ status: pago ? "pendente" : "pago", data_pagamento: pago ? null : todayISO() })
      .eq("id", p.id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  return (
    <div>
      <PageHeader title="Pagamentos (valores a receber pela imobiliária)" />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Imóvel</Th>
                <Th>Tipo</Th>
                <Th>Mês</Th>
                <Th>Valor</Th>
                <Th>Vencimento</Th>
                <Th>Status</Th>
                <Th>Ação</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => {
                const atrasado = p.status === "pendente" && p.data_vencimento < hoje;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>
                      <Link to={`/contratos/${p.contrato_id}`} className="text-brand-700 hover:underline font-medium">
                        {p.contratos?.imoveis?.rua}, {p.contratos?.imoveis?.numero}
                      </Link>
                    </Td>
                    <Td>{p.contratos ? tipoLabel[p.contratos.tipo] : "-"}</Td>
                    <Td>{formatMonth(p.mes_referencia.slice(0, 7))}</Td>
                    <Td>{formatBRL(p.valor)}</Td>
                    <Td>{formatDate(p.data_vencimento)}</Td>
                    <Td>
                      <Badge color={p.status === "pago" ? "green" : atrasado ? "red" : "yellow"}>
                        {p.status === "pago" ? "pago" : atrasado ? "atrasado" : "pendente"}
                      </Badge>
                    </Td>
                    <Td>
                      <Button type="button" variant="secondary" onClick={() => toggle(p)}>
                        {p.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhum pagamento gerado ainda. Crie um contrato para começar." />
        )}
      </Card>
    </div>
  );
}
