import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document,
  Packer,
  Paragraph,
  TextRun as DocxTextRun,
  ImageRun,
  Header,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HorizontalPositionAlign,
  VerticalPositionAlign,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  TextWrappingSide,
} from "docx";
import type { ClausulaDocumento } from "@/lib/types";
import { parseClauseHtml, runsToPlainText, type Align, type ContentBlock, type ParagraphBlock, type TableBlock, type TextRun } from "@/lib/richText";
import { linhasCabecalho, tituloDocumento, type CabecalhoDocumento } from "@/lib/contratoDocumento";

const PAGE_W_PX = 794; // A4 a 96dpi
const PAGE_H_PX = 1123;

// Margens padrão (petição/contrato): superior e esquerda 3cm, inferior e direita 2cm.
const MARGIN_TOP_MM = 30;
const MARGIN_LEFT_MM = 30;
const MARGIN_BOTTOM_MM = 20;
const MARGIN_RIGHT_MM = 20;
const MM_PER_TWIP = 25.4 / 1440;
const MARGIN_TOP_TWIP = Math.round(MARGIN_TOP_MM / MM_PER_TWIP);
const MARGIN_LEFT_TWIP = Math.round(MARGIN_LEFT_MM / MM_PER_TWIP);
const MARGIN_BOTTOM_TWIP = Math.round(MARGIN_BOTTOM_MM / MM_PER_TWIP);
const MARGIN_RIGHT_TWIP = Math.round(MARGIN_RIGHT_MM / MM_PER_TWIP);

function nomeArquivo(numeroContrato: string | null | undefined, extensao: string) {
  const base = numeroContrato ? `contrato-${numeroContrato.replace("/", "-")}` : "contrato";
  return `${base}.${extensao}`;
}

interface Word {
  text: string;
  bold: boolean;
  italic: boolean;
  brk?: boolean;
}

function fontFor(bold: boolean, italic: boolean) {
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

function tokenizeRuns(runs: TextRun[]): Word[] {
  const palavras: Word[] = [];
  for (const run of runs) {
    if (run.text === "\n") {
      palavras.push({ text: "", bold: false, italic: false, brk: true });
      continue;
    }
    for (const parte of run.text.split(" ").filter((p) => p.length > 0)) {
      palavras.push({ text: parte, bold: !!run.bold, italic: !!run.italic });
    }
  }
  return palavras;
}

function quebrarEmLinhas(doc: jsPDF, palavras: Word[], larguraMax: number): Word[][] {
  const linhas: Word[][] = [];
  let atual: Word[] = [];
  let larguraAtual = 0;
  for (const palavra of palavras) {
    if (palavra.brk) {
      linhas.push(atual);
      atual = [];
      larguraAtual = 0;
      continue;
    }
    doc.setFont("helvetica", fontFor(palavra.bold, palavra.italic));
    const largura = doc.getTextWidth(palavra.text);
    const espaco = doc.getTextWidth(" ");
    const espacoExtra = atual.length > 0 ? espaco : 0;
    if (atual.length > 0 && larguraAtual + espacoExtra + largura > larguraMax) {
      linhas.push(atual);
      atual = [palavra];
      larguraAtual = largura;
    } else {
      atual.push(palavra);
      larguraAtual += espacoExtra + largura;
    }
  }
  linhas.push(atual);
  return linhas;
}

function desenharLinhaComEstilo(doc: jsPDF, linha: Word[], x: number, y: number, larguraAlvo: number, align: Align, ultimaLinha: boolean) {
  if (linha.length === 0) return;
  const larguras = linha.map((w) => {
    doc.setFont("helvetica", fontFor(w.bold, w.italic));
    return doc.getTextWidth(w.text);
  });
  const espaco = doc.getTextWidth(" ");
  const larguraNatural = larguras.reduce((s, l) => s + l, 0) + espaco * (linha.length - 1);

  let cursorX = x;
  let gap = espaco;
  if (align === "center") cursorX = x + (larguraAlvo - larguraNatural) / 2;
  else if (align === "right") cursorX = x + larguraAlvo - larguraNatural;
  else if (align === "justify" && !ultimaLinha && linha.length > 1) {
    gap = espaco + Math.max(0, larguraAlvo - larguraNatural) / (linha.length - 1);
  }

  linha.forEach((palavra, idx) => {
    doc.setFont("helvetica", fontFor(palavra.bold, palavra.italic));
    doc.text(palavra.text, cursorX, y);
    cursorX += larguras[idx] + gap;
  });
}

function criarDocumentoPDF(
  clausulas: ClausulaDocumento[],
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT_MM - MARGIN_RIGHT_MM;
  const fontSize = 10; // pt
  const lineHeight = fontSize * 0.3528 * 1.5; // espaçamento 1,5

  function drawLetterhead() {
    if (opts.letterheadDataUrl) {
      doc.addImage(opts.letterheadDataUrl, "PNG", 0, 0, pageWidth, pageHeight);
    }
  }

  let y = MARGIN_TOP_MM;
  drawLetterhead();

  function ensureSpace(neededHeight: number) {
    if (y + neededHeight > pageHeight - MARGIN_BOTTOM_MM) {
      doc.addPage();
      drawLetterhead();
      y = MARGIN_TOP_MM;
    }
  }

  doc.setFontSize(fontSize);

  if (opts.cabecalho) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const linha of linhasCabecalho(opts.cabecalho)) {
      doc.text(linha, pageWidth - MARGIN_RIGHT_MM, y, { align: "right" });
      y += lineHeight * 0.85;
    }
    y += lineHeight * 0.5;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(tituloDocumento(opts.cabecalho.tipoOperacao), pageWidth / 2, y, { align: "center" });
    y += lineHeight * 1.6;
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
  }

  function desenharParagrafo(block: ParagraphBlock) {
    const palavras = tokenizeRuns(block.runs);
    if (palavras.length === 0) {
      ensureSpace(lineHeight);
      y += lineHeight;
      return;
    }
    const linhas = quebrarEmLinhas(doc, palavras, contentWidth);
    linhas.forEach((linha, idx) => {
      ensureSpace(lineHeight);
      desenharLinhaComEstilo(doc, linha, MARGIN_LEFT_MM, y, contentWidth, block.align, idx === linhas.length - 1);
      y += lineHeight;
    });
    doc.setFont("helvetica", "normal");
  }

  function desenharTabela(block: TableBlock) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT_MM, right: MARGIN_RIGHT_MM, bottom: MARGIN_BOTTOM_MM },
      body: block.rows.map((row) => row.map((celula) => runsToPlainText(celula))),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: [148, 163, 184], lineWidth: 0.2, textColor: [23, 32, 28] },
      willDrawPage: () => drawLetterhead(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + lineHeight * 0.6;
  }

  for (const clausula of clausulas) {
    if (clausula.titulo) {
      ensureSpace(lineHeight * 1.3);
      doc.setFont("helvetica", "bold");
      doc.text(clausula.titulo, MARGIN_LEFT_MM, y);
      y += lineHeight;
      doc.setFont("helvetica", "normal");
    }
    const blocks: ContentBlock[] = parseClauseHtml(clausula.texto);
    for (const block of blocks) {
      if (block.type === "table") desenharTabela(block);
      else desenharParagrafo(block);
    }
    y += lineHeight * 0.6;
  }

  return doc;
}

export function exportContratoPDF(
  clausulas: ClausulaDocumento[],
  opts: { numeroContrato?: string | null; letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
) {
  downloadBlob(gerarContratoPdfBlob(clausulas, opts), nomeArquivo(opts.numeroContrato, "pdf"));
}

export function gerarContratoPdfBlob(
  clausulas: ClausulaDocumento[],
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
): Blob {
  return criarDocumentoPDF(clausulas, opts).output("blob");
}

/** Gera o mesmo PDF em base64 (sem disparar download) — usado para enviar para assinatura digital. */
export function gerarContratoPdfBase64(
  clausulas: ClausulaDocumento[],
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
): string {
  const doc = criarDocumentoPDF(clausulas, opts);
  const dataUri = doc.output("datauristring");
  return dataUri.slice(dataUri.indexOf(",") + 1);
}

async function letterheadImageRun(letterheadDataUrl: string): Promise<ImageRun> {
  const base64 = letterheadDataUrl.slice(letterheadDataUrl.indexOf(",") + 1);
  return new ImageRun({
    type: "png",
    data: base64,
    transformation: { width: PAGE_W_PX, height: PAGE_H_PX },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.TOP },
      wrap: { type: TextWrappingType.NONE, side: TextWrappingSide.BOTH_SIDES },
      behindDocument: true,
      layoutInCell: false,
      allowOverlap: true,
    },
  });
}

const LINE_1_5 = { line: 360, lineRule: "auto" as const }; // 360/240 = 1,5

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
};

function mapAlignDocx(align: Align) {
  if (align === "center") return AlignmentType.CENTER;
  if (align === "right") return AlignmentType.RIGHT;
  if (align === "justify") return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function runsToDocxRuns(runs: TextRun[]): DocxTextRun[] {
  const out: DocxTextRun[] = [];
  for (const run of runs) {
    if (run.text === "\n") {
      out.push(new DocxTextRun({ text: "", break: 1 }));
      continue;
    }
    out.push(new DocxTextRun({ text: run.text, bold: run.bold, italics: run.italic }));
  }
  return out;
}

function paragraphFromBlock(block: ParagraphBlock): Paragraph {
  return new Paragraph({
    alignment: mapAlignDocx(block.align),
    children: runsToDocxRuns(block.runs),
    spacing: { after: 100, ...LINE_1_5 },
  });
}

function tableFromBlock(block: TableBlock): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: block.rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (celula) =>
              new TableCell({
                children: [new Paragraph({ children: runsToDocxRuns(celula) })],
              })
          ),
        })
    ),
  });
}

export async function exportContratoDocx(
  clausulas: ClausulaDocumento[],
  opts: { numeroContrato?: string | null; letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
) {
  downloadBlob(await gerarContratoDocxBlob(clausulas, opts), nomeArquivo(opts.numeroContrato, "docx"));
}

export async function gerarContratoDocxBlob(
  clausulas: ClausulaDocumento[],
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
) {
  const children: (Paragraph | Table)[] = [];

  if (opts.cabecalho) {
    for (const linha of linhasCabecalho(opts.cabecalho)) {
      children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new DocxTextRun(linha)], spacing: { after: 40 } }));
    }
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new DocxTextRun({ text: tituloDocumento(opts.cabecalho.tipoOperacao), bold: true })],
        spacing: { before: 150, after: 200 },
      })
    );
  }

  for (const clausula of clausulas) {
    if (clausula.titulo) {
      children.push(
        new Paragraph({
          children: [new DocxTextRun({ text: clausula.titulo, bold: true })],
          spacing: { before: 200, after: 100, ...LINE_1_5 },
        })
      );
    }
    for (const block of parseClauseHtml(clausula.texto)) {
      children.push(block.type === "table" ? tableFromBlock(block) : paragraphFromBlock(block));
    }
  }

  const header = opts.letterheadDataUrl
    ? new Header({ children: [new Paragraph({ children: [await letterheadImageRun(opts.letterheadDataUrl)] })] })
    : undefined;

  const doc = new Document({
    sections: [
      {
        headers: header ? { default: header } : undefined,
        properties: {
          page: {
            margin: { top: MARGIN_TOP_TWIP, bottom: MARGIN_BOTTOM_TWIP, left: MARGIN_LEFT_TWIP, right: MARGIN_RIGHT_TWIP },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
