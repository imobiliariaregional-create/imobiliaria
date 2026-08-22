import type { ClausulaDocumento } from "@/lib/types";

export function DocumentoContratoView({ clausulas }: { clausulas: ClausulaDocumento[] }) {
  return (
    <div id="documento-contrato" className="bg-white p-10 max-w-3xl mx-auto space-y-5 text-sm leading-relaxed text-slate-900">
      {clausulas.map((clausula) => (
        <div key={clausula.id}>
          {clausula.titulo && <p className="font-semibold mb-1">{clausula.titulo}</p>}
          <p className="whitespace-pre-wrap">{clausula.texto}</p>
        </div>
      ))}
    </div>
  );
}
