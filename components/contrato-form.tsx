"use client";

import { useState } from "react";
import { Card, Field, Input, Select, Textarea, Button, Label } from "@/components/ui";
import { todayISO } from "@/lib/format";
import type { Contrato, Imovel, Pessoa } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel (taxa única sobre o 1º aluguel)",
  administracao: "Administração (10% do aluguel todo mês)",
  venda: "Venda",
};

export function ContratoForm({
  action,
  mode,
  imoveis,
  pessoas,
  imovelFixo,
  defaultValues,
}: {
  action: (formData: FormData) => void;
  mode: "create" | "edit";
  imoveis: Imovel[];
  pessoas: Pessoa[];
  imovelFixo?: Imovel;
  defaultValues?: Partial<Contrato>;
}) {
  const imovelInicial = imovelFixo ?? imoveis.find((i) => i.id === defaultValues?.imovel_id) ?? imoveis[0];
  const [imovelId, setImovelId] = useState(imovelInicial?.id ?? "");
  const [formaComissao, setFormaComissao] = useState(defaultValues?.forma_comissao_venda ?? "percentual");

  const imovelSelecionado = imoveis.find((i) => i.id === imovelId) ?? imovelFixo;
  const tipo = mode === "edit" ? defaultValues?.tipo : imovelSelecionado?.tipo_operacao;
  const bloqueado = mode === "edit";

  return (
    <Card className="p-6 max-w-2xl">
      <form action={action} className="space-y-4">
        <input type="hidden" name="tipo" value={tipo ?? ""} />

        <Field label="Imóvel" htmlFor="imovel_id">
          {bloqueado || imovelFixo ? (
            <>
              <p className="text-sm text-slate-700 py-2">
                {(imovelFixo ?? imovelSelecionado)?.rua}, {(imovelFixo ?? imovelSelecionado)?.numero} — {tipoLabel[tipo ?? ""]}
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
                  {i.rua}, {i.numero} — {tipoLabel[i.tipo_operacao]}
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
            <Field label="Vigência final do contrato" htmlFor="vigencia_final">
              <Input
                id="vigencia_final"
                name="vigencia_final"
                type="date"
                required
                defaultValue={defaultValues?.vigencia_final ?? ""}
              />
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

        <Button type="submit">Salvar</Button>
      </form>
    </Card>
  );
}
