import { Field, Input } from "@/components/ui";
import { formatPhone, isValidPhone } from "@/lib/forms";

export function PhoneInput({
  id = "telefone",
  name = "telefone",
  label = "Telefone",
  defaultValue = "",
  required = false,
}: {
  id?: string;
  name?: string;
  label?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  function validate(input: HTMLInputElement) {
    const valid = (!input.value && !required) || isValidPhone(input.value);
    input.setCustomValidity(valid ? "" : "Informe o telefone no padrão (00) 00000-0000.");
  }

  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={required}
        maxLength={15}
        placeholder="(00) 00000-0000"
        defaultValue={formatPhone(defaultValue ?? "")}
        onInput={(event) => {
          event.currentTarget.value = formatPhone(event.currentTarget.value);
          event.currentTarget.setCustomValidity("");
        }}
        onBlur={(event) => validate(event.currentTarget)}
        onInvalid={(event) => validate(event.currentTarget)}
      />
    </Field>
  );
}
