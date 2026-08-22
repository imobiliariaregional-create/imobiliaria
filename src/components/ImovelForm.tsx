import { FormEvent, useState } from "react";
import { Card, Field, Input, Select, Textarea, Button, Label, ErrorState } from "@/components/ui";
import type { Imovel, Proprietario } from "@/lib/types";

export type ImovelPayload = Omit<Imovel, "id" | "created_at" | "proprietarios">;

export function ImovelForm({
  onSubmit,
  defaultValues,
  proprietarios,
}: {
  onSubmit: (data: ImovelPayload) => Promise<void>;
  defaultValues?: Partial<Imovel>;
  proprietarios: Proprietario[];
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
        proprietario_id: (formData.get("proprietario_id") as string) || null,
        rua: String(formData.get("rua") ?? ""),
        numero: (formData.get("numero") as string) || null,
        bairro: (formData.get("bairro") as string) || null,
        cidade: (formData.get("cidade") as string) || null,
        uf: (formData.get("uf") as string) || null,
        cep: (formData.get("cep") as string) || null,
        tipo_operacao: String(formData.get("tipo_operacao") ?? "aluguel") as Imovel["tipo_operacao"],
        tipo_imovel: String(formData.get("tipo_imovel") ?? "residencial") as Imovel["tipo_imovel"],
        descricao: (formData.get("descricao") as string) || null,
        controla_agua: formData.get("controla_agua") === "on",
        controla_energia: formData.get("controla_energia") === "on",
        status: String(formData.get("status") ?? "disponivel") as Imovel["status"],
        observacoes: (formData.get("observacoes") as string) || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
      setPending(false);
    }
  }

  return (
    <Card className="p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="grid grid-cols-3 gap-4">
          <Field label="Tipo de operação" htmlFor="tipo_operacao">
            <Select id="tipo_operacao" name="tipo_operacao" defaultValue={defaultValues?.tipo_operacao ?? "aluguel"}>
              <option value="aluguel">Aluguel (taxa única)</option>
              <option value="administracao">Administração (10% mensal)</option>
              <option value="venda">Venda</option>
            </Select>
          </Field>
          <Field label="Tipo de imóvel" htmlFor="tipo_imovel">
            <Select id="tipo_imovel" name="tipo_imovel" defaultValue={defaultValues?.tipo_imovel ?? "residencial"}>
              <option value="residencial">Residencial</option>
              <option value="comercial">Comercial</option>
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

        <Field label="Descrição do imóvel (para contratos)" htmlFor="descricao">
          <Textarea
            id="descricao"
            name="descricao"
            rows={3}
            placeholder="Características do imóvel: cômodos, área, mobília, etc. Esse texto pode ser usado no modelo de contrato através do código #descricao_imovel."
            defaultValue={defaultValues?.descricao ?? ""}
          />
        </Field>

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

        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
      </form>
    </Card>
  );
}
