import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Button, ErrorState, Field, Select } from "@/components/ui";
import type { ModeloContrato } from "@/lib/types";

/**
 * Escolhe um modelo, monta o texto com os códigos já trocados (resolver) e deixa
 * revisar antes de salvar. Quem chama decide o que "salvar" faz (PDF no Drive,
 * registro de aditivo etc.).
 */
export function GerarDocumentoModal({
  open,
  titulo,
  carregarModelos,
  resolver,
  aviso,
  rotuloSalvar = "Salvar documento",
  onSalvar,
  onClose,
}: {
  open: boolean;
  titulo: string;
  carregarModelos: () => Promise<ModeloContrato[]>;
  resolver: (conteudoModelo: string) => Promise<string>;
  aviso?: React.ReactNode;
  rotuloSalvar?: string;
  onSalvar: (conteudoFinal: string, modelo: ModeloContrato) => Promise<void>;
  onClose: () => void;
}) {
  const [modelos, setModelos] = useState<ModeloContrato[] | null>(null);
  const [modeloId, setModeloId] = useState("");
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setModelos(null);
    setConteudo(null);
    setError(null);
    carregarModelos()
      .then((lista) => {
        setModelos(lista);
        setModeloId(lista[0]?.id ?? "");
      })
      .catch((err) => {
        setModelos([]);
        setError(err instanceof Error ? err.message : "Erro ao carregar modelos.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const modelo = modelos?.find((m) => m.id === modeloId);

  async function gerarTexto() {
    if (!modelo) return;
    setPending(true);
    setError(null);
    try {
      setConteudo(await resolver(modelo.conteudo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar o texto.");
    } finally {
      setPending(false);
    }
  }

  async function salvar() {
    if (!modelo || conteudo === null) return;
    setPending(true);
    setError(null);
    try {
      await onSalvar(conteudo, modelo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} title={titulo} onClose={() => !pending && onClose()}>
      <div className="space-y-4">
        {aviso && <div className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">{aviso}</div>}
        {modelos === null ? (
          <p className="text-sm text-slate-500">Carregando modelos...</p>
        ) : modelos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum modelo ativo dessa categoria. Cadastre ou restaure um em Modelos de Contrato.</p>
        ) : conteudo === null ? (
          <>
            <Field label="Modelo" htmlFor="gerar_modelo_id">
              <Select id="gerar_modelo_id" value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </Select>
            </Field>
            <Button type="button" onClick={gerarTexto} disabled={pending || !modelo}>
              {pending ? "Gerando..." : "Gerar texto para revisar"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500">Revise e ajuste o texto antes de salvar.</p>
            <div className="max-h-[55vh] overflow-y-auto">
              <RichTextEditor value={conteudo} onChange={setConteudo} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConteudo(null)} disabled={pending}>Voltar</Button>
              <Button type="button" onClick={salvar} disabled={pending}>{pending ? "Salvando..." : rotuloSalvar}</Button>
            </div>
          </>
        )}
        {error && <ErrorState message={error} />}
      </div>
    </Modal>
  );
}
