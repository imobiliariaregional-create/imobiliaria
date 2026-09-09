import { sanitizeClauseHtml, ensureClauseHtml } from "@/lib/richText";
import { linhasCabecalho, type CabecalhoDocumento } from "@/lib/contratoDocumento";

export function DocumentoContratoView({
  conteudo,
  cabecalho,
}: {
  conteudo: string;
  cabecalho?: CabecalhoDocumento;
}) {
  return (
    <div id="documento-contrato" className="bg-white p-10 max-w-3xl mx-auto space-y-5 text-sm leading-relaxed text-slate-900">
      {cabecalho && (
        <div className="text-right text-xs text-slate-600">
          {linhasCabecalho(cabecalho).map((linha) => (
            <p key={linha}>{linha}</p>
          ))}
        </div>
      )}
      <div
        className="clause-rich-content"
        dangerouslySetInnerHTML={{ __html: sanitizeClauseHtml(ensureClauseHtml(conteudo)) }}
      />
    </div>
  );
}
