import { PageHeader } from "@/components/ui";
import { PessoaForm } from "@/components/pessoa-form";
import { createPessoa } from "../actions";

export default function NovaPessoaPage() {
  return (
    <div>
      <PageHeader title="Nova pessoa" />
      <PessoaForm action={createPessoa} />
    </div>
  );
}
