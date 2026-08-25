import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, LoadingState, TableToolbar } from "@/components/ui";
import type { Pessoa } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { normalizeSearch } from "@/lib/forms";

export function PessoasListPage() {
  const { papel } = useAuth();
  const [data, setData] = useState<Pessoa[] | null>(null);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const filtered = useMemo(() => (data ?? []).filter((item) => {
    const haystack = normalizeSearch([item.nome, item.cpf_cnpj, item.telefone, item.email, item.endereco].join(" "));
    return (!tipo || item.tipo_pessoa === tipo) && haystack.includes(normalizeSearch(search));
  }), [data, search, tipo]);

  useEffect(() => {
    supabase.from("pessoas").select("*").order("nome").returns<Pessoa[]>().then(({ data }) => setData(data ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Inquilinos/Compradores" action={papel === "admin" || papel === "corretor" ? { href: "/pessoas/nova", label: "Nova pessoa" } : undefined} />
      <TableToolbar search={search} onSearch={setSearch} total={data?.length ?? 0} shown={filtered.length} filter={tipo} onFilter={setTipo} options={[{ value: "fisica", label: "Pessoa física" }, { value: "juridica", label: "Pessoa jurídica" }]} />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : filtered.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>CPF/CNPJ</Th>
                <Th>Telefone</Th>
                <Th>E-mail</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/pessoas/${p.id}`} className="text-brand-700 hover:underline font-medium">
                      {p.nome}
                    </Link>
                  </Td>
                  <Td>{p.tipo_pessoa === "juridica" ? "Pessoa jurídica" : "Pessoa física"}</Td>
                  <Td>{p.cpf_cnpj ?? "-"}</Td>
                  <Td>{p.telefone ?? "-"}</Td>
                  <Td>{p.email ?? "-"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message={data.length ? "Nenhuma pessoa corresponde aos filtros." : "Nenhuma pessoa cadastrada ainda."} />
        )}
      </Card>
    </div>
  );
}
