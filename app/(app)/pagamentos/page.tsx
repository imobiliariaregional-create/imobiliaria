import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, Button } from "@/components/ui";
import { formatBRL, formatDate, formatMonth, todayISO } from "@/lib/format";
import type { PagamentoMensal } from "@/lib/types";
import { marcarPagamentoPago, marcarPagamentoPendente } from "./actions";

export const dynamic = "force-dynamic";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export default async function PagamentosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pagamentos_mensais")
    .select("*, contratos(*, imoveis(*))")
    .order("mes_referencia", { ascending: false })
    .returns<PagamentoMensal[]>();

  const hoje = todayISO();

  return (
    <div>
      <PageHeader title="Pagamentos (valores a receber pela imobiliária)" />
      <Card>
        {data && data.length > 0 ? (
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
                const toggle = p.status === "pago" ? marcarPagamentoPendente : marcarPagamentoPago;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/contratos/${p.contrato_id}`} className="text-brand-700 hover:underline font-medium">
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
                      <form action={toggle.bind(null, p.id, p.contrato_id)}>
                        <Button type="submit" variant="secondary">
                          {p.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                        </Button>
                      </form>
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
