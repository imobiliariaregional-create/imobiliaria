import type { ClausulaDocumento } from "@/lib/types";
import { sanitizeClauseHtml, ensureClauseHtml } from "@/lib/richText";
import { linhasCabecalho, tituloDocumento, type CabecalhoDocumento } from "@/lib/contratoDocumento";

export function DocumentoContratoView({
  clausulas,
  cabecalho,
}: {
  clausulas: ClausulaDocumento[];
  cabecalho?: CabecalhoDocumento;
}) {
  return (
    <div id="documento-contrato" className="bg-white p-10 max-w-3xl mx-auto space-y-5 text-sm leading-relaxed text-slate-900">
      {cabecalho && (
        <div className="space-y-4">
          <div className="text-right text-xs text-slate-600">
            {linhasCabecalho(cabecalho).map((linha) => (
              <p key={linha}>{linha}</p>
            ))}
          </div>
          <p className="text-center font-bold">{tituloDocumento(cabecalho.tipoOperacao)}</p>
        </div>
      )}
      {clausulas.map((clausula) => (
        <div key={clausula.id}>
          {clausula.titulo && <p className="font-semibold mb-1">{clausula.titulo}</p>}
          <div
            className="clause-rich-content"
            dangerouslySetInnerHTML={{ __html: sanitizeClauseHtml(ensureClauseHtml(clausula.texto)) }}
          />
        </div>
      ))}
    </div>
  );
}
