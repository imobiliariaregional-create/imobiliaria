import { FormEvent, useState } from "react";
import { Card, Field, Input, Button, ErrorState } from "@/components/ui";
import type { Pessoa } from "@/lib/types";

export function PessoaForm({
  onSubmit,
  defaultValues,
}: {
  onSubmit: (data: Omit<Pessoa, "id" | "created_at">) => Promise<void>;
  defaultValues?: Partial<Pessoa>;
}) {
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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
      setPending(false);
    }
  }

  return (
    <Card className="p-6 max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome" htmlFor="nome">
          <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} />
        </Field>
        <Field label="CPF/CNPJ" htmlFor="cpf_cnpj">
          <Input id="cpf_cnpj" name="cpf_cnpj" defaultValue={defaultValues?.cpf_cnpj ?? ""} />
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
