import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Table, Th, Td, EmptyState } from "@/components/ui";
import type { Pessoa } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PessoasPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("pessoas").select("*").order("nome").returns<Pessoa[]>();

  return (
    <div>
      <PageHeader title="Inquilinos/Compradores" action={{ href: "/pessoas/nova", label: "Nova pessoa" }} />
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
                    <Link href={`/pessoas/${p.id}`} className="text-brand-700 hover:underline font-medium">
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
