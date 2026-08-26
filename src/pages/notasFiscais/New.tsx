import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Field, Input, Select, Textarea, Button, ErrorState, LoadingState } from "@/components/ui";
import { formatBRL, formatMonth, todayISO } from "@/lib/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { Contrato, PagamentoMensal } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { upperOrNull, useFormDraft } from "@/lib/forms";
import { deleteDriveFile, uploadDriveFile } from "@/lib/googleDrive";

export function NovaNotaFiscalPage() {
  const { papel, perfilLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contratoIdParam = searchParams.get("contrato_id") ?? "";

  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [pagamentos, setPagamentos] = useState<PagamentoMensal[]>([]);
  const [pagamentoId, setPagamentoId] = useState("");
  const [contratoId, setContratoId] = useState(contratoIdParam);
  const [valorSugerido, setValorSugerido] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { formRef, saveDraft, clearDraft } = useFormDraft("nota-fiscal:nova");

  useEffect(() => {
    Promise.all([
      supabase.from("contratos").select("*, imoveis(*)").order("created_at", { ascending: false }).returns<Contrato[]>(),
      supabase.from("pagamentos_mensais").select("*, contratos(*, imoveis(*), pessoas(*))").order("mes_referencia", { ascending: false }).returns<PagamentoMensal[]>(),
    ]).then(([contratosRes, pagamentosRes]) => {
      setContratos(contratosRes.data ?? []);
      setPagamentos(pagamentosRes.data ?? []);
    });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    const numero = upperOrNull(formData.get("numero"));
    const valor = Number(formData.get("valor"));
    const data_emissao = String(formData.get("data_emissao"));
    const descricao = upperOrNull(formData.get("descricao"));
    const contrato_id = (formData.get("contrato_id") as string) || null;
    const pagamento_mensal_id = (formData.get("pagamento_mensal_id") as string) || null;
    const arquivo = formData.get("arquivo") as File | null;

    try {
      let uploaded: Awaited<ReturnType<typeof uploadDriveFile>> | null = null;
      if (arquivo && arquivo.size > 0) {
        const [ano, mes] = data_emissao.split("-");
        uploaded = await uploadDriveFile(arquivo, { category: "nota_fiscal", folders: [ano, mes], fileName: numero ? `NF ${numero}` : undefined });
      }

      const { error } = await supabase.from("notas_fiscais").insert({
        numero,
        valor,
        data_emissao,
        descricao,
        contrato_id,
        pagamento_mensal_id,
        arquivo_url: null,
        drive_file_id: uploaded?.id ?? null,
        drive_file_name: uploaded?.name ?? null,
        drive_mime_type: uploaded?.mimeType ?? null,
        drive_file_size: uploaded ? Number(uploaded.size) : null,
      });
      if (error) {
        if (uploaded) await deleteDriveFile(uploaded.id, "nota_fiscal");
        throw new Error(error.message);
      }

      clearDraft();
      navigate("/notas-fiscais");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setPending(false);
    }
  }

  if (contratos === null || perfilLoading) return <LoadingState />;
  if (papel !== "admin" && papel !== "financeiro") {
    return <ErrorState message="Seu perfil possui acesso somente de leitura às notas fiscais." />;
  }

  return (
    <div>
      <PageHeader title="Nova nota fiscal" />
      <Card className="p-6 max-w-xl">
        <form ref={formRef} onSubmit={handleSubmit} onInput={saveDraft} onChange={saveDraft} className="space-y-4">
          <Field label="Número da nota" htmlFor="numero">
            <Input id="numero" name="numero" />
          </Field>
          <Field label="Comissão/receita vinculada (opcional)" htmlFor="pagamento_mensal_id">
            <Select
              id="pagamento_mensal_id"
              name="pagamento_mensal_id"
              value={pagamentoId}
              onChange={(event) => {
                const id = event.target.value;
                const pagamento = pagamentos.find((item) => item.id === id);
                setPagamentoId(id);
                setValorSugerido(pagamento ? Number(pagamento.valor) : null);
                if (pagamento) setContratoId(pagamento.contrato_id);
              }}
            >
              <option value="">Lançamento manual</option>
              {pagamentos.map((pagamento) => (
                <option key={pagamento.id} value={pagamento.id}>
                  {formatMonth(pagamento.mes_referencia.slice(0, 7))} · {pagamento.contratos?.pessoas?.nome ?? "SEM CLIENTE"} · comissão {formatBRL(pagamento.valor)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CurrencyInput key={pagamentoId || "manual"} id="valor" name="valor" label="Valor da nota fiscal" required min={0} defaultValue={valorSugerido} draftId="nota-fiscal:nova" />
            <Field label="Data de emissão" htmlFor="data_emissao">
              <Input id="data_emissao" name="data_emissao" type="date" required defaultValue={todayISO()} />
            </Field>
          </div>
          <Field label="Contrato vinculado (opcional)" htmlFor="contrato_id">
            <Select id="contrato_id" name="contrato_id" value={contratoId} onChange={(event) => setContratoId(event.target.value)}>
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
          <Field label="Arquivo no Google Drive (PDF/imagem, opcional)" htmlFor="arquivo">
            <input type="file" id="arquivo" name="arquivo" accept=".pdf,image/*" className="text-sm" />
          </Field>
          {error && <ErrorState message={error} />}
          <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
        </form>
      </Card>
    </div>
  );
}
