import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  AlignmentType,
  HorizontalPositionAlign,
  VerticalPositionAlign,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  TextWrappingSide,
} from "docx";
import type { ClausulaDocumento } from "@/lib/types";

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

/** Justifica manualmente distribuindo o espaço extra entre as palavras (o align:"justify" nativo do jsPDF não é confiável). */
function desenharLinhaJustificada(doc: jsPDF, linha: string, x: number, y: number, larguraAlvo: number) {
  const palavras = linha.split(" ").filter((p) => p.length > 0);
  if (palavras.length <= 1) {
    doc.text(linha, x, y);
    return;
  }
  const larguraPalavras = palavras.reduce((soma, p) => soma + doc.getTextWidth(p), 0);
  const espacoNormal = doc.getTextWidth(" ");
  const larguraNatural = larguraPalavras + espacoNormal * (palavras.length - 1);
  const espacoExtra = Math.max(0, larguraAlvo - larguraNatural);
  const espacoPorGap = espacoNormal + espacoExtra / (palavras.length - 1);

  let cursorX = x;
  palavras.forEach((palavra, idx) => {
    doc.text(palavra, cursorX, y);
    cursorX += doc.getTextWidth(palavra) + espacoPorGap;
  });
}

function criarDocumentoPDF(
  clausulas: ClausulaDocumento[],
  opts: { letterheadDataUrl?: string | null }
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
  for (const clausula of clausulas) {
    if (clausula.titulo) {
      ensureSpace(lineHeight * 1.3);
      doc.setFont("helvetica", "bold");
      doc.text(clausula.titulo, MARGIN_LEFT_MM, y);
      y += lineHeight;
      doc.setFont("helvetica", "normal");
    }
    for (const paragrafo of clausula.texto.split("\n")) {
      if (paragrafo.trim() === "") {
        ensureSpace(lineHeight);
        y += lineHeight;
        continue;
      }
      const linhas: string[] = doc.splitTextToSize(paragrafo, contentWidth);
      linhas.forEach((linha, idx) => {
        ensureSpace(lineHeight);
        const ultimaLinha = idx === linhas.length - 1;
        if (ultimaLinha) {
          doc.text(linha, MARGIN_LEFT_MM, y);
        } else {
          desenharLinhaJustificada(doc, linha, MARGIN_LEFT_MM, y, contentWidth);
        }
        y += lineHeight;
      });
    }
    y += lineHeight * 0.6;
  }

  return doc;
}

export function exportContratoPDF(
  clausulas: ClausulaDocumento[],
  opts: { numeroContrato?: string | null; letterheadDataUrl?: string | null }
) {
  const doc = criarDocumentoPDF(clausulas, opts);
  doc.save(nomeArquivo(opts.numeroContrato, "pdf"));
}

/** Gera o mesmo PDF em base64 (sem disparar download) — usado para enviar para assinatura digital. */
export function gerarContratoPdfBase64(
  clausulas: ClausulaDocumento[],
  opts: { letterheadDataUrl?: string | null }
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

export async function exportContratoDocx(
  clausulas: ClausulaDocumento[],
  opts: { numeroContrato?: string | null; letterheadDataUrl?: string | null }
) {
  const children: Paragraph[] = [];

  for (const clausula of clausulas) {
    if (clausula.titulo) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: clausula.titulo, bold: true })],
          spacing: { before: 200, after: 100, ...LINE_1_5 },
        })
      );
    }
    for (const paragrafo of clausula.texto.split("\n")) {
      children.push(
        new Paragraph({
          children: [new TextRun(paragrafo)],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100, ...LINE_1_5 },
        })
      );
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

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo(opts.numeroContrato, "docx");
  a.click();
  URL.revokeObjectURL(url);
}
