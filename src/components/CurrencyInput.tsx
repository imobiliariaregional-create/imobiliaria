import { useState } from "react";
import { Field, Input } from "@/components/ui";
import { formatBRL } from "@/lib/format";
import { getDraftValue, parseBRLInput } from "@/lib/forms";

function editableValue(value: number | null) {
  if (value === null) return "";
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

export function CurrencyInput({
  id,
  name,
  label,
  defaultValue,
  draftId,
  required = false,
  min = 0,
  onValueChange,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: number | null;
  draftId?: string;
  required?: boolean;
  min?: number;
  onValueChange?: (value: number | null) => void;
}) {
  const displayName = `${name}_display`;
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(() => {
    const draft = draftId ? getDraftValue(draftId, displayName, "") : "";
    return draft ? editableValue(parseBRLInput(draft)) : editableValue(defaultValue ?? null);
  });
  const value = parseBRLInput(raw);

  function validate(input: HTMLInputElement) {
    const valid = value !== null && value >= min;
    input.setCustomValidity(!raw && !required ? "" : valid ? "" : `Informe um valor igual ou maior que ${formatBRL(min)}.`);
  }

  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        name={displayName}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        placeholder="R$ 0,00"
        value={focused ? raw : value === null ? "" : formatBRL(value)}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d.,-]/g, "");
          setRaw(next);
          const parsed = parseBRLInput(next);
          onValueChange?.(parsed);
          event.target.setCustomValidity("");
        }}
        onBlur={(event) => {
          setFocused(false);
          setRaw(editableValue(value));
          validate(event.currentTarget);
        }}
        onInvalid={(event) => validate(event.currentTarget)}
      />
      <input type="hidden" name={name} value={value ?? ""} />
    </Field>
  );
}
