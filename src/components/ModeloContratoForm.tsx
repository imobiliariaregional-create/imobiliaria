import { FormEvent, useState } from "react";
import { Card, Field, Input, Select, Button, ErrorState } from "@/components/ui";
import { ClausulasEditor } from "@/components/ClausulasEditor";
import { PLACEHOLDERS } from "@/lib/placeholders";
import type { ClausulaDocumento, ModeloContrato } from "@/lib/types";
import { upper, useFormDraft } from "@/lib/forms";

export type ModeloContratoPayload = Omit<ModeloContrato, "id" | "created_at">;

const categorias = ["Proprietário", "Inquilino/Comprador", "Imóvel", "Contrato"] as const;

export function ModeloContratoForm({
  onSubmit,
  defaultValues,
}: {
  onSubmit: (data: ModeloContratoPayload) => Promise<void>;
  defaultValues?: Partial<ModeloContrato>;
}) {
  const draftId = `modelo:${defaultValues?.id ?? "novo"}`;
  const clausulasKey = `imobiliaria:rascunho:${draftId}:clausulas`;
  const [clausulas, setClausulas] = useState<ClausulaDocumento[]>(() => {
    const saved = sessionStorage.getItem(clausulasKey);
    if (!saved) return defaultValues?.clausulas ?? [];
    try { return JSON.parse(saved) as ClausulaDocumento[]; } catch { return defaultValues?.clausulas ?? []; }
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { formRef, saveDraft, clearDraft } = useFormDraft(draftId);

  function handleClausulasChange(next: ClausulaDocumento[]) {
    setClausulas(next);
    sessionStorage.setItem(clausulasKey, JSON.stringify(next));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await onSubmit({
        nome: upper(formData.get("nome")),
        tipo_operacao: String(formData.get("tipo_operacao") ?? "aluguel") as ModeloContrato["tipo_operacao"],
        clausulas,
      });
      clearDraft();
      sessionStorage.removeItem(clausulasKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="p-6 xl:col-span-2">
        <form ref={formRef} onSubmit={handleSubmit} onInput={saveDraft} onChange={saveDraft} className="space-y-4">
          <Field label="Nome do modelo" htmlFor="nome">
            <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} placeholder="ex: Contrato de aluguel residencial" />
          </Field>
          <Field label="Tipo de operação" htmlFor="tipo_operacao">
            <Select id="tipo_operacao" name="tipo_operacao" defaultValue={defaultValues?.tipo_operacao ?? "aluguel"}>
              <option value="aluguel">Aluguel</option>
              <option value="administracao">Administração</option>
              <option value="venda">Venda</option>
            </Select>
          </Field>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Cláusulas do modelo</p>
            <ClausulasEditor clausulas={clausulas} onChange={handleClausulasChange} />
          </div>

          {error && <ErrorState message={error} />}
          <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar modelo"}</Button>
        </form>
      </Card>

      <Card className="p-6 h-fit sticky top-4">
        <p className="text-sm font-medium text-slate-900 mb-3">Códigos disponíveis</p>
        <p className="text-xs text-slate-500 mb-4">
          Copie e cole os códigos abaixo dentro do texto das cláusulas. Eles serão substituídos automaticamente pelos dados reais na hora de gerar o contrato.
        </p>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {categorias.map((categoria) => (
            <div key={categoria}>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{categoria}</p>
              <ul className="space-y-1">
                {PLACEHOLDERS.filter((p) => p.categoria === categoria).map((p) => (
                  <li key={p.codigo} className="text-xs">
                    <code className="bg-slate-100 text-brand-700 px-1 py-0.5 rounded">{p.codigo}</code>
                    <span className="text-slate-500"> — {p.descricao}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
