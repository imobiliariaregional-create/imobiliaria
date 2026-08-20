import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Field, Input, Select, Textarea, Button, ErrorState, LoadingState } from "@/components/ui";
import { todayISO } from "@/lib/format";
import type { Contrato } from "@/lib/types";

export function NovaNotaFiscalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contratoIdParam = searchParams.get("contrato_id") ?? "";

  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("contratos")
      .select("*, imoveis(*)")
      .order("created_at", { ascending: false })
      .returns<Contrato[]>()
      .then(({ data }) => setContratos(data ?? []));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    const numero = (formData.get("numero") as string) || null;
    const valor = Number(formData.get("valor"));
    const data_emissao = String(formData.get("data_emissao"));
    const descricao = (formData.get("descricao") as string) || null;
    const contrato_id = (formData.get("contrato_id") as string) || null;
    const arquivo = formData.get("arquivo") as File | null;

    try {
      let arquivo_url: string | null = null;
      if (arquivo && arquivo.size > 0) {
        const nomeArquivo = `${Date.now()}-${arquivo.name}`;
        const { error: uploadError } = await supabase.storage
          .from("notas-fiscais")
          .upload(nomeArquivo, arquivo, { contentType: arquivo.type });
        if (uploadError) throw new Error(uploadError.message);
        arquivo_url = nomeArquivo;
      }

      const { error } = await supabase.from("notas_fiscais").insert({
        numero,
        valor,
        data_emissao,
        descricao,
        contrato_id,
        arquivo_url,
      });
      if (error) throw new Error(error.message);

      navigate("/notas-fiscais");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
      setPending(false);
    }
  }

  if (contratos === null) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Nova nota fiscal" />
      <Card className="p-6 max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Select id="contrato_id" name="contrato_id" defaultValue={contratoIdParam}>
              <option value="">Nenhum</option>
              {contratos.map((c) => (
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
          {error && <ErrorState message={error} />}
          <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
        </form>
      </Card>
    </div>
  );
}
