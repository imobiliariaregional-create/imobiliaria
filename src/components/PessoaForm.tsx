import { FormEvent, useState } from "react";
import { Card, Field, Input, Button, Label, ErrorState } from "@/components/ui";
import type { Pessoa } from "@/lib/types";

export function PessoaForm({
  onSubmit,
  defaultValues,
}: {
  onSubmit: (data: Omit<Pessoa, "id" | "created_at">) => Promise<void>;
  defaultValues?: Partial<Pessoa>;
}) {
  const [tipoPessoa, setTipoPessoa] = useState<Pessoa["tipo_pessoa"]>(defaultValues?.tipo_pessoa ?? "fisica");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await onSubmit({
        nome: String(formData.get("nome") ?? ""),
        cpf_cnpj: (formData.get("cpf_cnpj") as string) || null,
        telefone: (formData.get("telefone") as string) || null,
        email: (formData.get("email") as string) || null,
        rg: (formData.get("rg") as string) || null,
        endereco: (formData.get("endereco") as string) || null,
        tipo_pessoa: tipoPessoa,
        representante_nome: tipoPessoa === "juridica" ? (formData.get("representante_nome") as string) || null : null,
        representante_cpf: tipoPessoa === "juridica" ? (formData.get("representante_cpf") as string) || null : null,
        representante_rg: tipoPessoa === "juridica" ? (formData.get("representante_rg") as string) || null : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
      setPending(false);
    }
  }

  return (
    <Card className="p-6 max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="CPF/CNPJ" htmlFor="cpf_cnpj">
            <Input id="cpf_cnpj" name="cpf_cnpj" defaultValue={defaultValues?.cpf_cnpj ?? ""} />
          </Field>
          <Field label="RG" htmlFor="rg">
            <Input id="rg" name="rg" defaultValue={defaultValues?.rg ?? ""} />
          </Field>
        </div>

        {tipoPessoa === "juridica" && (
          <div className="border border-slate-200 rounded-md p-4 space-y-4 bg-slate-50">
            <p className="text-xs font-medium text-slate-500 uppercase">Representante legal</p>
            <Field label="Nome do representante" htmlFor="representante_nome">
              <Input id="representante_nome" name="representante_nome" defaultValue={defaultValues?.representante_nome ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CPF do representante" htmlFor="representante_cpf">
                <Input id="representante_cpf" name="representante_cpf" defaultValue={defaultValues?.representante_cpf ?? ""} />
              </Field>
              <Field label="RG do representante" htmlFor="representante_rg">
                <Input id="representante_rg" name="representante_rg" defaultValue={defaultValues?.representante_rg ?? ""} />
              </Field>
            </div>
          </div>
        )}

        <Field label="Endereço" htmlFor="endereco">
          <Input id="endereco" name="endereco" defaultValue={defaultValues?.endereco ?? ""} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
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
