import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Button, Field, Select, Input, Badge } from "@/components/ui";
import { ImovelForm } from "@/components/imovel-form";
import { formatMonth, formatDate } from "@/lib/format";
import type { Imovel, Proprietario, Contrato, ContaConsumo } from "@/lib/types";
import { updateImovel, deleteImovel } from "../actions";
import { criarContaConsumo, marcarContaPaga, marcarContaPendente, excluirContaConsumo } from "../../contas-consumo/actions";

export const dynamic = "force-dynamic";

export default async function ImovelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: imovel }, { data: proprietarios }, { data: contratos }, { data: contas }] = await Promise.all([
    supabase.from("imoveis").select("*").eq("id", id).single<Imovel>(),
    supabase.from("proprietarios").select("*").order("nome").returns<Proprietario[]>(),
    supabase
      .from("contratos")
      .select("*, pessoas(*)")
      .eq("imovel_id", id)
      .order("created_at", { ascending: false })
      .returns<Contrato[]>(),
    supabase
      .from("contas_consumo")
      .select("*")
      .eq("imovel_id", id)
      .order("mes_referencia", { ascending: false })
      .returns<ContaConsumo[]>(),
  ]);

  if (!imovel) notFound();

  const updateWithId = updateImovel.bind(null, id);
  const deleteWithId = deleteImovel.bind(null, id);
  const criarConta = criarContaConsumo.bind(null, id);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title={`${imovel.rua}, ${imovel.numero ?? ""}`}
          action={{ href: `/contratos/novo?imovel_id=${imovel.id}`, label: "Novo contrato" }}
        />
        <ImovelForm action={updateWithId} defaultValues={imovel} proprietarios={proprietarios ?? []} />
        <form action={deleteWithId} className="max-w-2xl mt-4">
          <Button type="submit" variant="danger">Excluir imóvel</Button>
        </form>
      </div>

      <div>
        <h2 className="font-medium text-slate-900 mb-3">Contratos</h2>
        <Card>
          {contratos && contratos.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {contratos.map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium text-sm">
                      {c.tipo} · {c.pessoas?.nome ?? "sem pessoa vinculada"}
                    </Link>
                    <p className="text-xs text-slate-500">
                      Início: {formatDate(c.data_inicio)} · Vigência final: {formatDate(c.vigencia_final)}
                    </p>
                  </div>
                  <Badge color={c.status === "ativo" ? "green" : "slate"}>{c.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-slate-500 py-8 text-sm">Nenhum contrato para este imóvel ainda.</div>
          )}
        </Card>
      </div>

      {(imovel.controla_agua || imovel.controla_energia) && (
        <div>
          <h2 className="font-medium text-slate-900 mb-3">Água / Energia</h2>
          <Card className="p-4">
            <form action={criarConta} className="flex items-end gap-3 mb-4">
              <Field label="Tipo" htmlFor="tipo">
                <Select id="tipo" name="tipo">
                  {imovel.controla_agua && <option value="agua">Água</option>}
                  {imovel.controla_energia && <option value="energia">Energia</option>}
                </Select>
              </Field>
              <Field label="Mês de referência" htmlFor="mes_referencia">
                <Input id="mes_referencia" name="mes_referencia" type="month" required />
              </Field>
              <Button type="submit">Adicionar</Button>
            </form>

            {contas && contas.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {contas.map((c) => {
                  const toggle = c.status_pagamento === "pago" ? marcarContaPendente : marcarContaPaga;
                  return (
                    <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                      <span>
                        {c.tipo === "agua" ? "Água" : "Energia"} · {formatMonth(c.mes_referencia.slice(0, 7))}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge color={c.status_pagamento === "pago" ? "green" : "yellow"}>{c.status_pagamento}</Badge>
                        <form action={toggle.bind(null, c.id, id)}>
                          <Button type="submit" variant="secondary">
                            {c.status_pagamento === "pago" ? "Marcar pendente" : "Marcar pago"}
                          </Button>
                        </form>
                        <form action={excluirContaConsumo.bind(null, c.id, id)}>
                          <Button type="submit" variant="danger">Excluir</Button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nenhuma conta cadastrada ainda.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
