"use client";

import { Card, Field, Input, Select, Textarea, Button, Label } from "@/components/ui";
import type { Imovel, Proprietario } from "@/lib/types";

export function ImovelForm({
  action,
  defaultValues,
  proprietarios,
}: {
  action: (formData: FormData) => void;
  defaultValues?: Partial<Imovel>;
  proprietarios: Proprietario[];
}) {
  return (
    <Card className="p-6 max-w-2xl">
      <form action={action} className="space-y-4">
        <Field label="Proprietário" htmlFor="proprietario_id">
          <Select id="proprietario_id" name="proprietario_id" defaultValue={defaultValues?.proprietario_id ?? ""}>
            <option value="">Selecione...</option>
            {proprietarios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Rua" htmlFor="rua">
              <Input id="rua" name="rua" required defaultValue={defaultValues?.rua} />
            </Field>
          </div>
          <Field label="Número" htmlFor="numero">
            <Input id="numero" name="numero" defaultValue={defaultValues?.numero ?? ""} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Bairro" htmlFor="bairro">
            <Input id="bairro" name="bairro" defaultValue={defaultValues?.bairro ?? ""} />
          </Field>
          <Field label="Cidade" htmlFor="cidade">
            <Input id="cidade" name="cidade" defaultValue={defaultValues?.cidade ?? ""} />
          </Field>
          <Field label="UF" htmlFor="uf">
            <Input id="uf" name="uf" maxLength={2} defaultValue={defaultValues?.uf ?? ""} />
          </Field>
        </div>

        <Field label="CEP" htmlFor="cep">
          <Input id="cep" name="cep" defaultValue={defaultValues?.cep ?? ""} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de operação" htmlFor="tipo_operacao">
            <Select id="tipo_operacao" name="tipo_operacao" defaultValue={defaultValues?.tipo_operacao ?? "aluguel"}>
              <option value="aluguel">Aluguel (taxa única)</option>
              <option value="administracao">Administração (10% mensal)</option>
              <option value="venda">Venda</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={defaultValues?.status ?? "disponivel"}>
              <option value="disponivel">Disponível</option>
              <option value="ocupado">Ocupado</option>
              <option value="vendido">Vendido</option>
            </Select>
          </Field>
        </div>

        <div>
          <Label>Contas de consumo controladas neste imóvel</Label>
          <div className="flex gap-6 mt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="controla_agua" defaultChecked={defaultValues?.controla_agua} />
              Água
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="controla_energia" defaultChecked={defaultValues?.controla_energia} />
              Energia
            </label>
          </div>
        </div>

        <Field label="Observações" htmlFor="observacoes">
          <Textarea id="observacoes" name="observacoes" rows={3} defaultValue={defaultValues?.observacoes ?? ""} />
        </Field>

        <Button type="submit">Salvar</Button>
      </form>
    </Card>
  );
}
