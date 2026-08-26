import { FormEvent, useMemo, useState } from "react";
import { Card, Field, Input, Select, Textarea, Button, Label, ErrorState } from "@/components/ui";
import { CurrencyInput } from "@/components/CurrencyInput";
import { ImovelForm, type ImovelPayload } from "@/components/ImovelForm";
import { Modal } from "@/components/Modal";
import { PessoaForm, type PessoaPayload } from "@/components/PessoaForm";
import { todayISO, addMonthsISO, formatBRL, formatDate } from "@/lib/format";
import { imovelLabel } from "@/lib/imovelLabel";
import type { Contrato, Imovel, Pessoa, Proprietario } from "@/lib/types";
import { getDraftValue, parseBRLInput, upperOrNull, useFormDraft } from "@/lib/forms";
import { Plus } from "lucide-react";
import type { ProprietarioPayload } from "@/components/ProprietarioForm";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel (taxa única sobre o 1º aluguel)",
  administracao: "Administração (comissão mensal configurável)",
  venda: "Venda",
};

/** numero_contrato e data_ultima_visita são gerados/controlados pela página, não pelo formulário. */
export type ContratoPayload = Omit<
  Contrato,
  "id" | "created_at" | "imoveis" | "pessoas" | "numero_contrato" | "data_ultima_visita"
>;

export function ContratoForm({
  onSubmit,
  mode,
  imoveis,
  pessoas,
  imovelFixo,
  contratosAtivosPorImovel,
  defaultValues,
  proprietarios = [],
  onCreateImovel,
  onCreatePessoa,
  onCreateProprietario,
}: {
  onSubmit: (data: ContratoPayload) => Promise<void>;
  mode: "create" | "edit";
  imoveis: Imovel[];
  pessoas: Pessoa[];
  imovelFixo?: Imovel;
  contratosAtivosPorImovel?: Map<string, Contrato>;
  defaultValues?: Partial<Contrato>;
  proprietarios?: Proprietario[];
  onCreateImovel?: (data: ImovelPayload) => Promise<Imovel>;
  onCreatePessoa?: (data: PessoaPayload) => Promise<Pessoa>;
  onCreateProprietario?: (data: ProprietarioPayload) => Promise<Proprietario>;
}) {
  const draftId = `contrato:${defaultValues?.id ?? "novo"}`;
  const imovelInicial = imovelFixo ?? imoveis.find((i) => i.id === defaultValues?.imovel_id) ?? imoveis[0];
  const [imovelId, setImovelId] = useState(() => getDraftValue(draftId, "imovel_id", imovelInicial?.id ?? ""));
  const [formaComissao, setFormaComissao] = useState(() => getDraftValue(draftId, "forma_comissao_venda", defaultValues?.forma_comissao_venda ?? "percentual"));
  const [pessoaId, setPessoaId] = useState(() => getDraftValue(draftId, "pessoa_id", defaultValues?.pessoa_id ?? ""));
  const [valorAluguel, setValorAluguel] = useState<number | null>(() =>
    parseBRLInput(getDraftValue(draftId, "valor_aluguel_display", String(defaultValues?.valor_aluguel ?? ""))),
  );
  const [duracaoMeses, setDuracaoMeses] = useState<string | number>(() => getDraftValue(draftId, "duracao_meses", String(defaultValues?.duracao_meses ?? "")));
  const [dataInicio, setDataInicio] = useState(() => getDraftValue(draftId, "data_inicio", defaultValues?.data_inicio ?? todayISO()));
  const [recebimentoAluguel, setRecebimentoAluguel] = useState(() => getDraftValue(draftId, "recebimento_aluguel", defaultValues?.recebimento_aluguel ?? "imobiliaria"));
  const [modalImovel, setModalImovel] = useState(false);
  const [modalPessoa, setModalPessoa] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { formRef, saveDraft, clearDraft } = useFormDraft(draftId);

  const imovelSelecionado = imoveis.find((i) => i.id === imovelId) ?? imovelFixo;
  const tipo = mode === "edit" ? defaultValues?.tipo : imovelSelecionado?.tipo_operacao;
  const bloqueado = mode === "edit";

  const valorTotalEstimado = useMemo(() => {
    const v = valorAluguel ?? 0;
    const m = Number(duracaoMeses);
    if (!v || !m || tipo === "venda") return null;
    return v * m;
  }, [valorAluguel, duracaoMeses, tipo]);
  const vigenciaFinal = tipo !== "venda" && Number(duracaoMeses) > 0 ? addMonthsISO(dataInicio, Number(duracaoMeses)) : null;

  async function handleCreateImovel(data: ImovelPayload) {
    if (!onCreateImovel) return;
    const created = await onCreateImovel(data);
    setImovelId(created.id);
    setModalImovel(false);
  }

  async function handleCreatePessoa(data: PessoaPayload) {
    if (!onCreatePessoa) return;
    const created = await onCreatePessoa(data);
    setPessoaId(created.id);
    setModalPessoa(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);

    function num(key: string) {
      const v = formData.get(key);
      if (!v || v === "") return null;
      return Number(v);
    }

    const dataInicioPayload = String(formData.get("data_inicio"));
    const duracao = tipo !== "venda" ? num("duracao_meses") : null;

    try {
      await onSubmit({
        imovel_id: String(formData.get("imovel_id")),
        pessoa_id: (formData.get("pessoa_id") as string) || null,
        tipo: tipo as Contrato["tipo"],
        valor_aluguel: tipo !== "venda" ? num("valor_aluguel") : null,
        percentual_administracao: tipo === "administracao" ? num("percentual_administracao") : null,
        recebimento_aluguel: tipo === "administracao" ? formData.get("recebimento_aluguel") as Contrato["recebimento_aluguel"] : null,
        dia_pagamento: tipo !== "venda" ? num("dia_pagamento") : null,
        data_inicio: dataInicioPayload,
        duracao_meses: duracao,
        vigencia_final: duracao ? addMonthsISO(dataInicioPayload, duracao) : null,
        periodo_visita_dias: tipo !== "venda" ? num("periodo_visita_dias") : null,
        forma_comissao_venda: tipo === "venda" ? (String(formData.get("forma_comissao_venda")) as Contrato["forma_comissao_venda"]) : null,
        percentual_comissao: tipo === "venda" ? num("percentual_comissao") : null,
        valor_comissao_fixo: tipo === "venda" ? num("valor_comissao_fixo") : null,
        valor_venda: tipo === "venda" ? num("valor_venda") : null,
        status: (formData.get("status") as Contrato["status"]) || "ativo",
        observacoes: upperOrNull(formData.get("observacoes")),
      });
      clearDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
    <Card className="p-6 max-w-2xl">
      <form ref={formRef} onSubmit={handleSubmit} onInput={saveDraft} onChange={saveDraft} className="space-y-4">
        <input type="hidden" name="tipo" value={tipo ?? ""} />

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Label htmlFor="imovel_id" className="mb-0">Imóvel</Label>
            {!bloqueado && !imovelFixo && onCreateImovel && (
              <Button type="button" variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={() => setModalImovel(true)}>
                <Plus size={14} /> Cadastrar imóvel
              </Button>
            )}
          </div>
          {bloqueado || imovelFixo ? (
            <>
              <p className="text-sm text-slate-700 py-2">
                {imovelLabel(imovelFixo ?? imovelSelecionado!, contratosAtivosPorImovel?.get((imovelFixo ?? imovelSelecionado)!.id))} — {tipoLabel[tipo ?? ""]}
              </p>
              <input type="hidden" name="imovel_id" value={imovelFixo?.id ?? defaultValues?.imovel_id ?? ""} />
            </>
          ) : (
            <Select
              id="imovel_id"
              name="imovel_id"
              value={imovelId}
              onChange={(e) => setImovelId(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {imovelLabel(i, contratosAtivosPorImovel?.get(i.id))} — {tipoLabel[i.tipo_operacao]}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Label htmlFor="pessoa_id" className="mb-0">{tipo === "venda" ? "Comprador" : "Inquilino"}</Label>
            {onCreatePessoa && (
              <Button type="button" variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={() => setModalPessoa(true)}>
                <Plus size={14} /> Cadastrar pessoa
              </Button>
            )}
          </div>
          <Select id="pessoa_id" name="pessoa_id" required value={pessoaId} onChange={(event) => setPessoaId(event.target.value)}>
            <option value="">Selecione...</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </div>

        <div className={`grid grid-cols-1 gap-4 ${tipo !== "venda" ? "sm:grid-cols-2" : ""}`}>
          <Field label="Data de início" htmlFor="data_inicio">
            <Input id="data_inicio" name="data_inicio" type="date" required value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} />
          </Field>
          {tipo !== "venda" && (
            <Field label="Duração total (meses)" htmlFor="duracao_meses">
              <Input id="duracao_meses" name="duracao_meses" type="number" min={1} max={60} required value={duracaoMeses} onChange={(event) => setDuracaoMeses(event.target.value)} />
            </Field>
          )}
        </div>
        {vigenciaFinal && (
          <p className="-mt-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
            Término previsto do contrato: <strong>{formatDate(vigenciaFinal)}</strong>
          </p>
        )}

        {tipo !== "venda" && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CurrencyInput
                id="valor_aluguel"
                name="valor_aluguel"
                label="Valor do aluguel"
                required
                min={0}
                defaultValue={defaultValues?.valor_aluguel}
                draftId={draftId}
                onValueChange={setValorAluguel}
              />
              <Field label="Dia de pagamento" htmlFor="dia_pagamento">
                <Input
                  id="dia_pagamento"
                  name="dia_pagamento"
                  type="number"
                  min={1}
                  max={31}
                  required
                  defaultValue={defaultValues?.dia_pagamento ?? ""}
                />
              </Field>
            </div>
            {tipo === "administracao" && (
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
                <Field label="Comissão da imobiliária (%)" htmlFor="percentual_administracao">
                  <Input id="percentual_administracao" name="percentual_administracao" type="number" step="0.01" min="0.01" max="100" required defaultValue={defaultValues?.percentual_administracao ?? 10} />
                </Field>
                <Field label="Quem recebe o aluguel do inquilino?" htmlFor="recebimento_aluguel">
                  <Select id="recebimento_aluguel" name="recebimento_aluguel" value={recebimentoAluguel} onChange={(event) => setRecebimentoAluguel(event.target.value as Contrato["recebimento_aluguel"] & string)}>
                    <option value="imobiliaria">Imobiliária recebe e repassa</option>
                    <option value="proprietario">Proprietário recebe diretamente</option>
                  </Select>
                </Field>
                <p className="text-xs text-slate-500 sm:col-span-2">
                  {recebimentoAluguel === "imobiliaria"
                    ? "O sistema controla o aluguel recebido, desconta a comissão e calcula o repasse ao proprietário."
                    : "O sistema controla somente a comissão devida à imobiliária; não cria repasse do aluguel."}
                </p>
              </div>
            )}
            {valorTotalEstimado !== null && (
              <p className="text-xs text-slate-500 -mt-2">
                Valor total estimado do contrato: <span className="font-medium">{formatBRL(valorTotalEstimado)}</span>
              </p>
            )}
            <Field label="Período entre visitas ao imóvel (dias, opcional)" htmlFor="periodo_visita_dias">
              <Input
                id="periodo_visita_dias"
                name="periodo_visita_dias"
                type="number"
                min={1}
                placeholder="ex: 90"
                defaultValue={defaultValues?.periodo_visita_dias ?? ""}
              />
              <p className="text-xs text-slate-500 mt-1">
                O dashboard vai avisar com 48h de antecedência quando a próxima visita estiver perto.
              </p>
            </Field>
          </>
        )}

        {tipo === "venda" && (
          <>
            <CurrencyInput
              id="valor_venda"
              name="valor_venda"
              label="Valor da venda"
              required
              min={0}
              defaultValue={defaultValues?.valor_venda}
              draftId={draftId}
            />
            <div>
              <Label>Forma de comissão da imobiliária</Label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="forma_comissao_venda"
                    value="percentual"
                    checked={formaComissao === "percentual"}
                    onChange={() => setFormaComissao("percentual")}
                  />
                  Percentual
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="forma_comissao_venda"
                    value="fixo"
                    checked={formaComissao === "fixo"}
                    onChange={() => setFormaComissao("fixo")}
                  />
                  Valor fixo
                </label>
              </div>
            </div>
            {formaComissao === "percentual" ? (
              <Field label="Percentual de comissão (%)" htmlFor="percentual_comissao">
                <Input
                  id="percentual_comissao"
                  name="percentual_comissao"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  max="100"
                  placeholder="ex: 5"
                  defaultValue={defaultValues?.percentual_comissao ?? 5}
                />
              </Field>
            ) : (
              <CurrencyInput
                id="valor_comissao_fixo"
                name="valor_comissao_fixo"
                label="Valor fixo da comissão"
                required
                min={0.01}
                defaultValue={defaultValues?.valor_comissao_fixo}
                draftId={draftId}
              />
            )}
          </>
        )}

        {mode === "edit" && (
          <Field label="Status do contrato" htmlFor="status">
            <Select id="status" name="status" defaultValue={defaultValues?.status ?? "ativo"}>
              <option value="ativo">Ativo</option>
              <option value="renovado">Renovado</option>
              <option value="encerrado">Encerrado</option>
            </Select>
          </Field>
        )}

        <Field label="Observações" htmlFor="observacoes">
          <Textarea id="observacoes" name="observacoes" rows={3} defaultValue={defaultValues?.observacoes ?? ""} />
        </Field>

        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
      </form>
    </Card>
    <Modal open={modalImovel} title="Cadastrar imóvel durante o contrato" onClose={() => setModalImovel(false)}>
      <ImovelForm onSubmit={handleCreateImovel} proprietarios={proprietarios} onCreateProprietario={onCreateProprietario} />
    </Modal>
    <Modal open={modalPessoa} title={`Cadastrar ${tipo === "venda" ? "comprador" : "inquilino"}`} onClose={() => setModalPessoa(false)}>
      <PessoaForm onSubmit={handleCreatePessoa} />
    </Modal>
    </>
  );
}
