import { FormEvent, useState } from "react";
import { Card, Field, Input, Select, Button, Badge, ErrorState } from "@/components/ui";
import type { Proprietario } from "@/lib/types";
import { criarSubconta } from "@/lib/asaas";

const TIPOS_EMPRESA: { value: string; label: string }[] = [
  { value: "MEI", label: "MEI" },
  { value: "LIMITED", label: "Limitada (LTDA)" },
  { value: "INDIVIDUAL", label: "Empresário individual" },
  { value: "ASSOCIATION", label: "Associação/ONG" },
];

export function SubcontaAsaas({
  proprietario,
  onWalletCriada,
}: {
  proprietario: Proprietario;
  onWalletCriada: (walletId: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const resultado = await criarSubconta(proprietario.id, {
        postalCode: String(formData.get("postalCode") ?? ""),
        address: String(formData.get("address") ?? ""),
        addressNumber: String(formData.get("addressNumber") ?? ""),
        province: String(formData.get("province") ?? ""),
        incomeValue: Number(formData.get("incomeValue") ?? 0),
        birthDate: proprietario.tipo_pessoa === "fisica" ? String(formData.get("birthDate") ?? "") : undefined,
        companyType: proprietario.tipo_pessoa === "juridica" ? String(formData.get("companyType") ?? "") : undefined,
      });
      onWalletCriada(resultado.walletId);
      setMostrarFormulario(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar subconta.");
    } finally {
      setPending(false);
    }
  }

  if (proprietario.asaas_wallet_id) {
    return (
      <Card className="p-4 max-w-xl">
        <p className="text-xs font-medium text-slate-500 uppercase mb-2">Recebimento automático (Asaas)</p>
        <Badge color="green">Subconta ativa</Badge>
        <p className="text-sm text-slate-600 mt-2">
          Boletos de administração com repasse pela imobiliária vão dividir o valor automaticamente pra esse proprietário.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 max-w-xl">
      <p className="text-xs font-medium text-slate-500 uppercase mb-2">Recebimento automático (Asaas)</p>
      {!mostrarFormulario ? (
        <>
          <p className="text-sm text-slate-600 mb-3">
            Disponível só durante o período de avaliação do Asaas (máx. 10 subcontas no total) — use primeiro para
            proprietários de valores menores.
          </p>
          <Button type="button" variant="secondary" onClick={() => setMostrarFormulario(true)}>
            Criar subconta
          </Button>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CEP" htmlFor="postalCode">
              <Input id="postalCode" name="postalCode" required />
            </Field>
            <Field label="Rua" htmlFor="address">
              <Input id="address" name="address" required />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Número" htmlFor="addressNumber">
              <Input id="addressNumber" name="addressNumber" required />
            </Field>
            <Field label="Bairro" htmlFor="province">
              <Input id="province" name="province" required />
            </Field>
          </div>
          <Field label="Faturamento/renda mensal estimada (R$)" htmlFor="incomeValue">
            <Input id="incomeValue" name="incomeValue" type="number" step="0.01" min="0" required />
          </Field>
          {proprietario.tipo_pessoa === "fisica" ? (
            <Field label="Data de nascimento" htmlFor="birthDate">
              <Input id="birthDate" name="birthDate" type="date" required />
            </Field>
          ) : (
            <Field label="Tipo de empresa" htmlFor="companyType">
              <Select id="companyType" name="companyType" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {TIPOS_EMPRESA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>
          )}
          {error && <ErrorState message={error} />}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Criando..." : "Criar subconta"}</Button>
            <Button type="button" variant="secondary" onClick={() => setMostrarFormulario(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
