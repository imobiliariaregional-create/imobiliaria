import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState, TableToolbar } from "@/components/ui";
import { PapelTimbradoCard } from "@/components/PapelTimbradoCard";
import type { ModeloContrato } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { normalizeSearch } from "@/lib/forms";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export function ModelosContratoListPage() {
  const { papel } = useAuth();
  const [data, setData] = useState<ModeloContrato[] | null>(null);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const filtered = useMemo(() => (data ?? []).filter((item) => (
    (!tipo || item.tipo_operacao === tipo) && normalizeSearch(item.nome).includes(normalizeSearch(search))
  )), [data, search, tipo]);

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
      <PageHeader title="Modelos de Contrato" action={papel === "admin" || papel === "corretor" ? { href: "/modelos-contrato/novo", label: "Novo modelo" } : undefined} />
      <PapelTimbradoCard />
      <TableToolbar search={search} onSearch={setSearch} total={data?.length ?? 0} shown={filtered.length} filter={tipo} onFilter={setTipo} options={Object.entries(tipoLabel).map(([value, label]) => ({ value, label }))} />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : filtered.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Cláusulas</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((modelo) => (
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
          <EmptyState message={data.length ? "Nenhum modelo corresponde aos filtros." : "Nenhum modelo de contrato cadastrado ainda."} />
        )}
      </Card>
    </div>
  );
}
