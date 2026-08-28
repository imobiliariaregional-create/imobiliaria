import { useEffect, useRef, useState } from "react";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify, Table2 } from "lucide-react";
import { sanitizeClauseHtml, ensureClauseHtml } from "@/lib/richText";

function ToolbarButton({
  onMouseDown,
  title,
  children,
}: {
  onMouseDown: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown();
      }}
      className="grid size-8 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  );
}

function montarTabelaHtml(linhas: number, colunas: number): string {
  const celula = `<td style="border:1px solid #94a3b8;padding:6px 8px;min-width:60px;">&nbsp;</td>`;
  const linha = `<tr>${celula.repeat(colunas)}</tr>`;
  return `<table style="border-collapse:collapse;width:100%;">${linha.repeat(linhas)}</table><p><br></p>`;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>("");
  const savedRangeRef = useRef<Range | null>(null);
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const [linhas, setLinhas] = useState(2);
  const [colunas, setColunas] = useState(2);

  useEffect(() => {
    const html = ensureClauseHtml(value);
    if (editorRef.current && html !== lastValueRef.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
    lastValueRef.current = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emitChange() {
    if (!editorRef.current) return;
    const html = sanitizeClauseHtml(editorRef.current.innerHTML);
    lastValueRef.current = html;
    onChange(html);
  }

  function exec(comando: string) {
    editorRef.current?.focus();
    document.execCommand(comando);
    emitChange();
  }

  function abrirTabela() {
    const sel = window.getSelection();
    savedRangeRef.current = sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setTabelaAberta(true);
  }

  function confirmarTabela() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      if (savedRangeRef.current) {
        sel.addRange(savedRangeRef.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.addRange(range);
      }
    }
    document.execCommand("insertHTML", false, montarTabelaHtml(Math.max(1, Math.min(20, linhas)), Math.max(1, Math.min(10, colunas))));
    emitChange();
    setTabelaAberta(false);
  }

  return (
    <div className="relative rounded-xl border border-slate-300 bg-white">
      <div className="flex items-center gap-0.5 border-b border-slate-200 p-1">
        <ToolbarButton title="Negrito" onMouseDown={() => exec("bold")}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton title="Itálico" onMouseDown={() => exec("italic")}>
          <Italic size={15} />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton title="Alinhar à esquerda" onMouseDown={() => exec("justifyLeft")}>
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton title="Centralizar" onMouseDown={() => exec("justifyCenter")}>
          <AlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton title="Alinhar à direita" onMouseDown={() => exec("justifyRight")}>
          <AlignRight size={15} />
        </ToolbarButton>
        <ToolbarButton title="Justificar" onMouseDown={() => exec("justifyFull")}>
          <AlignJustify size={15} />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton title="Inserir tabela" onMouseDown={abrirTabela}>
          <Table2 size={15} />
        </ToolbarButton>
      </div>

      {tabelaAberta && (
        <div className="absolute left-1 top-11 z-10 flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <label className="text-xs text-slate-600">
            Linhas
            <input
              type="number"
              min={1}
              max={20}
              value={linhas}
              onChange={(e) => setLinhas(Number(e.target.value))}
              className="mt-1 block w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Colunas
            <input
              type="number"
              min={1}
              max={10}
              value={colunas}
              onChange={(e) => setColunas(Number(e.target.value))}
              className="mt-1 block w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={confirmarTabela}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
          >
            Inserir
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTabelaAberta(false)}
            className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            Cancelar
          </button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        data-placeholder={placeholder}
        className="clause-rich-content min-h-[120px] px-3.5 py-2.5 text-sm text-slate-900 outline-none [&_table]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-slate-400 [&_td]:p-1.5"
      />
    </div>
  );
}
