"use client";

import { Card, Field, Input, Button } from "@/components/ui";
import type { Pessoa } from "@/lib/types";

export function PessoaForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => void;
  defaultValues?: Partial<Pessoa>;
}) {
  return (
    <Card className="p-6 max-w-xl">
      <form action={action} className="space-y-4">
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
        <Button type="submit">Salvar</Button>
      </form>
    </Card>
  );
}
