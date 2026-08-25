import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState, TableToolbar } from "@/components/ui";
import { imovelLabel, enderecoImovel, mapaContratosAtivosPorImovel } from "@/lib/imovelLabel";
import type { Contrato, Imovel } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { normalizeSearch } from "@/lib/forms";

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
  const { papel } = useAuth();
  const [data, setData] = useState<Imovel[] | null>(null);
  const [contratosAtivos, setContratosAtivos] = useState<Map<string, Contrato>>(new Map());
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const filtered = useMemo(() => (data ?? []).filter((item) => {
    const contrato = contratosAtivos.get(item.id);
    const haystack = normalizeSearch([enderecoImovel(item), item.proprietarios?.nome, contrato?.pessoas?.nome, item.status, item.tipo_imovel].join(" "));
    return (!tipo || item.tipo_operacao === tipo) && haystack.includes(normalizeSearch(search));
  }), [data, contratosAtivos, search, tipo]);

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
      <PageHeader title="Imóveis" action={papel === "admin" || papel === "corretor" ? { href: "/imoveis/novo", label: "Novo imóvel" } : undefined} />
      <TableToolbar search={search} onSearch={setSearch} total={data?.length ?? 0} shown={filtered.length} filter={tipo} onFilter={setTipo} options={Object.entries(tipoLabel).map(([value, label]) => ({ value, label }))} />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : filtered.length > 0 ? (
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
              {filtered.map((imovel) => {
                const contratoAtivo = contratosAtivos.get(imovel.id) ?? null;
                return (
                  <tr key={imovel.id} className="hover:bg-slate-50">
                    <Td>
                      <Link to={`/imoveis/${imovel.id}`} className="text-brand-700 hover:underline font-medium">
                        {imovelLabel(imovel, contratoAtivo)}
                      </Link>
                      <p className="text-slate-500 text-xs">
                        {enderecoImovel(imovel)}
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
          <EmptyState message={data.length ? "Nenhum imóvel corresponde aos filtros." : "Nenhum imóvel cadastrado ainda."} />
        )}
      </Card>
    </div>
  );
}
