import DOMPurify from "dompurify";

export type Align = "left" | "center" | "right" | "justify";

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ParagraphBlock {
  type: "paragraph";
  align: Align;
  runs: TextRun[];
}

export interface TableBlock {
  type: "table";
  rows: TextRun[][][]; // rows[r][c] = runs of that cell
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

function alignFromStyle(el: Element): Align {
  const style = (el as HTMLElement).style?.textAlign || el.getAttribute("style")?.match(/text-align:\s*(\w+)/)?.[1];
  if (style === "center" || style === "right" || style === "justify") return style;
  return "left";
}

function runsFromInline(node: Node, bold: boolean, italic: boolean): TextRun[] {
  const runs: TextRun[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text) runs.push({ text, bold, italic });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "br") {
        runs.push({ text: "\n" });
      } else if (tag === "b" || tag === "strong") {
        runs.push(...runsFromInline(el, true, italic));
      } else if (tag === "i" || tag === "em") {
        runs.push(...runsFromInline(el, bold, true));
      } else {
        runs.push(...runsFromInline(el, bold, italic));
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
      const rows: TextRun[][][] = [];
      el.querySelectorAll("tr").forEach((tr) => {
        const row: TextRun[][] = [];
        tr.querySelectorAll("td, th").forEach((cell) => {
          row.push(runsFromInline(cell, false, false));
        });
        if (row.length > 0) rows.push(row);
      });
      if (rows.length > 0) blocks.push({ type: "table", rows });
      return;
    }

    const runs = runsFromInline(el, false, false);
    if (runs.length === 0) return;
    blocks.push({ type: "paragraph", align: alignFromStyle(el), runs });
  });

  return blocks;
}

/** Extrai o texto puro de uma célula/parágrafo (sem formatação) — usado em layouts simples como o PDF. */
export function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join("");
}
