import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Table, Th, Td, EmptyState, Button } from "@/components/ui";
import { formatBRL, formatDate } from "@/lib/format";
import type { NotaFiscal } from "@/lib/types";
import { deleteNotaFiscal, urlAssinadaNota } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotasFiscaisPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notas_fiscais")
    .select("*, contratos(*, imoveis(*))")
    .order("data_emissao", { ascending: false })
    .returns<NotaFiscal[]>();

  const totalGeral = (data ?? []).reduce((acc, n) => acc + Number(n.valor), 0);

  return (
    <div>
      <PageHeader title="Notas Fiscais" action={{ href: "/notas-fiscais/nova", label: "Nova nota fiscal" }} />
      <p className="text-sm text-slate-500 -mt-4 mb-6">Total registrado: {formatBRL(totalGeral)}</p>
      <Card>
        {data && data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Número</Th>
                <Th>Valor</Th>
                <Th>Emissão</Th>
                <Th>Contrato vinculado</Th>
                <Th>Arquivo</Th>
                <Th>Ação</Th>
              </tr>
            </thead>
            <tbody>
              {await Promise.all(
                data.map(async (nota) => {
                  const url = nota.arquivo_url ? await urlAssinadaNota(nota.arquivo_url) : null;
                  return (
                    <tr key={nota.id} className="hover:bg-slate-50">
                      <Td>{nota.numero ?? "-"}</Td>
                      <Td>{formatBRL(nota.valor)}</Td>
                      <Td>{formatDate(nota.data_emissao)}</Td>
                      <Td>
                        {nota.contrato_id ? (
                          <Link href={`/contratos/${nota.contrato_id}`} className="text-brand-700 hover:underline">
                            {nota.contratos?.imoveis?.rua}, {nota.contratos?.imoveis?.numero}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                            ver arquivo
                          </a>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>
                        <form action={deleteNotaFiscal.bind(null, nota.id, nota.arquivo_url, nota.contrato_id)}>
                          <Button type="submit" variant="danger">Excluir</Button>
                        </form>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhuma nota fiscal cadastrada ainda." />
        )}
      </Card>
    </div>
  );
}
