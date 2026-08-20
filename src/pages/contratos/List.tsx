import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Contrato } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export function ContratosListPage() {
  const [data, setData] = useState<Contrato[] | null>(null);

  useEffect(() => {
    supabase
      .from("contratos")
      .select("*, imoveis(*), pessoas(*)")
      .order("created_at", { ascending: false })
      .returns<Contrato[]>()
      .then(({ data }) => setData(data ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Contratos" action={{ href: "/contratos/novo", label: "Novo contrato" }} />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : data.length > 0 ? (
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
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
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
