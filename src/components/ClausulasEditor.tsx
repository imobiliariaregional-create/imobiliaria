import { Button, Input, Label } from "@/components/ui";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { ClausulaDocumento } from "@/lib/types";

function novoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
}

export function ClausulasEditor({
  clausulas,
  onChange,
}: {
  clausulas: ClausulaDocumento[];
  onChange: (clausulas: ClausulaDocumento[]) => void;
}) {
  function atualizar(id: string, patch: Partial<ClausulaDocumento>) {
    onChange(clausulas.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function remover(id: string) {
    onChange(clausulas.filter((c) => c.id !== id));
  }

  function mover(id: string, direcao: -1 | 1) {
    const idx = clausulas.findIndex((c) => c.id === id);
    const novoIdx = idx + direcao;
    if (idx < 0 || novoIdx < 0 || novoIdx >= clausulas.length) return;
    const copia = [...clausulas];
    [copia[idx], copia[novoIdx]] = [copia[novoIdx], copia[idx]];
    onChange(copia);
  }

  function adicionar() {
    onChange([...clausulas, { id: novoId(), titulo: "", texto: "" }]);
  }

  return (
    <div className="space-y-4">
      {clausulas.map((clausula, idx) => (
        <div key={clausula.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Label htmlFor={`clausula-titulo-${clausula.id}`}>Cláusula {idx + 1} — título (opcional)</Label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => mover(clausula.id, -1)} disabled={idx === 0}>
                ↑
              </Button>
              <Button type="button" variant="secondary" onClick={() => mover(clausula.id, 1)} disabled={idx === clausulas.length - 1}>
                ↓
              </Button>
              <Button type="button" variant="danger" onClick={() => remover(clausula.id)}>
                Excluir
              </Button>
            </div>
          </div>
          <Input
            id={`clausula-titulo-${clausula.id}`}
            value={clausula.titulo ?? ""}
            onChange={(e) => atualizar(clausula.id, { titulo: e.target.value || null })}
            placeholder="ex: Das Partes"
            forceUppercase={false}
          />
          <RichTextEditor
            value={clausula.texto}
            onChange={(texto) => atualizar(clausula.id, { texto })}
            placeholder="Texto da cláusula. Use códigos como #nome_locador para preencher automaticamente."
          />
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={adicionar}>
        + Adicionar cláusula
      </Button>
    </div>
  );
}
