import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState, ErrorState, Button, TableToolbar } from "@/components/ui";
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
  const navigate = useNavigate();
  const [data, setData] = useState<ModeloContrato[] | null>(null);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const podeEditar = papel === "admin" || papel === "corretor";
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

  async function duplicar(modelo: ModeloContrato) {
    setError(null);
    setDuplicandoId(modelo.id);
    try {
      const { data: novo, error } = await supabase
        .from("modelos_contrato")
        .insert({ nome: `${modelo.nome} (cópia)`, tipo_operacao: modelo.tipo_operacao, clausulas: modelo.clausulas })
        .select("*")
        .single<ModeloContrato>();
      if (error) throw new Error(error.message);
      navigate(`/modelos-contrato/${novo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao duplicar modelo.");
      setDuplicandoId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Modelos de Contrato" action={podeEditar ? { href: "/modelos-contrato/novo", label: "Novo modelo" } : undefined} />
      <PapelTimbradoCard />
      <TableToolbar search={search} onSearch={setSearch} total={data?.length ?? 0} shown={filtered.length} filter={tipo} onFilter={setTipo} options={Object.entries(tipoLabel).map(([value, label]) => ({ value, label }))} />
      {error && <ErrorState message={error} />}
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
                {podeEditar && <Th>&nbsp;</Th>}
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
                  {podeEditar && (
                    <Td className="text-right">
                      <Button type="button" variant="secondary" onClick={() => duplicar(modelo)} disabled={duplicandoId === modelo.id}>
                        {duplicandoId === modelo.id ? "Duplicando..." : "Duplicar"}
                      </Button>
                    </Td>
                  )}
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
