import DOMPurify from "dompurify";

export type Align = "left" | "center" | "right" | "justify";

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string; // hex sem "#"
}

export interface ParagraphBlock {
  type: "paragraph";
  align: Align;
  runs: TextRun[];
}

export interface TableCell {
  runs: TextRun[];
  background?: string; // hex sem "#", ex: "1E293B"
}

export interface TableBlock {
  type: "table";
  rows: TableCell[][];
}

export type ContentBlock = ParagraphBlock | TableBlock;

const ALLOWED_TAGS = ["p", "div", "br", "b", "strong", "i", "em", "table", "thead", "tbody", "tr", "td", "th", "span"];
const ALLOWED_ATTR = ["style"];

/** Limpa o HTML digitado no editor rico, removendo tudo que não seja formatação de texto/tabela. */
export function sanitizeClauseHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

/** Garante que um texto de cláusula (novo ou legado, em texto puro) vire HTML válido. */
export function ensureClauseHtml(texto: string): string {
  if (texto.includes("<")) return texto;
  const escapado = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escapado.replace(/\n/g, "<br>")}</p>`;
}

/** Converte uma cor CSS (#rrggbb ou rgb(r,g,b)) para hex sem "#". */
export function cssColorToHex(color: string): string | null {
  const trimmed = color.trim();
  if (!trimmed || trimmed === "transparent") return null;
  const hexMatch = trimmed.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return hex.length === 3 ? hex.split("").map((c) => c + c).join("").toUpperCase() : hex.toUpperCase();
  }
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const toHex = (n: string) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
    return `${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`.toUpperCase();
  }
  return null;
}

function alignFromStyle(el: Element): Align {
  const style = (el as HTMLElement).style?.textAlign || el.getAttribute("style")?.match(/text-align:\s*(\w+)/)?.[1];
  if (style === "center" || style === "right" || style === "justify") return style;
  return "left";
}

function backgroundFromStyle(el: Element): string | undefined {
  const raw = (el as HTMLElement).style?.backgroundColor || el.getAttribute("style")?.match(/background-color:\s*([^;]+)/)?.[1];
  if (!raw) return undefined;
  return cssColorToHex(raw) ?? undefined;
}

function corDeElemento(el: Element): string | undefined {
  const raw = (el as HTMLElement).style?.color || el.getAttribute("style")?.match(/(?<!background-)color:\s*([^;]+)/)?.[1];
  if (!raw) return undefined;
  return cssColorToHex(raw) ?? undefined;
}

/** Extrai o texto/formatacao de um no, tratando <div>/<p> aninhados (comuns dentro de celulas de tabela) como quebras de linha. */
function runsFromInline(node: Node, bold: boolean, italic: boolean, color?: string): TextRun[] {
  const runs: TextRun[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text) runs.push({ text, bold, italic, color });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      const corHerdada = corDeElemento(el) ?? color;
      if (tag === "br") {
        runs.push({ text: "\n" });
      } else if (tag === "b" || tag === "strong") {
        runs.push(...runsFromInline(el, true, italic, corHerdada));
      } else if (tag === "i" || tag === "em") {
        runs.push(...runsFromInline(el, bold, true, corHerdada));
      } else if (tag === "div" || tag === "p") {
        if (runs.length > 0) runs.push({ text: "\n" });
        runs.push(...runsFromInline(el, bold, italic, corHerdada));
      } else {
        runs.push(...runsFromInline(el, bold, italic, corHerdada));
      }
    }
  });
  return runs;
}

/** Converte o HTML de uma cláusula em blocos (parágrafos/tabelas) para gerar PDF/Word. */
export function parseClauseHtml(html: string): ContentBlock[] {
  const doc = new DOMParser().parseFromString(sanitizeClauseHtml(ensureClauseHtml(html)), "text/html");
  const blocks: ContentBlock[] = [];

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === "table") {
      const rows: TableCell[][] = [];
      el.querySelectorAll("tr").forEach((tr) => {
        const row: TableCell[] = [];
        tr.querySelectorAll("td, th").forEach((cell) => {
          row.push({ runs: runsFromInline(cell, false, false, corDeElemento(cell)), background: backgroundFromStyle(cell) });
        });
        if (row.length > 0) rows.push(row);
      });
      if (rows.length > 0) blocks.push({ type: "table", rows });
      return;
    }

    const runs = runsFromInline(el, false, false, corDeElemento(el));
    if (runs.length === 0) return;
    blocks.push({ type: "paragraph", align: alignFromStyle(el), runs });
  });

  return blocks;
}

/** Extrai o texto puro de uma célula/parágrafo (sem formatação) — usado em layouts simples como o PDF. */
export function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join("");
}
