import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Field, Select, Button, Badge, LoadingState, ErrorState } from "@/components/ui";
import { ClausulasEditor } from "@/components/ClausulasEditor";
import { DocumentoContratoView } from "@/components/DocumentoContratoView";
import { resolverPlaceholders, substituirPlaceholders } from "@/lib/placeholders";
import { enderecoImovel, imovelLabel } from "@/lib/imovelLabel";
import { fetchLetterheadDataUrl } from "@/lib/letterhead";
import { downloadBlob, exportContratoDocx, gerarContratoPdfBase64, gerarContratoPdfBlob } from "@/lib/exportContrato";
import { enviarParaAssinatura, consultarStatusAssinatura, obterDocumentoAssinado, STATUS_LABEL } from "@/lib/assinafy";
import { deleteDriveFile, downloadDriveFile, uploadDriveFile, type DriveUploadOptions } from "@/lib/googleDrive";
import type { ClausulaDocumento, Contrato, ContratoGerado, ModeloContrato } from "@/lib/types";
import type { CabecalhoDocumento } from "@/lib/contratoDocumento";

export function ContratoDocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const draftKey = `form-draft:contrato-documento:${id ?? "novo"}`;

  const [contrato, setContrato] = useState<Contrato | null | undefined>(undefined);
  const [modelos, setModelos] = useState<ModeloContrato[]>([]);
  const [modeloId, setModeloId] = useState("");
  const [gerado, setGerado] = useState<ContratoGerado | null | undefined>(undefined);
  const [clausulas, setClausulas] = useState<ClausulaDocumento[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<"pdf" | "docx" | null>(null);
  const [assinaturaPending, setAssinaturaPending] = useState(false);

  async function reload() {
    setError(null);
    setContrato(undefined);
    setGerado(undefined);
    const [contratoRes, geradoRes] = await Promise.all([
      supabase.from("contratos").select("*, imoveis(*, proprietarios(*)), pessoas(*)").eq("id", id).single<Contrato>(),
      supabase.from("contratos_gerados").select("*").eq("contrato_id", id).maybeSingle<ContratoGerado>(),
    ]);
    setContrato(contratoRes.data);
    setGerado(geradoRes.data ?? null);
    if (geradoRes.data) {
      try {
        const draft = sessionStorage.getItem(draftKey);
        setClausulas(draft ? JSON.parse(draft) : geradoRes.data.clausulas);
      } catch {
        sessionStorage.removeItem(draftKey);
        setClausulas(geradoRes.data.clausulas);
      }
    }

    if (contratoRes.data) {
      const { data: modelosData } = await supabase
        .from("modelos_contrato")
        .select("*")
        .eq("tipo_operacao", contratoRes.data.tipo)
        .order("nome")
        .returns<ModeloContrato[]>();
      setModelos(modelosData ?? []);
      if (modelosData && modelosData.length > 0) setModeloId(modelosData[0].id);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function gerarDocumento() {
    if (!contrato || !modeloId) return;
    setPending(true);
    setError(null);
    try {
      const modelo = modelos.find((m) => m.id === modeloId);
      if (!modelo) throw new Error("Selecione um modelo.");
      const proprietario = contrato.imoveis?.proprietarios;
      if (!proprietario) throw new Error("O imóvel deste contrato não tem proprietário cadastrado.");

      const valores = resolverPlaceholders({
        contrato,
        imovel: contrato.imoveis!,
        proprietario,
        pessoa: contrato.pessoas ?? null,
      });
      const clausulasGeradas: ClausulaDocumento[] = modelo.clausulas.map((c) => ({
        id: c.id,
        titulo: c.titulo ? substituirPlaceholders(c.titulo, valores) : c.titulo,
        texto: substituirPlaceholders(c.texto, valores),
      }));

      const { data, error } = await supabase
        .from("contratos_gerados")
        .insert({ contrato_id: id, modelo_id: modeloId, clausulas: clausulasGeradas })
        .select("*")
        .single<ContratoGerado>();
      if (error) throw new Error(error.message);
      setGerado(data);
      setClausulas(data.clausulas);
      sessionStorage.removeItem(draftKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar documento.");
    } finally {
      setPending(false);
    }
  }

  async function salvarAlteracoes() {
    if (!gerado) return;
    setPending(true);
    setError(null);
    try {
      const { error } = await supabase.from("contratos_gerados").update({ clausulas }).eq("id", gerado.id);
      if (error) throw new Error(error.message);
      sessionStorage.removeItem(draftKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar alterações.");
    } finally {
      setPending(false);
    }
  }

  function handleClausulasChange(next: ClausulaDocumento[]) {
    setClausulas(next);
    sessionStorage.setItem(draftKey, JSON.stringify(next));
  }

  async function exportarPDF() {
    setExportando("pdf");
    setError(null);
    try {
      const letterheadDataUrl = await fetchLetterheadDataUrl();
      const blob = gerarContratoPdfBlob(clausulas, { letterheadDataUrl, cabecalho });
      const fileName = `CONTRATO${contrato?.numero_contrato ? " " + contrato.numero_contrato.replace("/", "-") : ""}.pdf`;
      await salvarArquivoNoDrive(blob, fileName);
      downloadBlob(blob, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar PDF.");
    } finally {
      setExportando(null);
    }
  }

  async function exportarWord() {
    setExportando("docx");
    setError(null);
    try {
      const letterheadDataUrl = await fetchLetterheadDataUrl();
      await exportContratoDocx(clausulas, { numeroContrato: contrato?.numero_contrato, letterheadDataUrl, cabecalho });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar Word.");
    } finally {
      setExportando(null);
    }
  }

  async function enviarAssinatura() {
    if (!gerado || !contrato) return;
    setAssinaturaPending(true);
    setError(null);
    try {
      const proprietario = contrato.imoveis?.proprietarios;
      const pessoa = contrato.pessoas;
      if (!proprietario?.email) throw new Error("O proprietário não tem e-mail cadastrado.");
      if (!pessoa) throw new Error("Este contrato não tem inquilino/comprador vinculado.");
      if (!pessoa.email) throw new Error("O inquilino/comprador não tem e-mail cadastrado.");

      const letterheadDataUrl = await fetchLetterheadDataUrl();
      const pdfBase64 = gerarContratoPdfBase64(clausulas, { letterheadDataUrl, cabecalho });
      const fileName = `contrato${contrato.numero_contrato ? "-" + contrato.numero_contrato.replace("/", "-") : ""}.pdf`;

      const resultado = await enviarParaAssinatura(pdfBase64, fileName, [
        { nome: proprietario.nome, email: proprietario.email },
        { nome: pessoa.nome, email: pessoa.email },
      ]);

      const { data, error } = await supabase
        .from("contratos_gerados")
        .update({
          assinafy_document_id: resultado.documentId,
          assinafy_assignment_id: resultado.assignmentId,
          assinafy_status: resultado.status,
        })
        .eq("id", gerado.id)
        .select("*")
        .single<ContratoGerado>();
      if (error) throw new Error(error.message);
      setGerado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar para assinatura.");
    } finally {
      setAssinaturaPending(false);
    }
  }

  async function atualizarStatusAssinatura() {
    if (!gerado?.assinafy_document_id) return;
    setAssinaturaPending(true);
    setError(null);
    try {
      const status = await consultarStatusAssinatura(gerado.assinafy_document_id);
      const { data, error } = await supabase
        .from("contratos_gerados")
        .update({ assinafy_status: status.status, assinafy_resumo: status.resumo })
        .eq("id", gerado.id)
        .select("*")
        .single<ContratoGerado>();
      if (error) throw new Error(error.message);
      setGerado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar status.");
    } finally {
      setAssinaturaPending(false);
    }
  }

  async function baixarAssinado() {
    if (!gerado?.assinafy_document_id) return;
    setAssinaturaPending(true);
    setError(null);
    try {
      const fileName = `contrato${contrato?.numero_contrato ? "-" + contrato.numero_contrato.replace("/", "-") : ""}-assinado.pdf`;
      const blob = await obterDocumentoAssinado(gerado.assinafy_document_id, "certificated");
      await salvarArquivoNoDrive(blob, fileName);
      downloadBlob(blob, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar documento assinado.");
    } finally {
      setAssinaturaPending(false);
    }
  }

  function driveOptions(): DriveUploadOptions {
    const owner = contrato?.imoveis?.proprietarios?.nome ?? "SEM PROPRIETARIO";
    const address = contrato?.imoveis ? enderecoImovel(contrato.imoveis) : "SEM ENDERECO";
    const number = contrato?.numero_contrato ?? "SEM NUMERO";
    const person = contrato?.pessoas?.nome ?? "SEM PESSOA";
    const year = contrato?.data_inicio?.slice(0, 4) ?? new Date().getFullYear().toString();
    if (contrato?.tipo === "venda") return { category: "contrato_venda", folders: [year, `${number} - ${person} - ${address}`] };
    if (contrato?.tipo === "administracao") return { category: "contrato_locacao", folders: ["IMOVEIS ADMINISTRADOS", owner, address, number] };
    return { category: "contrato_locacao", folders: ["LOCACOES AVULSAS", year, `${number} - ${person} - ${address}`] };
  }

  async function salvarArquivoNoDrive(blob: Blob, fileName: string) {
    if (!gerado) throw new Error("Gere o documento antes de salvá-lo.");
    const uploaded = await uploadDriveFile(new File([blob], fileName, { type: blob.type || "application/pdf" }), { ...driveOptions(), fileName });
    const { data, error } = await supabase.from("contratos_gerados").update({
      drive_file_id: uploaded.id, drive_file_name: uploaded.name, drive_mime_type: uploaded.mimeType, drive_file_size: Number(uploaded.size),
    }).eq("id", gerado.id).select("*").single<ContratoGerado>();
    if (error) { await deleteDriveFile(uploaded.id, driveOptions().category); throw new Error(error.message); }
    const previousId = gerado.drive_file_id;
    setGerado(data);
    if (previousId && previousId !== uploaded.id) await deleteDriveFile(previousId, driveOptions().category);
  }

  if (contrato === undefined || gerado === undefined) return <LoadingState />;
  if (contrato === null) return <p className="text-sm text-slate-500">Contrato não encontrado.</p>;

  const cabecalho: CabecalhoDocumento | undefined = gerado
    ? {
        numeroContrato: contrato.numero_contrato,
        data: gerado.created_at,
        tipoImovel: contrato.imoveis?.tipo_imovel ?? null,
        tipoOperacao: contrato.tipo,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title={`Documento do contrato — ${imovelLabel(contrato.imoveis!, contrato)}`} />

      {!gerado ? (
        <Card className="p-6 max-w-xl">
          {modelos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum modelo de contrato cadastrado para o tipo "{contrato.tipo}". Cadastre um em Modelos de Contrato.
            </p>
          ) : (
            <div className="space-y-4">
              <Field label="Modelo de contrato" htmlFor="modelo_id">
                <Select id="modelo_id" value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              {error && <ErrorState message={error} />}
              <Button type="button" onClick={gerarDocumento} disabled={pending}>
                {pending ? "Gerando..." : "Gerar documento"}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="flex gap-3 print:hidden">
            <Button type="button" onClick={salvarAlteracoes} disabled={pending}>
              {pending ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button type="button" variant="secondary" onClick={exportarPDF} disabled={exportando !== null}>
              {exportando === "pdf" ? "Salvando no Drive..." : "Exportar PDF e salvar no Drive"}
            </Button>
            <Button type="button" variant="secondary" onClick={exportarWord} disabled={exportando !== null}>
              {exportando === "docx" ? "Exportando..." : "Exportar Word"}
            </Button>
            {gerado.drive_file_id && gerado.drive_file_name && (
              <Button type="button" variant="secondary" onClick={() => downloadDriveFile(gerado.drive_file_id!, gerado.drive_file_name!, gerado.drive_mime_type)}>
                Baixar arquivo salvo no Drive
              </Button>
            )}
          </div>
          {error && <ErrorState message={error} />}

          <Card className="p-5 print:hidden">
            <h2 className="font-medium text-slate-900 mb-3">Assinatura digital</h2>
            {!gerado.assinafy_document_id ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">
                  Envia este PDF para o proprietário e o inquilino/comprador assinarem digitalmente (via Assinafy).
                </p>
                <Button type="button" onClick={enviarAssinatura} disabled={assinaturaPending}>
                  {assinaturaPending ? "Enviando..." : "Enviar para assinatura"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <div>
                  <Badge color={gerado.assinafy_status === "certificated" ? "green" : "yellow"}>
                    {STATUS_LABEL[gerado.assinafy_status ?? ""] ?? gerado.assinafy_status}
                  </Badge>
                  {gerado.assinafy_resumo && (
                    <span className="ml-2 text-slate-500">
                      {gerado.assinafy_resumo.completed_count} de {gerado.assinafy_resumo.signer_count} assinaram
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={atualizarStatusAssinatura} disabled={assinaturaPending}>
                    {assinaturaPending ? "Atualizando..." : "Atualizar status"}
                  </Button>
                  {gerado.assinafy_status === "certificated" && (
                    <Button type="button" variant="secondary" onClick={baixarAssinado} disabled={assinaturaPending}>
                      Baixar assinado
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>

          <div className="print:hidden">
            <p className="text-sm font-medium text-slate-700 mb-2">Editar cláusulas</p>
            <ClausulasEditor clausulas={clausulas} onChange={handleClausulasChange} />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2 print:hidden">Pré-visualização</p>
            <Card className="print:shadow-none print:border-none">
              <DocumentoContratoView clausulas={clausulas} cabecalho={cabecalho} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
