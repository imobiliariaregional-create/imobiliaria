import { useState } from "react";
import { Field, Input } from "@/components/ui";
import { formatCEP, getDraftValue, isValidCEP } from "@/lib/forms";

export function CEPInput({
  defaultValue = "",
  draftId,
  required = false,
}: {
  defaultValue?: string | null;
  draftId?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(() =>
    formatCEP(draftId ? getDraftValue(draftId, "cep", defaultValue ?? "") : defaultValue ?? ""),
  );

  function validate(input: HTMLInputElement) {
    const valid = (!input.value && !required) || isValidCEP(input.value);
    input.setCustomValidity(valid ? "" : "Informe o CEP no formato 00000-000.");
  }

  return (
    <Field label="CEP" htmlFor="cep">
      <Input
        id="cep"
        name="cep"
        inputMode="numeric"
        autoComplete="postal-code"
        required={required}
        maxLength={9}
        pattern="[0-9]{5}-[0-9]{3}"
        placeholder="00000-000"
        value={value}
        onChange={(event) => {
          setValue(formatCEP(event.target.value));
          event.target.setCustomValidity("");
        }}
        onBlur={(event) => validate(event.currentTarget)}
        onInvalid={(event) => validate(event.currentTarget)}
      />
    </Field>
  );
}
