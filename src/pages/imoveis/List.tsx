import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState } from "@/components/ui";
import type { Imovel } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

const statusColor: Record<string, "green" | "blue" | "slate"> = {
  disponivel: "blue",
  ocupado: "green",
  vendido: "slate",
};

export function ImoveisListPage() {
  const [data, setData] = useState<Imovel[] | null>(null);

  useEffect(() => {
    supabase
      .from("imoveis")
      .select("*, proprietarios(*)")
      .order("created_at", { ascending: false })
      .returns<Imovel[]>()
      .then(({ data }) => setData(data ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Imóveis" action={{ href: "/imoveis/novo", label: "Novo imóvel" }} />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Endereço</Th>
                <Th>Proprietário</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((imovel) => (
                <tr key={imovel.id} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/imoveis/${imovel.id}`} className="text-brand-700 hover:underline font-medium">
                      {imovel.rua}, {imovel.numero} - {imovel.bairro}
                    </Link>
                    <p className="text-slate-500 text-xs">{imovel.cidade}/{imovel.uf}</p>
                  </Td>
                  <Td>{imovel.proprietarios?.nome ?? "-"}</Td>
                  <Td>{tipoLabel[imovel.tipo_operacao]}</Td>
                  <Td>
                    <Badge color={statusColor[imovel.status]}>{imovel.status}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhum imóvel cadastrado ainda." />
        )}
      </Card>
    </div>
  );
}
