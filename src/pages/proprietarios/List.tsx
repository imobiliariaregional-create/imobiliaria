import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, LoadingState } from "@/components/ui";
import type { Proprietario } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function ProprietariosListPage() {
  const { papel } = useAuth();
  const [data, setData] = useState<Proprietario[] | null>(null);

  useEffect(() => {
    supabase
      .from("proprietarios")
      .select("*")
      .order("nome")
      .returns<Proprietario[]>()
      .then(({ data }) => setData(data ?? []));
  }, []);

  return (
    <div>
      <PageHeader title="Proprietários" action={papel === "admin" || papel === "corretor" ? { href: "/proprietarios/novo", label: "Novo proprietário" } : undefined} />
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
                    <Link to={`/proprietarios/${p.id}`} className="text-brand-700 hover:underline font-medium">
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
          <EmptyState message="Nenhum proprietário cadastrado ainda." />
        )}
      </Card>
    </div>
  );
}
