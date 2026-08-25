import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Button, Field, Select, Input, Badge, LoadingState } from "@/components/ui";
import { ImovelForm, type ImovelPayload } from "@/components/ImovelForm";
import { formatMonth, formatDate, todayISO } from "@/lib/format";
import { imovelLabel, enderecoImovel } from "@/lib/imovelLabel";
import type { Imovel, Proprietario, Contrato, ContaConsumo } from "@/lib/types";
import { confirmDeletion } from "@/lib/actions";
import { useAuth } from "@/lib/auth";
import { useFormDraft } from "@/lib/forms";

export function ImovelDetailPage() {
  const { papel } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [imovel, setImovel] = useState<Imovel | null | undefined>(undefined);
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contas, setContas] = useState<ContaConsumo[]>([]);
  const contaDraft = useFormDraft(`conta-consumo:${id ?? "novo"}`);

  async function reload() {
    const [imovelRes, proprietariosRes, contratosRes, contasRes] = await Promise.all([
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
    setImovel(imovelRes.data);
    setProprietarios(proprietariosRes.data ?? []);
    setContratos(contratosRes.data ?? []);
    setContas(contasRes.data ?? []);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUpdate(data: ImovelPayload) {
    const { error } = await supabase.from("imoveis").update(data).eq("id", id);
    if (error) throw new Error(error.message);
    await reload();
  }

  async function handleDelete() {
    if (!confirmDeletion("Excluir este imóvel e todos os contratos, pagamentos e laudos vinculados?")) return;
    const contratoIds = contratos.map((contrato) => contrato.id);
    const { data: arquivos } = contratoIds.length > 0
      ? await supabase.from("laudos_vistoria").select("arquivo_url").in("contrato_id", contratoIds).not("arquivo_url", "is", null)
      : { data: [] as { arquivo_url: string | null }[] };
    const { error } = await supabase.from("imoveis").delete().eq("id", id);
    if (error) throw new Error(error.message);
    const caminhos = (arquivos ?? []).flatMap((item) => item.arquivo_url ? [item.arquivo_url] : []);
    if (caminhos.length > 0) await supabase.storage.from("laudos-vistoria").remove(caminhos);
    navigate("/imoveis");
  }

  async function handleCriarConta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tipo = String(formData.get("tipo"));
    const mesReferencia = String(formData.get("mes_referencia")) + "-01";
    const { error } = await supabase.from("contas_consumo").insert({
      imovel_id: id,
      tipo,
      mes_referencia: mesReferencia,
      status_pagamento: "pendente",
    });
    if (error) {
      alert(error.message);
      return;
    }
    contaDraft.clearDraft();
    e.currentTarget.reset();
    reload();
  }

  async function toggleConta(conta: ContaConsumo) {
    const paga = conta.status_pagamento === "pago";
    const { error } = await supabase
      .from("contas_consumo")
      .update({
        status_pagamento: paga ? "pendente" : "pago",
        data_pagamento: paga ? null : todayISO(),
      })
      .eq("id", conta.id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  async function excluirConta(contaId: string) {
    if (!confirmDeletion("Excluir esta conta de consumo?")) return;
    const { error } = await supabase.from("contas_consumo").delete().eq("id", contaId);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  if (imovel === undefined) return <LoadingState />;
  if (imovel === null) return <p className="text-sm text-slate-500">Imóvel não encontrado.</p>;

  const contratoAtivo = contratos.find((c) => c.status === "ativo") ?? null;

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title={imovelLabel(imovel, contratoAtivo)}
          action={{ href: `/contratos/novo?imovel_id=${imovel.id}`, label: "Novo contrato" }}
        />
        {contratoAtivo && <p className="text-sm text-slate-500 -mt-4 mb-4">{enderecoImovel(imovel)}</p>}
        {(papel === "admin" || papel === "corretor") ? (
          <ImovelForm onSubmit={handleUpdate} defaultValues={imovel} proprietarios={proprietarios} />
        ) : (
          <Card className="max-w-2xl p-4 text-sm text-slate-600">Seu perfil possui acesso somente de leitura aos dados do imóvel.</Card>
        )}
        <div className="max-w-2xl mt-4">
          {papel === "admin" && <Button type="button" variant="danger" onClick={handleDelete}>Excluir imóvel</Button>}
        </div>
      </div>

      <div>
        <h2 className="font-medium text-slate-900 mb-3">Contratos</h2>
        <Card>
          {contratos.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {contratos.map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/contratos/${c.id}`} className="text-brand-700 hover:underline font-medium text-sm">
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
            {(papel === "admin" || papel === "financeiro") && <form ref={contaDraft.formRef} onSubmit={handleCriarConta} onInput={contaDraft.saveDraft} onChange={contaDraft.saveDraft} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
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
            </form>}

            {contas.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {contas.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                    <span>
                      {c.tipo === "agua" ? "Água" : "Energia"} · {formatMonth(c.mes_referencia.slice(0, 7))}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge color={c.status_pagamento === "pago" ? "green" : "yellow"}>{c.status_pagamento}</Badge>
                      {(papel === "admin" || papel === "financeiro") && (
                        <Button type="button" variant="secondary" onClick={() => toggleConta(c)}>
                          {c.status_pagamento === "pago" ? "Marcar pendente" : "Marcar pago"}
                        </Button>
                      )}
                      {(papel === "admin" || papel === "financeiro") && <Button type="button" variant="danger" onClick={() => excluirConta(c.id)}>Excluir</Button>}
                    </div>
                  </li>
                ))}
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
