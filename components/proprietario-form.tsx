"use client";

import { Card, Field, Input, Textarea, Button } from "@/components/ui";
import type { Proprietario } from "@/lib/types";

export function ProprietarioForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => void;
  defaultValues?: Partial<Proprietario>;
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
        <Field label="Chave PIX" htmlFor="chave_pix">
          <Input id="chave_pix" name="chave_pix" defaultValue={defaultValues?.chave_pix ?? ""} />
        </Field>
        <Field label="Observações" htmlFor="observacoes">
          <Textarea id="observacoes" name="observacoes" rows={3} defaultValue={defaultValues?.observacoes ?? ""} />
        </Field>
        <Button type="submit">Salvar</Button>
      </form>
    </Card>
  );
}
