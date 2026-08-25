import { FormEvent, useState } from "react";
import { Card, Field, Input, Button, Label, ErrorState } from "@/components/ui";
import type { Pessoa } from "@/lib/types";
import { DocumentoInput } from "@/components/DocumentoInput";
import { getDraftValue, upper, upperOrNull, useFormDraft, validateCPFCNPJ } from "@/lib/forms";

export function PessoaForm({
  onSubmit,
  defaultValues,
}: {
  onSubmit: (data: Omit<Pessoa, "id" | "created_at">) => Promise<void>;
  defaultValues?: Partial<Pessoa>;
}) {
  const draftId = `pessoa:${defaultValues?.id ?? "nova"}`;
  const [tipoPessoa, setTipoPessoa] = useState<Pessoa["tipo_pessoa"]>(() => getDraftValue(draftId, "tipo_pessoa_radio", defaultValues?.tipo_pessoa ?? "fisica"));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { formRef, saveDraft, clearDraft } = useFormDraft(draftId);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      if (!validateCPFCNPJ(String(formData.get("cpf_cnpj") ?? ""), tipoPessoa)) {
        throw new Error(`${tipoPessoa === "juridica" ? "CNPJ" : "CPF"} inválido.`);
      }
      const representanteCpf = String(formData.get("representante_cpf") ?? "");
      if (tipoPessoa === "juridica" && !validateCPFCNPJ(representanteCpf, "fisica")) {
        throw new Error("CPF do representante inválido.");
      }
      await onSubmit({
        nome: upper(formData.get("nome")),
        cpf_cnpj: (formData.get("cpf_cnpj") as string) || null,
        telefone: (formData.get("telefone") as string) || null,
        email: (formData.get("email") as string) || null,
        rg: tipoPessoa === "fisica" ? upperOrNull(formData.get("rg")) : null,
        endereco: upperOrNull(formData.get("endereco")),
        tipo_pessoa: tipoPessoa,
        representante_nome: tipoPessoa === "juridica" ? upperOrNull(formData.get("representante_nome")) : null,
        representante_cpf: tipoPessoa === "juridica" ? (formData.get("representante_cpf") as string) || null : null,
        representante_rg: tipoPessoa === "juridica" ? upperOrNull(formData.get("representante_rg")) : null,
      });
      clearDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-6 max-w-xl">
      <form ref={formRef} onSubmit={handleSubmit} onInput={saveDraft} onChange={saveDraft} className="space-y-4">
        <Field label="Nome / Razão social" htmlFor="nome">
          <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} />
        </Field>

        <div>
          <Label>Tipo de pessoa</Label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="tipo_pessoa_radio"
                value="fisica"
                checked={tipoPessoa === "fisica"}
                onChange={() => setTipoPessoa("fisica")}
              />
              Pessoa física
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="tipo_pessoa_radio"
                value="juridica"
                checked={tipoPessoa === "juridica"}
                onChange={() => setTipoPessoa("juridica")}
              />
              Pessoa jurídica
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocumentoInput id="cpf_cnpj" name="cpf_cnpj" tipo={tipoPessoa} defaultValue={defaultValues?.cpf_cnpj} draftId={draftId} />
          {tipoPessoa === "fisica" && <Field label="RG" htmlFor="rg">
            <Input id="rg" name="rg" defaultValue={defaultValues?.rg ?? ""} />
          </Field>}
        </div>

        {tipoPessoa === "juridica" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">Representante legal</p>
            <Field label="Nome do representante" htmlFor="representante_nome">
              <Input id="representante_nome" name="representante_nome" required defaultValue={defaultValues?.representante_nome ?? ""} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DocumentoInput id="representante_cpf" name="representante_cpf" tipo="fisica" label="CPF do representante" defaultValue={defaultValues?.representante_cpf} draftId={draftId} />
              <Field label="RG do representante" htmlFor="representante_rg">
                <Input id="representante_rg" name="representante_rg" defaultValue={defaultValues?.representante_rg ?? ""} />
              </Field>
            </div>
          </div>
        )}

        <Field label="Endereço" htmlFor="endereco">
          <Input id="endereco" name="endereco" defaultValue={defaultValues?.endereco ?? ""} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefone" htmlFor="telefone">
            <Input id="telefone" name="telefone" defaultValue={defaultValues?.telefone ?? ""} />
          </Field>
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
          </Field>
        </div>

        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
      </form>
    </Card>
  );
}
