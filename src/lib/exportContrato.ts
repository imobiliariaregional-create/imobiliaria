import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
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

function nomeArquivo(numeroContrato: string | null | undefined, extensao: string) {
  const base = numeroContrato ? `contrato-${numeroContrato.replace("/", "-")}` : "contrato";
  return `${base}.${extensao}`;
}

export function exportContratoPDF(
  clausulas: ClausulaDocumento[],
  opts: { numeroContrato?: string | null; letterheadDataUrl?: string | null }
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 25;
  const marginRight = 25;
  const marginTop = opts.letterheadDataUrl ? 45 : 20;
  const marginBottom = opts.letterheadDataUrl ? 30 : 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = 5.5;

  function drawLetterhead() {
    if (opts.letterheadDataUrl) {
      doc.addImage(opts.letterheadDataUrl, "PNG", 0, 0, pageWidth, pageHeight);
    }
  }

  let y = marginTop;
  drawLetterhead();

  function ensureSpace(neededHeight: number) {
    if (y + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      drawLetterhead();
      y = marginTop;
    }
  }

  doc.setFontSize(10);
  for (const clausula of clausulas) {
    if (clausula.titulo) {
      ensureSpace(lineHeight * 2);
      doc.setFont("helvetica", "bold");
      doc.text(clausula.titulo, marginLeft, y);
      y += lineHeight * 1.4;
      doc.setFont("helvetica", "normal");
    }
    const paragrafos = clausula.texto.split("\n");
    for (const paragrafo of paragrafos) {
      const linhas = doc.splitTextToSize(paragrafo, contentWidth);
      for (const linha of linhas) {
        ensureSpace(lineHeight);
        doc.text(linha, marginLeft, y);
        y += lineHeight;
      }
    }
    y += lineHeight;
  }

  doc.save(nomeArquivo(opts.numeroContrato, "pdf"));
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

export async function exportContratoDocx(
  clausulas: ClausulaDocumento[],
  opts: { numeroContrato?: string | null; letterheadDataUrl?: string | null }
) {
  const children: Paragraph[] = [];

  for (const clausula of clausulas) {
    if (clausula.titulo) {
      children.push(new Paragraph({ children: [new TextRun({ text: clausula.titulo, bold: true })], spacing: { before: 200, after: 100 } }));
    }
    for (const paragrafo of clausula.texto.split("\n")) {
      children.push(new Paragraph({ children: [new TextRun(paragrafo)], spacing: { after: 100 } }));
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
            margin: opts.letterheadDataUrl
              ? { top: 2200, bottom: 1400, left: 1200, right: 1200 }
              : { top: 1000, bottom: 1000, left: 1200, right: 1200 },
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
