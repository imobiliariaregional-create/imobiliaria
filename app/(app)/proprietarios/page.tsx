import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Table, Th, Td, EmptyState } from "@/components/ui";
import type { Proprietario } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProprietariosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("proprietarios")
    .select("*")
    .order("nome")
    .returns<Proprietario[]>();

  return (
    <div>
      <PageHeader title="Proprietários" action={{ href: "/proprietarios/novo", label: "Novo proprietário" }} />
      <Card>
        {data && data.length > 0 ? (
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
                    <Link href={`/proprietarios/${p.id}`} className="text-brand-700 hover:underline font-medium">
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
