import { Field, Input, Select } from "@/components/ui";
import type { EstadoCivil } from "@/lib/types";

const ESTADOS_CIVIS: EstadoCivil[] = [
  "SOLTEIRO(A)",
  "CASADO(A)",
  "DIVORCIADO(A)",
  "VIÚVO(A)",
  "SEPARADO(A)",
  "UNIÃO ESTÁVEL",
];

/** Qualificação civil usada na abertura dos contratos (só faz sentido para pessoa física). */
export function QualificacaoInputs({
  nacionalidade,
  estadoCivil,
  profissao,
}: {
  nacionalidade?: string | null;
  estadoCivil?: EstadoCivil | null;
  profissao?: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Field label="Nacionalidade" htmlFor="nacionalidade">
        <Input id="nacionalidade" name="nacionalidade" defaultValue={nacionalidade ?? "BRASILEIRO(A)"} />
      </Field>
      <Field label="Estado civil" htmlFor="estado_civil">
        <Select id="estado_civil" name="estado_civil" defaultValue={estadoCivil ?? ""}>
          <option value="">Selecione...</option>
          {ESTADOS_CIVIS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>
      </Field>
      <Field label="Profissão" htmlFor="profissao">
        <Input id="profissao" name="profissao" defaultValue={profissao ?? ""} />
      </Field>
    </div>
  );
}
