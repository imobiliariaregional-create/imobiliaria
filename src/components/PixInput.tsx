import { useEffect, useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { formatPixKey, getDraftValue, inferPixType, isValidPixKey, type TipoChavePix } from "@/lib/forms";

export function PixInput({
  defaultValue = "",
  defaultType,
  draftId,
}: {
  defaultValue?: string | null;
  defaultType?: TipoChavePix | null;
  draftId: string;
}) {
  const initialType = defaultType ?? inferPixType(defaultValue ?? "");
  const [tipo, setTipo] = useState<TipoChavePix>(() => getDraftValue(draftId, "tipo_chave_pix", initialType));
  const [value, setValue] = useState(() => formatPixKey(getDraftValue(draftId, "chave_pix", defaultValue ?? ""), tipo));

  useEffect(() => setValue((current) => formatPixKey(current, tipo)), [tipo]);

  function validate(input: HTMLInputElement) {
    input.setCustomValidity(isValidPixKey(input.value, tipo) ? "" : "A chave PIX não corresponde ao tipo selecionado.");
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Tipo de chave PIX" htmlFor="tipo_chave_pix">
        <Select id="tipo_chave_pix" name="tipo_chave_pix" value={tipo} onChange={(event) => setTipo(event.target.value as TipoChavePix)}>
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
          <option value="telefone">Telefone</option>
          <option value="email">E-mail</option>
          <option value="aleatoria">Chave aleatória</option>
        </Select>
      </Field>
      <Field label="Chave PIX" htmlFor="chave_pix">
        <Input
          id="chave_pix"
          name="chave_pix"
          type={tipo === "email" ? "email" : "text"}
          inputMode={["cpf", "cnpj", "telefone"].includes(tipo) ? "numeric" : undefined}
          value={value}
          placeholder={tipo === "cpf" ? "000.000.000-00" : tipo === "cnpj" ? "00.000.000/0000-00" : tipo === "telefone" ? "(00) 00000-0000" : undefined}
          onChange={(event) => {
            setValue(formatPixKey(event.target.value, tipo));
            event.target.setCustomValidity("");
          }}
          onBlur={(event) => validate(event.currentTarget)}
          onInvalid={(event) => validate(event.currentTarget)}
        />
      </Field>
    </div>
  );
}
