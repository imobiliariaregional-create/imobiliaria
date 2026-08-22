import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState } from "@/components/ui";
import { imovelLabel, enderecoImovel, mapaContratosAtivosPorImovel } from "@/lib/imovelLabel";
import type { Contrato, Imovel } from "@/lib/types";

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
  const [contratosAtivos, setContratosAtivos] = useState<Map<string, Contrato>>(new Map());

  useEffect(() => {
    supabase
      .from("imoveis")
      .select("*, proprietarios(*)")
      .order("created_at", { ascending: false })
      .returns<Imovel[]>()
      .then(async ({ data }) => {
        const imoveis = data ?? [];
        setData(imoveis);
        setContratosAtivos(await mapaContratosAtivosPorImovel(imoveis.map((i) => i.id)));
      });
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
                <Th>Imóvel</Th>
                <Th>Proprietário</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((imovel) => {
                const contratoAtivo = contratosAtivos.get(imovel.id) ?? null;
                return (
                  <tr key={imovel.id} className="hover:bg-slate-50">
                    <Td>
                      <Link to={`/imoveis/${imovel.id}`} className="text-brand-700 hover:underline font-medium">
                        {imovelLabel(imovel, contratoAtivo)}
                      </Link>
                      <p className="text-slate-500 text-xs">
                        {contratoAtivo ? enderecoImovel(imovel) : `${imovel.bairro ?? ""}`} · {imovel.cidade}/{imovel.uf}
                      </p>
                    </Td>
                    <Td>{imovel.proprietarios?.nome ?? "-"}</Td>
                    <Td>{tipoLabel[imovel.tipo_operacao]}</Td>
                    <Td>
                      <Badge color={statusColor[imovel.status]}>{imovel.status}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhum imóvel cadastrado ainda." />
        )}
      </Card>
    </div>
  );
}
