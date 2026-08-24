import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, Button, LoadingState } from "@/components/ui";
import { formatMonth, todayISO } from "@/lib/format";
import type { ContaConsumo } from "@/lib/types";
import { useAuth } from "@/lib/auth";

const tipoLabel: Record<string, string> = { agua: "Água", energia: "Energia" };

export function ContasConsumoListPage() {
  const { papel } = useAuth();
  const [data, setData] = useState<ContaConsumo[] | null>(null);

  async function reload() {
    const { data } = await supabase
      .from("contas_consumo")
      .select("*, imoveis(*)")
      .order("mes_referencia", { ascending: false })
      .returns<ContaConsumo[]>();
    setData(data ?? []);
  }

  useEffect(() => {
    reload();
  }, []);

  async function toggle(c: ContaConsumo) {
    const paga = c.status_pagamento === "pago";
    const { error } = await supabase
      .from("contas_consumo")
      .update({ status_pagamento: paga ? "pendente" : "pago", data_pagamento: paga ? null : todayISO() })
      .eq("id", c.id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  return (
    <div>
      <PageHeader title="Água / Energia" />
      <p className="text-sm text-slate-500 -mt-4 mb-6">
        Contas são cadastradas a partir da página de cada imóvel.
      </p>
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
                <Th>Status</Th>
                <Th>Ação</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/imoveis/${c.imovel_id}`} className="text-brand-700 hover:underline font-medium">
                      {c.imoveis?.rua}, {c.imoveis?.numero}
                    </Link>
                  </Td>
                  <Td>{tipoLabel[c.tipo]}</Td>
                  <Td>{formatMonth(c.mes_referencia.slice(0, 7))}</Td>
                  <Td>
                    <Badge color={c.status_pagamento === "pago" ? "green" : "yellow"}>{c.status_pagamento}</Badge>
                  </Td>
                  <Td>
                    {(papel === "admin" || papel === "financeiro") ? (
                      <Button type="button" variant="secondary" onClick={() => toggle(c)}>
                        {c.status_pagamento === "pago" ? "Marcar pendente" : "Marcar pago"}
                      </Button>
                    ) : <span className="text-xs text-slate-400">Somente leitura</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhuma conta de água/energia cadastrada ainda." />
        )}
      </Card>
    </div>
  );
}
