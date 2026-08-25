import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState, TableToolbar } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Contrato } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { normalizeSearch } from "@/lib/forms";
import { enderecoImovel } from "@/lib/imovelLabel";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export function ContratosListPage() {
  const { papel } = useAuth();
  const [data, setData] = useState<Contrato[] | null>(null);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const filtered = useMemo(() => (data ?? []).filter((item) => {
    const haystack = normalizeSearch([item.numero_contrato, item.pessoas?.nome, item.imoveis ? enderecoImovel(item.imoveis) : "", item.status].join(" "));
    return (!tipo || item.tipo === tipo) && haystack.includes(normalizeSearch(search));
  }), [data, search, tipo]);

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
      <PageHeader title="Contratos" action={papel === "admin" || papel === "corretor" ? { href: "/contratos/novo", label: "Novo contrato" } : undefined} />
      <TableToolbar search={search} onSearch={setSearch} total={data?.length ?? 0} shown={filtered.length} filter={tipo} onFilter={setTipo} options={Object.entries(tipoLabel).map(([value, label]) => ({ value, label }))} />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : filtered.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Número</Th>
                <Th>Imóvel</Th>
                <Th>Pessoa</Th>
                <Th>Tipo</Th>
                <Th>Vigência final</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>{c.numero_contrato ?? "-"}</Td>
                  <Td>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium">
                      {c.imoveis ? enderecoImovel(c.imoveis) : "-"}
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
          <EmptyState message={data.length ? "Nenhum contrato corresponde aos filtros." : "Nenhum contrato cadastrado ainda."} />
        )}
      </Card>
    </div>
  );
}
