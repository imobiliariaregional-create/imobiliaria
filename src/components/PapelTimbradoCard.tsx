import { useEffect, useState } from "react";
import { Card, Button, ErrorState } from "@/components/ui";
import { getLetterheadUrl, uploadLetterhead, removeLetterhead } from "@/lib/letterhead";

export function PapelTimbradoCard() {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    getLetterheadUrl().then(setUrl);
  }

  useEffect(reload, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      await uploadLetterhead(file);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setPending(false);
      e.target.value = "";
    }
  }

  async function handleRemove() {
    setPending(true);
    setError(null);
    try {
      await removeLetterhead();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover imagem.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5 mb-6">
      <h2 className="font-medium text-slate-900 mb-1">Papel timbrado</h2>
      <p className="text-sm text-slate-500 mb-3">
        Imagem de fundo (tamanho A4) usada ao exportar contratos em PDF e Word. Deixe espaço em branco no meio da
        imagem para o texto do contrato.
      </p>
      {url ? (
        <div className="flex items-start gap-4">
          <img src={url} alt="Papel timbrado atual" className="w-32 border border-slate-200 rounded" />
          <div className="space-y-2">
            <label className="inline-block">
              <span className="text-sm text-brand-700 hover:underline cursor-pointer">Substituir imagem</span>
              <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" disabled={pending} />
            </label>
            <div>
              <Button type="button" variant="danger" onClick={handleRemove} disabled={pending}>
                Remover papel timbrado
              </Button>
            </div>
          </div>
        </div>
      ) : url === null ? (
        <label className="inline-block">
          <span className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium px-4 py-2 rounded-md cursor-pointer">
            {pending ? "Enviando..." : "Enviar papel timbrado"}
          </span>
          <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" disabled={pending} />
        </label>
      ) : (
        <p className="text-sm text-slate-400">Carregando...</p>
      )}
      {error && <ErrorState message={error} />}
    </Card>
  );
}
