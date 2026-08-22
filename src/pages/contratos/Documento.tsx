import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Field, Select, Button, LoadingState, ErrorState } from "@/components/ui";
import { ClausulasEditor } from "@/components/ClausulasEditor";
import { DocumentoContratoView } from "@/components/DocumentoContratoView";
import { resolverPlaceholders, substituirPlaceholders } from "@/lib/placeholders";
import { imovelLabel } from "@/lib/imovelLabel";
import type { ClausulaDocumento, Contrato, ContratoGerado, ModeloContrato } from "@/lib/types";

export function ContratoDocumentoPage() {
  const { id } = useParams<{ id: string }>();

  const [contrato, setContrato] = useState<Contrato | null | undefined>(undefined);
  const [modelos, setModelos] = useState<ModeloContrato[]>([]);
  const [modeloId, setModeloId] = useState("");
  const [gerado, setGerado] = useState<ContratoGerado | null | undefined>(undefined);
  const [clausulas, setClausulas] = useState<ClausulaDocumento[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [contratoRes, geradoRes] = await Promise.all([
      supabase.from("contratos").select("*, imoveis(*, proprietarios(*)), pessoas(*)").eq("id", id).single<Contrato>(),
      supabase.from("contratos_gerados").select("*").eq("contrato_id", id).maybeSingle<ContratoGerado>(),
    ]);
    setContrato(contratoRes.data);
    setGerado(geradoRes.data ?? null);
    if (geradoRes.data) setClausulas(geradoRes.data.clausulas);

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
    const { error } = await supabase.from("contratos_gerados").update({ clausulas }).eq("id", gerado.id);
    setPending(false);
    if (error) setError(error.message);
  }

  if (contrato === undefined || gerado === undefined) return <LoadingState />;
  if (contrato === null) return <p className="text-sm text-slate-500">Contrato não encontrado.</p>;

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
          </div>
          {error && <ErrorState message={error} />}

          <div className="print:hidden">
            <p className="text-sm font-medium text-slate-700 mb-2">Editar cláusulas</p>
            <ClausulasEditor clausulas={clausulas} onChange={setClausulas} />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2 print:hidden">Pré-visualização</p>
            <Card className="print:shadow-none print:border-none">
              <DocumentoContratoView clausulas={clausulas} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
