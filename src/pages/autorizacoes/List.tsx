import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader, Select, Table, TableToolbar, Td, Textarea, Th } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { supabase } from "@/lib/supabase";
import type { AutorizacaoAdministracao, Imovel, Proprietario, StatusAutorizacao } from "@/lib/types";
import { normalizeSearch, upperOrNull } from "@/lib/forms";
import { enderecoImovel } from "@/lib/imovelLabel";
import { formatDate, todayISO } from "@/lib/format";
import { deleteDriveFile, downloadDriveFile, getDriveFileBlob, uploadDriveFile } from "@/lib/googleDrive";
import { enviarParaAssinatura, consultarStatusAssinatura, baixarDocumentoAssinado, blobParaBase64, STATUS_LABEL } from "@/lib/assinafy";
import { confirmDeletion } from "@/lib/actions";
import { useAuth } from "@/lib/auth";
import { Download, FilePlus2, FileText, FileUp, PenLine, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { GerarDocumentoModal } from "@/components/GerarDocumentoModal";
import { buscarDadosAdministradora, buscarModelosAtivos } from "@/lib/administradora";
import { gerarPdfDocumento, resolverContratoAdministracao } from "@/lib/documentosModelo";
import { downloadBlob } from "@/lib/exportContrato";
import type { ModeloContrato } from "@/lib/types";

const statusLabels: Record<StatusAutorizacao, string> = { ativa: "Ativa", encerrada: "Encerrada", cancelada: "Cancelada" };

export function AutorizacoesListPage() {
  const { papel } = useAuth();
  const canWrite = papel === "admin" || papel === "corretor";
  const [data, setData] = useState<AutorizacaoAdministracao[] | null>(null);
  const [owners, setOwners] = useState<Proprietario[]>([]);
  const [properties, setProperties] = useState<Imovel[]>([]);
  const [editing, setEditing] = useState<AutorizacaoAdministracao | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pendingDownload, setPendingDownload] = useState<string | null>(null);
  const [modalAssinatura, setModalAssinatura] = useState<AutorizacaoAdministracao | null>(null);
  const [emailAssinatura, setEmailAssinatura] = useState("");
  const [erroAssinatura, setErroAssinatura] = useState<string | null>(null);
  const [assinaturaPendingId, setAssinaturaPendingId] = useState<string | null>(null);
  const [emailAdministradora, setEmailAdministradora] = useState("");
  const [nomeAdministradora, setNomeAdministradora] = useState("");
  const [gerar, setGerar] = useState<{ item: AutorizacaoAdministracao; tipo: "contrato" | "aditivo" } | null>(null);

  async function reload() {
    const [{ data: rows }, { data: owners }, { data: properties }] = await Promise.all([
      supabase.from("autorizacoes_administracao").select("*, proprietarios(*), autorizacao_imoveis(imovel_id, imoveis(*))").order("created_at", { ascending: false }).returns<AutorizacaoAdministracao[]>(),
      supabase.from("proprietarios").select("*").order("nome").returns<Proprietario[]>(),
      supabase.from("imoveis").select("*").order("rua").returns<Imovel[]>(),
    ]);
    setData(rows ?? []); setOwners(owners ?? []); setProperties(properties ?? []);
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => (data ?? []).filter((item) => {
    const addresses = item.autorizacao_imoveis?.map((link) => link.imoveis ? enderecoImovel(link.imoveis) : "").join(" ") ?? "";
    return (!status || item.status === status) && normalizeSearch(`${item.numero ?? ""} ${item.proprietarios?.nome ?? ""} ${addresses}`).includes(normalizeSearch(search));
  }), [data, search, status]);

  async function remove(item: AutorizacaoAdministracao) {
    if (!confirmDeletion("Excluir este contrato de autorização?")) return;
    try {
      if (item.drive_file_id) await deleteDriveFile(item.drive_file_id);
      const { error } = await supabase.from("autorizacoes_administracao").delete().eq("id", item.id);
      if (error) throw error;
      await reload();
    } catch (error) { alert(error instanceof Error ? error.message : "Erro ao excluir."); }
  }

  async function download(item: AutorizacaoAdministracao) {
    if (!item.drive_file_id || !item.drive_file_name) return;
    try { setPendingDownload(item.id); await downloadDriveFile(item.drive_file_id, item.drive_file_name, item.drive_mime_type); }
    catch (error) { alert(error instanceof Error ? error.message : "Erro ao baixar arquivo."); }
    finally { setPendingDownload(null); }
  }

  async function abrirModalAssinatura(item: AutorizacaoAdministracao) {
    setModalAssinatura(item);
    setEmailAssinatura(item.proprietarios?.email ?? "");
    setErroAssinatura(null);
    try {
      const adm = await buscarDadosAdministradora();
      setEmailAdministradora(adm?.adm_email ?? "");
      setNomeAdministradora(adm?.adm_razao_social ?? "");
    } catch {
      setEmailAdministradora("");
      setNomeAdministradora("");
    }
  }

  async function confirmarEnviarAssinatura() {
    const item = modalAssinatura;
    if (!item) return;
    const emailValido = (valor: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
    if (!emailValido(emailAssinatura)) {
      setErroAssinatura("Informe um e-mail válido.");
      return;
    }
    if (emailAdministradora.trim() && !emailValido(emailAdministradora)) {
      setErroAssinatura("O e-mail da imobiliária é inválido. Corrija ou deixe em branco.");
      return;
    }
    if (!item.drive_file_id) {
      setErroAssinatura("Este item não tem arquivo anexado.");
      return;
    }
    setModalAssinatura(null);
    setAssinaturaPendingId(item.id);
    try {
      const blob = await getDriveFileBlob(item.drive_file_id, item.drive_mime_type);
      const pdfBase64 = await blobParaBase64(blob);
      const resultado = await enviarParaAssinatura(pdfBase64, item.drive_file_name ?? "autorizacao.pdf", [
        { nome: item.proprietarios?.nome ?? "Proprietário", email: emailAssinatura.trim() },
        ...(emailAdministradora.trim() ? [{ nome: nomeAdministradora || "Imobiliária", email: emailAdministradora.trim() }] : []),
      ]);
      const { error } = await supabase.from("autorizacoes_administracao").update({
        assinafy_document_id: resultado.documentId,
        assinafy_assignment_id: resultado.assignmentId,
        assinafy_status: resultado.status,
      }).eq("id", item.id);
      if (error) throw error;
      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao enviar para assinatura.");
    } finally {
      setAssinaturaPendingId(null);
    }
  }

  async function salvarDocumentoGerado(conteudo: string, modelo: ModeloContrato) {
    if (!gerar) return;
    const { item, tipo } = gerar;
    const numero = item.numero ?? "SEM NUMERO";
    const ehContrato = tipo === "contrato";
    if (ehContrato && item.drive_file_id && !window.confirm(
      `Esta autorização já tem um arquivo anexado (${item.drive_file_name ?? "arquivo"}). Substituir pelo contrato gerado?` +
      (item.assinafy_document_id ? "\n\nO envio para assinatura atual será desvinculado." : ""),
    )) {
      throw new Error("Geração cancelada: o arquivo anexado foi mantido.");
    }

    const nomeArquivo = ehContrato
      ? `${numero.replace("/", "-")} - CONTRATO DE ADMINISTRACAO.pdf`
      : `${numero.replace("/", "-")} - ADITIVO INCLUSAO DE IMOVEL ${todayISO()}.pdf`;
    const blob = await gerarPdfDocumento(conteudo, { numeroContrato: numero, data: ehContrato ? item.data_inicio : todayISO(), tipoImovel: null });
    const uploaded = await uploadDriveFile(new File([blob], nomeArquivo, { type: "application/pdf" }), {
      category: "autorizacao",
      folders: [item.proprietarios?.nome, numero],
      fileName: nomeArquivo,
    });

    if (ehContrato) {
      const { error } = await supabase.from("autorizacoes_administracao").update({
        drive_file_id: uploaded.id, drive_file_name: uploaded.name, drive_mime_type: uploaded.mimeType, drive_file_size: Number(uploaded.size),
        assinafy_document_id: null, assinafy_assignment_id: null, assinafy_status: null, assinafy_resumo: null,
        observacoes: item.observacoes ?? `GERADO PELO MODELO "${modelo.nome}"`,
      }).eq("id", item.id);
      if (error) {
        await deleteDriveFile(uploaded.id).catch(() => undefined);
        throw new Error(error.message);
      }
      if (item.drive_file_id && item.drive_file_id !== uploaded.id) await deleteDriveFile(item.drive_file_id).catch(() => undefined);
    }
    downloadBlob(blob, nomeArquivo);
    await reload();
  }

  async function atualizarStatusAssinatura(item: AutorizacaoAdministracao) {
    if (!item.assinafy_document_id) return;
    setAssinaturaPendingId(item.id);
    try {
      const status = await consultarStatusAssinatura(item.assinafy_document_id);
      const { error } = await supabase.from("autorizacoes_administracao")
        .update({ assinafy_status: status.status, assinafy_resumo: status.resumo })
        .eq("id", item.id);
      if (error) throw error;
      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao consultar status.");
    } finally {
      setAssinaturaPendingId(null);
    }
  }

  async function baixarAssinado(item: AutorizacaoAdministracao) {
    if (!item.assinafy_document_id) return;
    setAssinaturaPendingId(item.id);
    try {
      await baixarDocumentoAssinado(item.assinafy_document_id, "certificated", `${item.numero ?? "autorizacao"}-assinado.pdf`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao baixar documento assinado.");
    } finally {
      setAssinaturaPendingId(null);
    }
  }

  return <div>
    <div className="mb-7 flex items-end justify-between gap-4">
      <PageHeader title="Autorizações de administração" />
      {canWrite && <Button onClick={() => setEditing(null)}><Plus size={17} /> Nova autorização</Button>}
    </div>
    <TableToolbar search={search} onSearch={setSearch} total={data?.length ?? 0} shown={filtered.length} filter={status} onFilter={setStatus} filterLabel="Status" options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
    <Card>{data === null ? <LoadingState /> : filtered.length === 0 ? <EmptyState message="Nenhuma autorização encontrada." /> : <Table>
      <thead><tr><Th>Número</Th><Th>Proprietário</Th><Th>Imóveis</Th><Th>Vigência</Th><Th>Status</Th><Th>Anexo</Th><Th>Assinatura</Th><Th>Ações</Th></tr></thead>
      <tbody>{filtered.map((item) => <tr key={item.id}>
        <Td>{item.numero || "SEM NÚMERO"}</Td><Td className="font-medium">{item.proprietarios?.nome ?? "-"}</Td>
        <Td>{item.autorizacao_imoveis?.map((link) => link.imoveis ? enderecoImovel(link.imoveis) : "").filter(Boolean).join("; ") || "-"}</Td>
        <Td>{formatDate(item.data_inicio)}{item.data_fim ? ` a ${formatDate(item.data_fim)}` : ""}</Td>
        <Td><Badge color={item.status === "ativa" ? "green" : item.status === "cancelada" ? "red" : "slate"}>{statusLabels[item.status]}</Badge></Td>
        <Td>{item.drive_file_id ? <Button variant="secondary" disabled={pendingDownload === item.id} onClick={() => download(item)}><Download size={15} /> {pendingDownload === item.id ? "Baixando..." : "Baixar"}</Button> : "Sem anexo"}</Td>
        <Td>
          {!item.drive_file_id || item.drive_mime_type !== "application/pdf" ? (
            <span className="text-slate-400">—</span>
          ) : !item.assinafy_document_id ? (
            canWrite && <Button variant="secondary" disabled={assinaturaPendingId === item.id} onClick={() => abrirModalAssinatura(item)} title="Enviar para assinatura"><PenLine size={15} /></Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge color={item.assinafy_status === "certificated" ? "green" : "yellow"}>{STATUS_LABEL[item.assinafy_status ?? ""] ?? item.assinafy_status}</Badge>
              <Button variant="secondary" disabled={assinaturaPendingId === item.id} onClick={() => atualizarStatusAssinatura(item)} title="Atualizar status"><RefreshCw size={15} /></Button>
              {item.assinafy_status === "certificated" && (
                <Button variant="secondary" disabled={assinaturaPendingId === item.id} onClick={() => baixarAssinado(item)} title="Baixar assinado"><Download size={15} /></Button>
              )}
            </div>
          )}
        </Td>
        <Td><div className="flex gap-2">{canWrite && <>
          <Button variant="secondary" onClick={() => setGerar({ item, tipo: "contrato" })} title="Gerar contrato de administração pelo modelo"><FileText size={15} /></Button>
          <Button variant="secondary" onClick={() => setGerar({ item, tipo: "aditivo" })} title="Gerar aditivo de inclusão de imóvel"><FilePlus2 size={15} /></Button>
        </>}{canWrite && <Button variant="secondary" onClick={() => setEditing(item)} title="Editar"><Pencil size={15} /></Button>}{papel === "admin" && <Button variant="danger" onClick={() => remove(item)}><Trash2 size={15} /></Button>}</div></Td>
      </tr>)}</tbody>
    </Table>}</Card>
    <Modal open={editing !== undefined} title={editing ? "Editar autorização" : "Nova autorização"} onClose={() => setEditing(undefined)}>
      <AuthorizationForm value={editing ?? undefined} owners={owners} properties={properties} onSaved={async () => { setEditing(undefined); await reload(); }} />
    </Modal>
    <GerarDocumentoModal
      open={gerar !== null}
      titulo={gerar?.tipo === "aditivo" ? `Aditivo de inclusão de imóvel — ${gerar.item.numero ?? ""}` : `Contrato de administração — ${gerar?.item.numero ?? ""}`}
      aviso={gerar?.tipo === "aditivo"
        ? <>Antes de gerar, edite a autorização e marque o imóvel novo. O aditivo lista <b>todos</b> os imóveis marcados. O PDF é salvo no Drive, na pasta desta autorização, e baixado; o arquivo do contrato anexado não muda.</>
        : <>Usa o proprietário, os imóveis marcados, o número e a data desta autorização e a taxa do cadastro do proprietário. O PDF gerado fica anexado à autorização, pronto para enviar para assinatura.</>}
      carregarModelos={() => buscarModelosAtivos(gerar?.tipo === "aditivo" ? "aditivo_administracao" : "contrato_administracao", "administracao")}
      resolver={(conteudoModelo) => resolverContratoAdministracao(gerar!.item, conteudoModelo)}
      rotuloSalvar={gerar?.tipo === "aditivo" ? "Salvar aditivo (PDF no Drive)" : "Salvar e anexar à autorização"}
      onSalvar={salvarDocumentoGerado}
      onClose={() => setGerar(null)}
    />
    <Modal open={modalAssinatura !== null} title="Enviar para assinatura" onClose={() => setModalAssinatura(null)}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Confira o e-mail do proprietário que vai receber a autorização para assinatura. Você pode alterá-lo antes de enviar.
        </p>
        <Field label={`Proprietário — ${modalAssinatura?.proprietarios?.nome ?? ""}`} htmlFor="email_assinatura_autorizacao">
          <Input id="email_assinatura_autorizacao" type="email" value={emailAssinatura} onChange={(e) => setEmailAssinatura(e.target.value)} placeholder="email@exemplo.com" />
        </Field>
        <Field label={`Imobiliária${nomeAdministradora ? ` — ${nomeAdministradora}` : ""} (deixe em branco se não for assinar digitalmente)`} htmlFor="email_assinatura_administradora">
          <Input id="email_assinatura_administradora" type="email" value={emailAdministradora} onChange={(e) => setEmailAdministradora(e.target.value)} placeholder="email@imobiliaria.com.br" />
        </Field>
        {erroAssinatura && <ErrorState message={erroAssinatura} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setModalAssinatura(null)}>Cancelar</Button>
          <Button type="button" onClick={confirmarEnviarAssinatura}>Confirmar e enviar</Button>
        </div>
      </div>
    </Modal>
  </div>;
}

function AuthorizationForm({ value, owners, properties, onSaved }: { value?: AutorizacaoAdministracao; owners: Proprietario[]; properties: Imovel[]; onSaved: () => Promise<void> }) {
  const [ownerId, setOwnerId] = useState(value?.proprietario_id ?? "");
  const [selected, setSelected] = useState<string[]>(value?.autorizacao_imoveis?.map((link) => link.imovel_id) ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = properties.filter((item) => item.proprietario_id === ownerId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    let uploaded: Awaited<ReturnType<typeof uploadDriveFile>> | null = null;
    try {
      if (!selected.length) throw new Error("Selecione pelo menos um imóvel.");
      const form = new FormData(event.currentTarget);
      const file = form.get("arquivo");
      if (file instanceof File && file.size) uploaded = await uploadDriveFile(file, {
        category: "autorizacao",
        folders: [owners.find((owner) => owner.id === ownerId)?.nome, value?.numero ?? "NOVAS AUTORIZACOES"],
      });
      const payload = {
        proprietario_id: ownerId, numero: value?.numero ?? null, data_inicio: String(form.get("data_inicio")), data_fim: String(form.get("data_fim") || "") || null,
        status: String(form.get("status")) as StatusAutorizacao, observacoes: upperOrNull(form.get("observacoes")),
        ...(uploaded ? { drive_file_id: uploaded.id, drive_file_name: uploaded.name, drive_mime_type: uploaded.mimeType, drive_file_size: Number(uploaded.size) } : {}),
      };
      const { error: saveError } = await supabase.rpc("salvar_autorizacao_administracao", { p_id: value?.id ?? null, p_payload: payload, p_imoveis: selected });
      if (saveError) throw saveError;
      if (uploaded && value?.drive_file_id) await deleteDriveFile(value.drive_file_id);
      await onSaved();
    } catch (cause) {
      if (uploaded) await deleteDriveFile(uploaded.id).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Erro ao salvar autorização.");
    } finally { setPending(false); }
  }

  return <Card className="p-5"><form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Proprietário" htmlFor="aut_owner"><Select id="aut_owner" required disabled={Boolean(value)} value={ownerId} onChange={(e) => { setOwnerId(e.target.value); setSelected([]); }}><option value="">Selecione...</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.nome}</option>)}</Select></Field><Field label="Número da autorização" htmlFor="numero"><Input id="numero" value={value?.numero ?? "GERADO AUTOMATICAMENTE AO SALVAR"} readOnly disabled={!value} /></Field></div>
    <div className="grid gap-4 sm:grid-cols-3"><Field label="Data inicial" htmlFor="aut_inicio"><Input id="aut_inicio" name="data_inicio" type="date" required defaultValue={value?.data_inicio ?? todayISO()} /></Field><Field label="Data final (opcional)" htmlFor="aut_fim"><Input id="aut_fim" name="data_fim" type="date" defaultValue={value?.data_fim ?? ""} /></Field><Field label="Status" htmlFor="aut_status"><Select id="aut_status" name="status" defaultValue={value?.status ?? "ativa"}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field></div>
    <div><p className="mb-2 text-sm font-semibold text-slate-700">Imóveis autorizados</p>{!ownerId ? <p className="text-sm text-slate-500">Selecione o proprietário.</p> : available.length === 0 ? <p className="text-sm text-slate-500">Esse proprietário ainda não possui imóveis cadastrados.</p> : <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{available.map((item) => <label key={item.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />{enderecoImovel(item)}</label>)}</div>}</div>
    <Field label={value?.drive_file_id ? "Substituir contrato anexado (opcional)" : "Contrato anexado (Google Drive)"} htmlFor="arquivo"><Input id="arquivo" name="arquivo" type="file" accept=".pdf,.doc,.docx,image/*" /><p className="mt-1 text-xs text-slate-500"><FileUp size={13} className="mr-1 inline" />PDF, Word ou imagem, até 15 MB. O banco guarda somente os dados do arquivo.</p></Field>
    <Field label="Observações" htmlFor="aut_obs"><Textarea id="aut_obs" name="observacoes" rows={3} defaultValue={value?.observacoes ?? ""} /></Field>
    {error && <ErrorState message={error} />}<Button disabled={pending}>{pending ? "Salvando e enviando..." : "Salvar autorização"}</Button>
  </form></Card>;
}
