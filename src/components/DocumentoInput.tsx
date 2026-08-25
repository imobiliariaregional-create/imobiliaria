import { useEffect, useState } from "react";
import { Field, Input } from "@/components/ui";
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
}: {
  id: string;
  name: string;
  tipo: TipoPessoa;
  defaultValue?: string | null;
  label?: string;
  required?: boolean;
  draftId?: string;
}) {
  const [value, setValue] = useState(() => formatCPFCNPJ(draftId ? getDraftValue(draftId, name, defaultValue ?? "") : defaultValue ?? "", tipo));

  useEffect(() => {
    setValue((current) => formatCPFCNPJ(current, tipo));
  }, [tipo]);

  function validate(input: HTMLInputElement) {
    if (!input.value && !required) input.setCustomValidity("");
    else input.setCustomValidity(validateCPFCNPJ(input.value, tipo) ? "" : `${tipo === "juridica" ? "CNPJ" : "CPF"} inválido.`);
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
    </Field>
  );
}
