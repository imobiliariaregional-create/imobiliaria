import { FormEvent, useEffect, useState } from "react";
import { Card, Field, Input, Button, ErrorState } from "@/components/ui";
import { buscarDadosAdministradora, salvarDadosAdministradora, camposAdministradoraFaltando, type DadosAdministradora } from "@/lib/administradora";
import { upperOrNull } from "@/lib/forms";
import { useAuth } from "@/lib/auth";

const CAMPOS: { campo: keyof DadosAdministradora; rotulo: string; tipo?: string; maiusculo?: boolean; largo?: boolean }[] = [
  { campo: "adm_razao_social", rotulo: "Razão social", maiusculo: true, largo: true },
  { campo: "adm_cnpj", rotulo: "CNPJ" },
  { campo: "adm_creci", rotulo: "CRECI", maiusculo: true },
  { campo: "adm_endereco", rotulo: "Endereço da sede", maiusculo: true, largo: true },
  { campo: "adm_email", rotulo: "E-mail", tipo: "email" },
  { campo: "adm_telefone", rotulo: "Telefone" },
  { campo: "adm_representante_nome", rotulo: "Representante legal (quem assina)", maiusculo: true, largo: true },
  { campo: "adm_representante_cpf", rotulo: "CPF do representante" },
  { campo: "adm_representante_cargo", rotulo: "Cargo do representante", maiusculo: true },
];

/** Dados da imobiliária usados nos códigos #..._administradora dos modelos. */
export function DadosImobiliariaCard() {
  const { papel } = useAuth();
  const podeEditar = papel === "admin";
  const [dados, setDados] = useState<DadosAdministradora | null | undefined>(undefined);
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buscarDadosAdministradora()
      .then(setDados)
      .catch((err) => {
        setDados(null);
        setError(err instanceof Error ? err.message : "Erro ao carregar os dados da imobiliária.");
      });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSalvo(false);
    const form = new FormData(e.currentTarget);
    const novo = Object.fromEntries(
      CAMPOS.map(({ campo, maiusculo }) => {
        const valor = form.get(campo);
        return [campo, maiusculo ? upperOrNull(valor) : String(valor ?? "").trim() || null];
      }),
    ) as DadosAdministradora;
    try {
      await salvarDadosAdministradora(novo);
      setDados(novo);
      setSalvo(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setPending(false);
    }
  }

  const faltando = dados === undefined ? [] : camposAdministradoraFaltando(dados);

  return (
    <Card className="p-5 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-900 mb-1">Dados da imobiliária (ADMINISTRADORA)</h2>
          <p className="text-sm text-slate-500">
            Preenchem os códigos <code className="bg-slate-100 px-1 rounded">#nome_administradora</code>, <code className="bg-slate-100 px-1 rounded">#cnpj_administradora</code> e
            os demais da categoria "Administradora" nos modelos.
          </p>
          {dados !== undefined && faltando.length > 0 && (
            <p className="mt-2 text-sm font-medium text-amber-700">Faltam: {faltando.join(", ")}.</p>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Fechar" : podeEditar ? "Ver e editar" : "Ver dados"}
        </Button>
      </div>

      {aberto && dados !== undefined && (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CAMPOS.map(({ campo, rotulo, tipo, largo }) => (
            <div key={campo} className={largo ? "sm:col-span-2" : undefined}>
              <Field label={rotulo} htmlFor={campo}>
                <Input id={campo} name={campo} type={tipo ?? "text"} defaultValue={dados?.[campo] ?? ""} disabled={!podeEditar} />
              </Field>
            </div>
          ))}
          {error && <div className="sm:col-span-2"><ErrorState message={error} /></div>}
          {podeEditar ? (
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar dados da imobiliária"}</Button>
              {salvo && <span className="text-sm text-brand-700">Dados salvos.</span>}
            </div>
          ) : (
            <p className="sm:col-span-2 text-sm text-slate-500">Somente administradores podem alterar estes dados.</p>
          )}
        </form>
      )}
      {!aberto && error && <ErrorState message={error} />}
    </Card>
  );
}
