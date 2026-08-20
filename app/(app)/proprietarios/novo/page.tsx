import { PageHeader } from "@/components/ui";
import { ProprietarioForm } from "@/components/proprietario-form";
import { createProprietario } from "../actions";

export default function NovoProprietarioPage() {
  return (
    <div>
      <PageHeader title="Novo proprietário" />
      <ProprietarioForm action={createProprietario} />
    </div>
  );
}
