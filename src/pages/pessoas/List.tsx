import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, LoadingState } from "@/components/ui";
import type { Pessoa } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function PessoasListPage() {
  const { papel } = useAuth();
  const [data, setData] = useState<Pessoa[] | null>(null);

  useEffect(() => {
    supabase.from("pessoas").select("*").order("nome").returns<Pessoa[]>().then(({ data }) => setData(data ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Inquilinos/Compradores" action={papel === "admin" || papel === "corretor" ? { href: "/pessoas/nova", label: "Nova pessoa" } : undefined} />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>CPF/CNPJ</Th>
                <Th>Telefone</Th>
                <Th>E-mail</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/pessoas/${p.id}`} className="text-brand-700 hover:underline font-medium">
                      {p.nome}
                    </Link>
                  </Td>
                  <Td>{p.cpf_cnpj ?? "-"}</Td>
                  <Td>{p.telefone ?? "-"}</Td>
                  <Td>{p.email ?? "-"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhuma pessoa cadastrada ainda." />
        )}
      </Card>
    </div>
  );
}
