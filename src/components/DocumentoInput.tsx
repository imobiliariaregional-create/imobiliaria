import { useEffect, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { formatCPFCNPJ, getDraftValue, validateCPFCNPJ } from "@/lib/forms";
import type { TipoPessoa } from "@/lib/types";

export function DocumentoInput({
  id,
  name,
  tipo,
  defaultValue = "",
  label,
  required = true,
  draftId,
  onCNPJLookup,
}: {
  id: string;
  name: string;
  tipo: TipoPessoa;
  defaultValue?: string | null;
  label?: string;
  required?: boolean;
  draftId?: string;
  onCNPJLookup?: (cnpj: string) => Promise<void>;
}) {
  const [value, setValue] = useState(() => formatCPFCNPJ(draftId ? getDraftValue(draftId, name, defaultValue ?? "") : defaultValue ?? "", tipo));
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setValue((current) => formatCPFCNPJ(current, tipo));
  }, [tipo]);

  function validate(input: HTMLInputElement) {
    if (!input.value && !required) input.setCustomValidity("");
    else input.setCustomValidity(validateCPFCNPJ(input.value, tipo) ? "" : `${tipo === "juridica" ? "CNPJ" : "CPF"} inválido.`);
  }

  async function handleLookup() {
    if (!onCNPJLookup || !validateCPFCNPJ(value, "juridica")) return;
    setLookupPending(true);
    setLookupMessage(null);
    try {
      await onCNPJLookup(value);
      setLookupMessage({ type: "success", text: "Dados encontrados. Confira antes de salvar." });
    } catch (error) {
      setLookupMessage({ type: "error", text: error instanceof Error ? error.message : "Erro ao consultar CNPJ." });
    } finally {
      setLookupPending(false);
    }
  }

  return (
    <Field label={label ?? (tipo === "juridica" ? "CNPJ" : "CPF")} htmlFor={id}>
      <Input
        id={id}
        name={name}
        inputMode="numeric"
        required={required}
        maxLength={tipo === "juridica" ? 18 : 14}
        value={value}
        placeholder={tipo === "juridica" ? "00.000.000/0000-00" : "000.000.000-00"}
        onChange={(event) => {
          const formatted = formatCPFCNPJ(event.target.value, tipo);
          setValue(formatted);
          event.target.setCustomValidity("");
        }}
        onBlur={(event) => validate(event.currentTarget)}
        onInvalid={(event) => validate(event.currentTarget)}
      />
      {tipo === "juridica" && onCNPJLookup && (
        <div className="mt-2">
          <Button type="button" variant="secondary" className="min-h-8 px-3 py-1 text-xs" disabled={lookupPending || !validateCPFCNPJ(value, "juridica")} onClick={handleLookup}>
            {lookupPending ? "Consultando..." : "Consultar CNPJ"}
          </Button>
          {lookupMessage && (
            <p className={`mt-1.5 text-xs ${lookupMessage.type === "success" ? "text-emerald-700" : "text-red-600"}`}>
              {lookupMessage.text}
            </p>
          )}
        </div>
      )}
    </Field>
  );
}
