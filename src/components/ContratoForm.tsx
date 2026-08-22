import { FormEvent, useMemo, useState } from "react";
import { Card, Field, Input, Select, Textarea, Button, Label, ErrorState } from "@/components/ui";
import { todayISO, addMonthsISO, formatBRL } from "@/lib/format";
import { imovelLabel } from "@/lib/imovelLabel";
import type { Contrato, Imovel, Pessoa } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel (taxa única sobre o 1º aluguel)",
  administracao: "Administração (10% do aluguel todo mês)",
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
}: {
  onSubmit: (data: ContratoPayload) => Promise<void>;
  mode: "create" | "edit";
  imoveis: Imovel[];
  pessoas: Pessoa[];
  imovelFixo?: Imovel;
  contratosAtivosPorImovel?: Map<string, Contrato>;
  defaultValues?: Partial<Contrato>;
}) {
  const imovelInicial = imovelFixo ?? imoveis.find((i) => i.id === defaultValues?.imovel_id) ?? imoveis[0];
  const [imovelId, setImovelId] = useState(imovelInicial?.id ?? "");
  const [formaComissao, setFormaComissao] = useState(defaultValues?.forma_comissao_venda ?? "percentual");
  const [valorAluguel, setValorAluguel] = useState(defaultValues?.valor_aluguel ?? "");
  const [duracaoMeses, setDuracaoMeses] = useState(defaultValues?.duracao_meses ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imovelSelecionado = imoveis.find((i) => i.id === imovelId) ?? imovelFixo;
  const tipo = mode === "edit" ? defaultValues?.tipo : imovelSelecionado?.tipo_operacao;
  const bloqueado = mode === "edit";

  const valorTotalEstimado = useMemo(() => {
    const v = Number(valorAluguel);
    const m = Number(duracaoMeses);
    if (!v || !m || tipo === "venda") return null;
    return v * m;
  }, [valorAluguel, duracaoMeses, tipo]);

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

    const dataInicio = String(formData.get("data_inicio"));
    const duracao = tipo !== "venda" ? num("duracao_meses") : null;

    try {
      await onSubmit({
        imovel_id: String(formData.get("imovel_id")),
        pessoa_id: (formData.get("pessoa_id") as string) || null,
        tipo: tipo as Contrato["tipo"],
        valor_aluguel: tipo !== "venda" ? num("valor_aluguel") : null,
        dia_pagamento: tipo !== "venda" ? num("dia_pagamento") : null,
        data_inicio: dataInicio,
        duracao_meses: duracao,
        vigencia_final: duracao ? addMonthsISO(dataInicio, duracao) : null,
        periodo_visita_dias: tipo !== "venda" ? num("periodo_visita_dias") : null,
        forma_comissao_venda: tipo === "venda" ? (String(formData.get("forma_comissao_venda")) as Contrato["forma_comissao_venda"]) : null,
        percentual_comissao: tipo === "venda" ? num("percentual_comissao") : null,
        valor_comissao_fixo: tipo === "venda" ? num("valor_comissao_fixo") : null,
        valor_venda: tipo === "venda" ? num("valor_venda") : null,
        status: (formData.get("status") as Contrato["status"]) || "ativo",
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
        <input type="hidden" name="tipo" value={tipo ?? ""} />

        <Field label="Imóvel" htmlFor="imovel_id">
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
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {imovelLabel(i, contratosAtivosPorImovel?.get(i.id))} — {tipoLabel[i.tipo_operacao]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={tipo === "venda" ? "Comprador" : "Inquilino"} htmlFor="pessoa_id">
          <Select id="pessoa_id" name="pessoa_id" defaultValue={defaultValues?.pessoa_id ?? ""}>
            <option value="">Selecione...</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Data de início" htmlFor="data_inicio">
          <Input
            id="data_inicio"
            name="data_inicio"
            type="date"
            required
            defaultValue={defaultValues?.data_inicio ?? todayISO()}
          />
        </Field>

        {tipo !== "venda" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Valor do aluguel (R$)" htmlFor="valor_aluguel">
                <Input
                  id="valor_aluguel"
                  name="valor_aluguel"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={defaultValues?.valor_aluguel ?? ""}
                  onChange={(e) => setValorAluguel(e.target.value)}
                />
              </Field>
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
              <p className="text-xs text-slate-500 -mt-2">
                A imobiliária recebe 10% desse valor todo mês, gerado automaticamente até a vigência final.
              </p>
            )}
            <Field label="Duração (meses)" htmlFor="duracao_meses">
              <Input
                id="duracao_meses"
                name="duracao_meses"
                type="number"
                min={1}
                required
                defaultValue={defaultValues?.duracao_meses ?? ""}
                onChange={(e) => setDuracaoMeses(e.target.value)}
              />
            </Field>
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
            <Field label="Valor da venda (R$)" htmlFor="valor_venda">
              <Input
                id="valor_venda"
                name="valor_venda"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={defaultValues?.valor_venda ?? ""}
              />
            </Field>
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
                  min="0"
                  max="100"
                  placeholder="ex: 5"
                  defaultValue={defaultValues?.percentual_comissao ?? 5}
                />
              </Field>
            ) : (
              <Field label="Valor fixo da comissão (R$)" htmlFor="valor_comissao_fixo">
                <Input
                  id="valor_comissao_fixo"
                  name="valor_comissao_fixo"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={defaultValues?.valor_comissao_fixo ?? ""}
                />
              </Field>
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
  );
}
