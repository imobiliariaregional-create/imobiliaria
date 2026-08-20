import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { todayISO } from "@/lib/format";
import type { Contrato } from "@/lib/types";
import { createNotaFiscal } from "../actions";

export default async function NovaNotaFiscalPage({
  searchParams,
}: {
  searchParams: Promise<{ contrato_id?: string }>;
}) {
  const { contrato_id } = await searchParams;
  const supabase = await createClient();
  const { data: contratos } = await supabase
    .from("contratos")
    .select("*, imoveis(*)")
    .order("created_at", { ascending: false })
    .returns<Contrato[]>();

  return (
    <div>
      <PageHeader title="Nova nota fiscal" />
      <Card className="p-6 max-w-xl">
        <form action={createNotaFiscal} className="space-y-4">
          <Field label="Número da nota" htmlFor="numero">
            <Input id="numero" name="numero" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (R$)" htmlFor="valor">
              <Input id="valor" name="valor" type="number" step="0.01" min="0" required />
            </Field>
            <Field label="Data de emissão" htmlFor="data_emissao">
              <Input id="data_emissao" name="data_emissao" type="date" required defaultValue={todayISO()} />
            </Field>
          </div>
          <Field label="Contrato vinculado (opcional)" htmlFor="contrato_id">
            <Select id="contrato_id" name="contrato_id" defaultValue={contrato_id ?? ""}>
              <option value="">Nenhum</option>
              {(contratos ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.imoveis?.rua}, {c.imoveis?.numero} — {c.tipo}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição" htmlFor="descricao">
            <Textarea id="descricao" name="descricao" rows={3} />
          </Field>
          <Field label="Arquivo (PDF/imagem, opcional)" htmlFor="arquivo">
            <input type="file" id="arquivo" name="arquivo" accept=".pdf,image/*" className="text-sm" />
          </Field>
          <Button type="submit">Salvar</Button>
        </form>
      </Card>
    </div>
  );
}
