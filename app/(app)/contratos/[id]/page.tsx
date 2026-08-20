import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Button, Field, Select, Input, Badge, Textarea } from "@/components/ui";
import { ContratoForm } from "@/components/contrato-form";
import { formatBRL, formatDate, formatMonth, todayISO } from "@/lib/format";
import type { Contrato, Imovel, Pessoa, PagamentoMensal, LaudoVistoria, NotaFiscal } from "@/lib/types";
import { updateContrato, deleteContrato, gerarProximoPagamento } from "../actions";
import { marcarPagamentoPago, marcarPagamentoPendente } from "../../pagamentos/actions";
import { criarLaudo, excluirLaudo, urlAssinadaLaudo } from "../laudos-actions";
import { urlAssinadaNota } from "../../notas-fiscais/actions";

export const dynamic = "force-dynamic";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export default async function ContratoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: contrato }, { data: pagamentos }, { data: laudos }, { data: notas }, { data: pessoas }] =
    await Promise.all([
      supabase.from("contratos").select("*, imoveis(*)").eq("id", id).single<Contrato>(),
      supabase
        .from("pagamentos_mensais")
        .select("*")
        .eq("contrato_id", id)
        .order("mes_referencia", { ascending: true })
        .returns<PagamentoMensal[]>(),
      supabase
        .from("laudos_vistoria")
        .select("*")
        .eq("contrato_id", id)
        .order("data", { ascending: false })
        .returns<LaudoVistoria[]>(),
      supabase
        .from("notas_fiscais")
        .select("*")
        .eq("contrato_id", id)
        .order("data_emissao", { ascending: false })
        .returns<NotaFiscal[]>(),
      supabase.from("pessoas").select("*").order("nome").returns<Pessoa[]>(),
    ]);

  if (!contrato) notFound();

  const imovel = contrato.imoveis as Imovel;
  const hoje = todayISO();

  const updateWithId = updateContrato.bind(null, id);
  const deleteWithId = deleteContrato.bind(null, id, contrato.imovel_id);
  const criarLaudoContrato = criarLaudo.bind(null, id);
  const gerarProximo = gerarProximoPagamento.bind(null, id);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title={`Contrato de ${tipoLabel[contrato.tipo]} — ${imovel?.rua}, ${imovel?.numero}`} />
        <ContratoForm
          action={updateWithId}
          mode="edit"
          imoveis={[imovel]}
          pessoas={pessoas ?? []}
          defaultValues={contrato}
        />
        <form action={deleteWithId} className="max-w-2xl mt-4">
          <Button type="submit" variant="danger">Excluir contrato</Button>
        </form>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-900">Pagamentos à imobiliária</h2>
          {contrato.tipo === "administracao" && (
            <form action={gerarProximo}>
              <Button type="submit" variant="secondary">Gerar próximo mês</Button>
            </form>
          )}
        </div>
        <Card>
          {pagamentos && pagamentos.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {pagamentos.map((p) => {
                const atrasado = p.status === "pendente" && p.data_vencimento < hoje;
                const toggle = p.status === "pago" ? marcarPagamentoPendente : marcarPagamentoPago;
                return (
                  <li key={p.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{formatMonth(p.mes_referencia.slice(0, 7))}</span>
                      <span className="text-slate-500"> · {formatBRL(p.valor)} · vencimento {formatDate(p.data_vencimento)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={p.status === "pago" ? "green" : atrasado ? "red" : "yellow"}>
                        {p.status === "pago" ? "pago" : atrasado ? "atrasado" : "pendente"}
                      </Badge>
                      <form action={toggle.bind(null, p.id, id)}>
                        <Button type="submit" variant="secondary">
                          {p.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-center text-slate-500 py-8 text-sm">Nenhum pagamento gerado.</div>
          )}
        </Card>
      </div>

      <div>
        <h2 className="font-medium text-slate-900 mb-3">Laudos de vistoria</h2>
        <Card className="p-4">
          <form action={criarLaudoContrato} className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Tipo" htmlFor="tipo_laudo">
              <Select id="tipo_laudo" name="tipo">
                <option value="entrada">Entrada</option>
                <option value="renovacao">Renovação contratual</option>
              </Select>
            </Field>
            <Field label="Data" htmlFor="data_laudo">
              <Input id="data_laudo" name="data" type="date" required defaultValue={hoje} />
            </Field>
            <div className="col-span-2">
              <Field label="Observações" htmlFor="observacoes_laudo">
                <Textarea id="observacoes_laudo" name="observacoes" rows={2} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Arquivo (PDF/imagem, opcional)" htmlFor="arquivo_laudo">
                <input type="file" id="arquivo_laudo" name="arquivo" accept=".pdf,image/*" className="text-sm" />
              </Field>
            </div>
            <div className="col-span-2">
              <Button type="submit">Adicionar laudo</Button>
            </div>
          </form>

          {laudos && laudos.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {await Promise.all(
                laudos.map(async (l) => {
                  const url = l.arquivo_url ? await urlAssinadaLaudo(l.arquivo_url) : null;
                  return (
                    <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <Badge color="blue">{l.tipo === "entrada" ? "Entrada" : "Renovação"}</Badge>
                        <span className="ml-2 text-slate-700">{formatDate(l.data)}</span>
                        {url && (
                          <a href={url} target="_blank" rel="noreferrer" className="ml-2 text-brand-700 hover:underline">
                            ver arquivo
                          </a>
                        )}
                      </div>
                      <form action={excluirLaudo.bind(null, l.id, id, l.arquivo_url)}>
                        <Button type="submit" variant="danger">Excluir</Button>
                      </form>
                    </li>
                  );
                })
              )}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nenhum laudo cadastrado ainda.</p>
          )}
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-900">Notas fiscais vinculadas</h2>
          <Link href={`/notas-fiscais/nova?contrato_id=${id}`} className="text-sm text-brand-700 hover:underline">
            + Nova nota fiscal
          </Link>
        </div>
        <Card>
          {notas && notas.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {await Promise.all(
                notas.map(async (n) => {
                  const url = n.arquivo_url ? await urlAssinadaNota(n.arquivo_url) : null;
                  return (
                    <li key={n.id} className="px-4 py-3 flex items-center justify-between text-sm">
                      <span>
                        {n.numero ?? "s/n"} · {formatBRL(n.valor)} · {formatDate(n.data_emissao)}
                      </span>
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                          ver arquivo
                        </a>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          ) : (
            <div className="text-center text-slate-500 py-8 text-sm">Nenhuma nota fiscal vinculada.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
