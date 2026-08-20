import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, Button } from "@/components/ui";
import { formatMonth } from "@/lib/format";
import type { ContaConsumo } from "@/lib/types";
import { marcarContaPaga, marcarContaPendente } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const tipoLabel: Record<string, string> = { agua: "Água", energia: "Energia" };

export default async function ContasConsumoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contas_consumo")
    .select("*, imoveis(*)")
    .order("mes_referencia", { ascending: false })
    .returns<ContaConsumo[]>();

  return (
    <div>
      <PageHeader title="Água / Energia" />
      <p className="text-sm text-slate-500 -mt-4 mb-6">
        Contas são cadastradas a partir da página de cada imóvel.
      </p>
      <Card>
        {data && data.length > 0 ? (
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
              {data.map((c) => {
                const toggle = c.status_pagamento === "pago" ? marcarContaPendente : marcarContaPaga;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/imoveis/${c.imovel_id}`} className="text-brand-700 hover:underline font-medium">
                        {c.imoveis?.rua}, {c.imoveis?.numero}
                      </Link>
                    </Td>
                    <Td>{tipoLabel[c.tipo]}</Td>
                    <Td>{formatMonth(c.mes_referencia.slice(0, 7))}</Td>
                    <Td>
                      <Badge color={c.status_pagamento === "pago" ? "green" : "yellow"}>{c.status_pagamento}</Badge>
                    </Td>
                    <Td>
                      <form action={toggle.bind(null, c.id, c.imovel_id)}>
                        <Button type="submit" variant="secondary">
                          {c.status_pagamento === "pago" ? "Marcar pendente" : "Marcar pago"}
                        </Button>
                      </form>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhuma conta de água/energia cadastrada ainda." />
        )}
      </Card>
    </div>
  );
}
