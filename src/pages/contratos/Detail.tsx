import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Button, Field, Select, Input, Badge, Textarea, LoadingState } from "@/components/ui";
import { ContratoForm, type ContratoPayload } from "@/components/ContratoForm";
import { formatBRL, formatDate, formatMonth, todayISO, addDaysISO, diffDiasISO } from "@/lib/format";
import { imovelLabel, mapaContratosAtivosPorImovel } from "@/lib/imovelLabel";
import type { Contrato, Imovel, Pessoa, PagamentoMensal, LaudoVistoria, NotaFiscal } from "@/lib/types";
import { confirmDeletion } from "@/lib/actions";
import { useAuth } from "@/lib/auth";
import { upperOrNull, useFormDraft } from "@/lib/forms";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export function ContratoDetailPage() {
  const { papel } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contrato, setContrato] = useState<Contrato | null | undefined>(undefined);
  const [pagamentos, setPagamentos] = useState<PagamentoMensal[]>([]);
  const [laudos, setLaudos] = useState<LaudoVistoria[]>([]);
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [laudoUrls, setLaudoUrls] = useState<Record<string, string>>({});
  const [notaUrls, setNotaUrls] = useState<Record<string, string>>({});
  const laudoDraft = useFormDraft(`laudo:${id ?? "novo"}`);

  async function reload() {
    const [contratoRes, pagamentosRes, laudosRes, notasRes, pessoasRes] = await Promise.all([
      supabase.from("contratos").select("*, imoveis(*), pessoas(*)").eq("id", id).single<Contrato>(),
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
    setContrato(contratoRes.data);
    setPagamentos(pagamentosRes.data ?? []);
    setLaudos(laudosRes.data ?? []);
    setNotas(notasRes.data ?? []);
    setPessoas(pessoasRes.data ?? []);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    laudos.forEach((l) => {
      if (l.arquivo_url && !laudoUrls[l.id]) {
        supabase.storage
          .from("laudos-vistoria")
          .createSignedUrl(l.arquivo_url, 60 * 5)
          .then(({ data }) => {
            if (data) setLaudoUrls((prev) => ({ ...prev, [l.id]: data.signedUrl }));
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laudos]);

  useEffect(() => {
    notas.forEach((n) => {
      if (n.arquivo_url && !notaUrls[n.id]) {
        supabase.storage
          .from("notas-fiscais")
          .createSignedUrl(n.arquivo_url, 60 * 5)
          .then(({ data }) => {
            if (data) setNotaUrls((prev) => ({ ...prev, [n.id]: data.signedUrl }));
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notas]);

  async function handleUpdate(data: ContratoPayload) {
    const { error } = await supabase.rpc("atualizar_contrato_com_pagamentos", { p_id: id, p_payload: data });
    if (error) throw new Error(error.message);
    await reload();
  }

  async function marcarVisitaRealizada() {
    const { error } = await supabase.from("contratos").update({ data_ultima_visita: todayISO() }).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  async function handleDelete() {
    if (!contrato) return;
    if (!confirmDeletion("Excluir este contrato, seus pagamentos, laudos e documento gerado?")) return;
    const caminhos = laudos.flatMap((laudo) => laudo.arquivo_url ? [laudo.arquivo_url] : []);
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (caminhos.length > 0) await supabase.storage.from("laudos-vistoria").remove(caminhos);
    navigate(`/imoveis/${contrato.imovel_id}`);
  }

  async function togglePagamento(p: PagamentoMensal) {
    const pago = p.status === "pago";
    if (pago && p.valor_repassado !== null) {
      alert("Desfaça o repasse ao proprietário antes de marcar este pagamento como pendente.");
      return;
    }
    const { error } = await supabase
      .from("pagamentos_mensais")
      .update({ status: pago ? "pendente" : "pago", data_pagamento: pago ? null : todayISO() })
      .eq("id", p.id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  async function handleCriarLaudo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tipo = String(formData.get("tipo"));
    const data = String(formData.get("data"));
    const observacoes = upperOrNull(formData.get("observacoes"));
    const arquivo = formData.get("arquivo") as File | null;

    let arquivo_url: string | null = null;
    if (arquivo && arquivo.size > 0) {
      const nomeArquivo = `${id}/${Date.now()}-${arquivo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("laudos-vistoria")
        .upload(nomeArquivo, arquivo, { contentType: arquivo.type });
      if (uploadError) {
        alert(uploadError.message);
        return;
      }
      arquivo_url = nomeArquivo;
    }

    const { error } = await supabase.from("laudos_vistoria").insert({
      contrato_id: id,
      tipo,
      data,
      observacoes,
      arquivo_url,
    });
    if (error) {
      if (arquivo_url) await supabase.storage.from("laudos-vistoria").remove([arquivo_url]);
      alert(error.message);
      return;
    }
    laudoDraft.clearDraft();
    e.currentTarget.reset();
    reload();
  }

  async function excluirLaudo(laudo: LaudoVistoria) {
    if (!confirmDeletion("Excluir este laudo de vistoria?")) return;
    const { error } = await supabase.from("laudos_vistoria").delete().eq("id", laudo.id);
    if (error) {
      alert(error.message);
      return;
    }
    if (laudo.arquivo_url) await supabase.storage.from("laudos-vistoria").remove([laudo.arquivo_url]);
    reload();
  }

  if (contrato === undefined) return <LoadingState />;
  if (contrato === null) return <p className="text-sm text-slate-500">Contrato não encontrado.</p>;

  const imovel = contrato.imoveis as Imovel;
  const hoje = todayISO();
  const contratosAtivosPorImovel =
    contrato.status === "ativo" ? new Map([[imovel.id, contrato]]) : new Map<string, Contrato>();
  const proximaVisita =
    contrato.periodo_visita_dias && contrato.data_ultima_visita
      ? addDaysISO(contrato.data_ultima_visita, contrato.periodo_visita_dias)
      : null;

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title={`Contrato ${contrato.numero_contrato ? contrato.numero_contrato + " — " : ""}${tipoLabel[contrato.tipo]} — ${imovelLabel(imovel, contrato)}`}
          action={{ href: `/contratos/${id}/documento`, label: "Documento do contrato" }}
        />
        {(papel === "admin" || papel === "corretor") ? (
          <ContratoForm
            onSubmit={handleUpdate}
            mode="edit"
            imoveis={[imovel]}
            pessoas={pessoas}
            defaultValues={contrato}
            contratosAtivosPorImovel={contratosAtivosPorImovel}
          />
        ) : (
          <Card className="p-4 text-sm text-slate-600">
            Seu perfil financeiro possui acesso somente para consulta aos dados do contrato.
          </Card>
        )}
        <div className="max-w-2xl mt-4">
          {papel === "admin" && <Button type="button" variant="danger" onClick={handleDelete}>Excluir contrato</Button>}
        </div>
      </div>

      {contrato.periodo_visita_dias && (
        <div>
          <h2 className="font-medium text-slate-900 mb-3">Visitas periódicas</h2>
          <Card className="p-4 text-sm text-slate-700 flex items-center justify-between">
            <div>
              <p>Período configurado: a cada {contrato.periodo_visita_dias} dias</p>
              <p>Última visita: {formatDate(contrato.data_ultima_visita)}</p>
              {proximaVisita && (
                <p>
                  Próxima visita: {formatDate(proximaVisita)}{" "}
                  {diffDiasISO(proximaVisita, hoje) <= 2 && (
                    <Badge color={diffDiasISO(proximaVisita, hoje) < 0 ? "red" : "yellow"}>
                      {diffDiasISO(proximaVisita, hoje) < 0 ? "atrasada" : "avisar inquilino"}
                    </Badge>
                  )}
                </p>
              )}
            </div>
            {(papel === "admin" || papel === "corretor") && (
              <Button type="button" variant="secondary" onClick={marcarVisitaRealizada}>Marcar visita realizada</Button>
            )}
          </Card>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-900">Pagamentos à imobiliária</h2>
        </div>
        <Card>
          {pagamentos.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {pagamentos.map((p) => {
                const atrasado = p.status === "pendente" && p.data_vencimento < hoje;
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
                      {(papel === "admin" || papel === "financeiro") && <Button
                        type="button"
                        variant="secondary"
                        disabled={p.status === "pago" && p.valor_repassado !== null}
                        onClick={() => togglePagamento(p)}
                      >
                        {p.status === "pago" ? "Marcar pendente" : "Marcar pago"}
                      </Button>}
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
          {(papel === "admin" || papel === "corretor") && (
            <form ref={laudoDraft.formRef} onSubmit={handleCriarLaudo} onInput={laudoDraft.saveDraft} onChange={laudoDraft.saveDraft} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tipo" htmlFor="tipo_laudo">
                <Select id="tipo_laudo" name="tipo">
                  <option value="entrada">Entrada</option>
                  <option value="renovacao">Renovação contratual</option>
                  <option value="saida">Saída</option>
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
          )}

          {laudos.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {laudos.map((l) => (
                <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <Badge color="blue">{l.tipo === "entrada" ? "Entrada" : l.tipo === "saida" ? "Saída" : "Renovação"}</Badge>
                    <span className="ml-2 text-slate-700">{formatDate(l.data)}</span>
                    {laudoUrls[l.id] && (
                      <a href={laudoUrls[l.id]} target="_blank" rel="noreferrer" className="ml-2 text-brand-700 hover:underline">
                        ver arquivo
                      </a>
                    )}
                  </div>
                  {(papel === "admin" || papel === "corretor") && <Button type="button" variant="danger" onClick={() => excluirLaudo(l)}>Excluir</Button>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nenhum laudo cadastrado ainda.</p>
          )}
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-900">Notas fiscais vinculadas</h2>
          {(papel === "admin" || papel === "financeiro") && (
            <Link to={`/notas-fiscais/nova?contrato_id=${id}`} className="text-sm text-brand-700 hover:underline">
              + Nova nota fiscal
            </Link>
          )}
        </div>
        <Card>
          {notas.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {notas.map((n) => (
                <li key={n.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <span>
                    {n.numero ?? "s/n"} · {formatBRL(n.valor)} · {formatDate(n.data_emissao)}
                  </span>
                  {notaUrls[n.id] && (
                    <a href={notaUrls[n.id]} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                      ver arquivo
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-slate-500 py-8 text-sm">Nenhuma nota fiscal vinculada.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
