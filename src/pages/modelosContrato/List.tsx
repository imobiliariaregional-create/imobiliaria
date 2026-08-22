import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState } from "@/components/ui";
import { PapelTimbradoCard } from "@/components/PapelTimbradoCard";
import type { ModeloContrato } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export function ModelosContratoListPage() {
  const [data, setData] = useState<ModeloContrato[] | null>(null);

  useEffect(() => {
    supabase
      .from("modelos_contrato")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<ModeloContrato[]>()
      .then(({ data }) => setData(data ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Modelos de Contrato" action={{ href: "/modelos-contrato/novo", label: "Novo modelo" }} />
      <PapelTimbradoCard />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Cláusulas</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((modelo) => (
                <tr key={modelo.id} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/modelos-contrato/${modelo.id}`} className="text-brand-700 hover:underline font-medium">
                      {modelo.nome}
                    </Link>
                  </Td>
                  <Td>
                    <Badge color="blue">{tipoLabel[modelo.tipo_operacao]}</Badge>
                  </Td>
                  <Td>{modelo.clausulas.length}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhum modelo de contrato cadastrado ainda." />
        )}
      </Card>
    </div>
  );
}
