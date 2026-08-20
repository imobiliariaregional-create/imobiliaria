import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Contrato } from "@/lib/types";

export const dynamic = "force-dynamic";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export default async function ContratosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contratos")
    .select("*, imoveis(*), pessoas(*)")
    .order("created_at", { ascending: false })
    .returns<Contrato[]>();

  return (
    <div>
      <PageHeader title="Contratos" action={{ href: "/contratos/novo", label: "Novo contrato" }} />
      <Card>
        {data && data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Imóvel</Th>
                <Th>Pessoa</Th>
                <Th>Tipo</Th>
                <Th>Vigência final</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {c.imoveis?.rua}, {c.imoveis?.numero}
                    </Link>
                  </Td>
                  <Td>{c.pessoas?.nome ?? "-"}</Td>
                  <Td>{tipoLabel[c.tipo]}</Td>
                  <Td>{formatDate(c.vigencia_final)}</Td>
                  <Td>
                    <Badge color={c.status === "ativo" ? "green" : "slate"}>{c.status}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhum contrato cadastrado ainda." />
        )}
      </Card>
    </div>
  );
}
