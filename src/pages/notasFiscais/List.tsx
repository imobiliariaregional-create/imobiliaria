import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Button, LoadingState } from "@/components/ui";
import { formatBRL, formatDate } from "@/lib/format";
import type { NotaFiscal } from "@/lib/types";
import { confirmDeletion } from "@/lib/actions";
import { useAuth } from "@/lib/auth";

export function NotasFiscaisListPage() {
  const { papel } = useAuth();
  const [data, setData] = useState<NotaFiscal[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  async function reload() {
    const { data } = await supabase
      .from("notas_fiscais")
      .select("*, contratos(*, imoveis(*))")
      .order("data_emissao", { ascending: false })
      .returns<NotaFiscal[]>();
    setData(data ?? []);
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    (data ?? []).forEach((n) => {
      if (n.arquivo_url && !urls[n.id]) {
        supabase.storage
          .from("notas-fiscais")
          .createSignedUrl(n.arquivo_url, 60 * 5)
          .then(({ data }) => {
            if (data) setUrls((prev) => ({ ...prev, [n.id]: data.signedUrl }));
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function excluir(nota: NotaFiscal) {
    if (!confirmDeletion("Excluir esta nota fiscal?")) return;
    const { error } = await supabase.from("notas_fiscais").delete().eq("id", nota.id);
    if (error) {
      alert(error.message);
      return;
    }
    if (nota.arquivo_url) await supabase.storage.from("notas-fiscais").remove([nota.arquivo_url]);
    reload();
  }

  const totalGeral = (data ?? []).reduce((acc, n) => acc + Number(n.valor), 0);

  return (
    <div>
      <PageHeader title="Notas Fiscais" action={papel === "admin" || papel === "financeiro" ? { href: "/notas-fiscais/nova", label: "Nova nota fiscal" } : undefined} />
      <p className="text-sm text-slate-500 -mt-4 mb-6">Total registrado: {formatBRL(totalGeral)}</p>
      <Card>
        {data === null ? (
          <LoadingState />
        ) : data.length > 0 ? (
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
              {data.map((nota) => (
                <tr key={nota.id} className="hover:bg-slate-50">
                  <Td>{nota.numero ?? "-"}</Td>
                  <Td>{formatBRL(nota.valor)}</Td>
                  <Td>{formatDate(nota.data_emissao)}</Td>
                  <Td>
                    {nota.contrato_id ? (
                      <Link to={`/contratos/${nota.contrato_id}`} className="text-brand-700 hover:underline">
                        {nota.contratos?.imoveis?.rua}, {nota.contratos?.imoveis?.numero}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </Td>
                  <Td>
                    {urls[nota.id] ? (
                      <a href={urls[nota.id]} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                        ver arquivo
                      </a>
                    ) : (
                      "-"
                    )}
                  </Td>
                  <Td>
                    {(papel === "admin" || papel === "financeiro") ? <Button type="button" variant="danger" onClick={() => excluir(nota)}>Excluir</Button> : <span className="text-xs text-slate-400">Somente leitura</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Nenhuma nota fiscal cadastrada ainda." />
        )}
      </Card>
    </div>
  );
}
