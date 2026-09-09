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
import { parseClauseHtml, runsToPlainText, type Align, type ContentBlock, type ParagraphBlock, type TableBlock, type TableCell as ClauseTableCell, type TextRun } from "@/lib/richText";
import { linhasCabecalho, type CabecalhoDocumento } from "@/lib/contratoDocumento";

const COR_TEXTO_PADRAO: [number, number, number] = [23, 32, 28];

function hexParaRgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Escolhe texto branco ou escuro conforme o brilho do fundo, para manter legibilidade. */
function corContrastante(hexFundo: string): [number, number, number] {
  const [r, g, b] = hexParaRgb(hexFundo);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia < 0.55 ? [255, 255, 255] : COR_TEXTO_PADRAO;
}

/** Se todas as runs com texto da célula compartilham a mesma cor explícita, retorna ela. */
function corComumDaCelula(celula: ClauseTableCell): string | undefined {
  const cores = new Set(celula.runs.filter((r) => r.text.trim() !== "").map((r) => r.color).filter((c): c is string => !!c));
  return cores.size === 1 ? [...cores][0] : undefined;
}

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

/**
 * Niveis de ajuste para evitar que uma sobra pequena de conteudo (tipicamente as
 * assinaturas) fique orfa sozinha na ultima pagina. Cada nivel aperta um pouco mais
 * o espacamento/margens antes de mexer no tamanho da fonte.
 */
interface NivelAjustePdf {
  fonte: number;
  espacamento: number;
  margemTopo: number;
  margemBaixo: number;
  margemEsquerda: number;
  margemDireita: number;
}

const NIVEIS_AJUSTE_PDF: NivelAjustePdf[] = [
  { fonte: 10, espacamento: 1.5, margemTopo: 30, margemBaixo: 20, margemEsquerda: 30, margemDireita: 20 },
  { fonte: 10, espacamento: 1.35, margemTopo: 27, margemBaixo: 18, margemEsquerda: 27, margemDireita: 18 },
  { fonte: 9.5, espacamento: 1.25, margemTopo: 24, margemBaixo: 16, margemEsquerda: 24, margemDireita: 16 },
  { fonte: 9, espacamento: 1.15, margemTopo: 20, margemBaixo: 14, margemEsquerda: 20, margemDireita: 14 },
];

/** Quantas linhas de sobra na ultima pagina ainda contam como "orfa" (poucas linhas isoladas). */
const LIMITE_LINHAS_ORFA = 6;

function nomeArquivo(numeroContrato: string | null | undefined, extensao: string) {
  const base = numeroContrato ? `contrato-${numeroContrato.replace("/", "-")}` : "contrato";
  return `${base}.${extensao}`;
}

interface Word {
  text: string;
  bold: boolean;
  italic: boolean;
  color?: string;
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
      palavras.push({ text: parte, bold: !!run.bold, italic: !!run.italic, color: run.color });
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
    doc.setTextColor(...(palavra.color ? hexParaRgb(palavra.color) : COR_TEXTO_PADRAO));
    doc.text(palavra.text, cursorX, y);
    cursorX += larguras[idx] + gap;
  });
  doc.setTextColor(...COR_TEXTO_PADRAO);
}

interface ResultadoLayoutPdf {
  doc: jsPDF;
  paginas: number;
  linhasUltimaPagina: number;
}

function criarDocumentoPDF(
  conteudo: string,
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento },
  nivel = 0
): ResultadoLayoutPdf {
  const ajuste = NIVEIS_AJUSTE_PDF[nivel];
  const marginTop = ajuste.margemTopo;
  const marginLeft = ajuste.margemEsquerda;
  const marginBottom = ajuste.margemBaixo;
  const marginRight = ajuste.margemDireita;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginLeft - marginRight;
  const fontSize = ajuste.fonte; // pt
  const lineHeight = fontSize * 0.3528 * ajuste.espacamento;

  /** Desenha o papel timbrado e o cabecalho (numero/data/tipo) — repetido em toda pagina, como um cabecalho de verdade. */
  function drawPageChrome(): number {
    if (opts.letterheadDataUrl) {
      doc.addImage(opts.letterheadDataUrl, "PNG", 0, 0, pageWidth, pageHeight);
    }
    let topoConteudo = marginTop;
    if (opts.cabecalho) {
      let yCabecalho = marginTop;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      for (const linha of linhasCabecalho(opts.cabecalho)) {
        doc.text(linha, pageWidth - marginRight, yCabecalho, { align: "right" });
        yCabecalho += lineHeight * 0.85;
      }
      yCabecalho += lineHeight * 0.5;
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal");
      topoConteudo = yCabecalho;
    }
    return topoConteudo;
  }

  let y = drawPageChrome();
  const topoConteudoPadrao = y;
  let topoUltimaPagina = topoConteudoPadrao;

  function ensureSpace(neededHeight: number) {
    if (y + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = drawPageChrome();
      topoUltimaPagina = y;
    }
  }

  doc.setFontSize(fontSize);

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
      desenharLinhaComEstilo(doc, linha, marginLeft, y, contentWidth, block.align, idx === linhas.length - 1);
      y += lineHeight;
    });
    doc.setFont("helvetica", "normal");
  }

  function desenharTabela(block: TableBlock) {
    let paginasAntes = doc.getNumberOfPages();
    autoTable(doc, {
      startY: y,
      margin: { left: marginLeft, right: marginRight, bottom: marginBottom, top: topoConteudoPadrao },
      body: block.rows.map((row) => row.map((celula) => runsToPlainText(celula.runs))),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: [148, 163, 184], lineWidth: 0.2, textColor: COR_TEXTO_PADRAO },
      willDrawPage: () => {
        // Só redesenha o timbrado/cabeçalho quando a tabela realmente abre uma página nova —
        // redesenhar na página atual apagaria (por cima) o conteúdo que já tinha sido escrito ali.
        const paginasAgora = doc.getNumberOfPages();
        if (paginasAgora > paginasAntes) {
          topoUltimaPagina = drawPageChrome();
          paginasAntes = paginasAgora;
        }
      },
      didParseCell: (data) => {
        const celula = block.rows[data.row.index]?.[data.column.index];
        if (!celula) return;
        const corExplicita = corComumDaCelula(celula);
        if (celula.background) {
          data.cell.styles.fillColor = hexParaRgb(celula.background);
          data.cell.styles.textColor = corExplicita ? hexParaRgb(corExplicita) : corContrastante(celula.background);
        } else if (corExplicita) {
          data.cell.styles.textColor = hexParaRgb(corExplicita);
        }
        if (celula.runs.length > 0 && celula.runs.every((r) => r.text.trim() === "" || r.bold)) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + lineHeight * 0.6;
  }

  const blocks: ContentBlock[] = parseClauseHtml(conteudo);
  for (const block of blocks) {
    if (block.type === "table") desenharTabela(block);
    else desenharParagrafo(block);
  }

  const linhasUltimaPagina = Math.max(0, Math.round((y - topoUltimaPagina) / lineHeight));
  return { doc, paginas: doc.getNumberOfPages(), linhasUltimaPagina };
}

/**
 * Gera o PDF tentando evitar que sobre pouca coisa (tipicamente as assinaturas) sozinha
 * numa ultima pagina: se a primeira tentativa deixar uma "sobra orfa", tenta de novo com
 * espacamento/margens (e por ultimo fonte) um pouco menores, ate caber ou esgotar os niveis.
 */
function gerarPdfComAjusteDeOrfa(
  conteudo: string,
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
): jsPDF {
  const tentativas: ResultadoLayoutPdf[] = [];
  for (let nivel = 0; nivel < NIVEIS_AJUSTE_PDF.length; nivel++) {
    const resultado = criarDocumentoPDF(conteudo, opts, nivel);
    if (resultado.paginas <= 1 || resultado.linhasUltimaPagina > LIMITE_LINHAS_ORFA) return resultado.doc;
    tentativas.push(resultado);
  }
  // Nenhum nivel resolveu de vez: fica com quem tiver menos paginas e, empatando, mais linhas na ultima.
  tentativas.sort((a, b) => a.paginas - b.paginas || b.linhasUltimaPagina - a.linhasUltimaPagina);
  return tentativas[0].doc;
}

export function exportContratoPDF(
  conteudo: string,
  opts: { numeroContrato?: string | null; letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
) {
  downloadBlob(gerarContratoPdfBlob(conteudo, opts), nomeArquivo(opts.numeroContrato, "pdf"));
}

export function gerarContratoPdfBlob(
  conteudo: string,
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
): Blob {
  return gerarPdfComAjusteDeOrfa(conteudo, opts).output("blob");
}

/** Gera o mesmo PDF em base64 (sem disparar download) — usado para enviar para assinatura digital. */
export function gerarContratoPdfBase64(
  conteudo: string,
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
): string {
  const doc = gerarPdfComAjusteDeOrfa(conteudo, opts);
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
    out.push(new DocxTextRun({ text: run.text, bold: run.bold, italics: run.italic, color: run.color }));
  }
  return out;
}

function paragraphFromBlock(block: ParagraphBlock, opcoes?: { keepNext?: boolean; keepLines?: boolean }): Paragraph {
  return new Paragraph({
    alignment: mapAlignDocx(block.align),
    children: runsToDocxRuns(block.runs),
    spacing: { after: 100, ...LINE_1_5 },
    keepNext: opcoes?.keepNext,
    keepLines: opcoes?.keepLines,
  });
}

/** Quantos parágrafos finais tratar como um bloco só (tipicamente onde ficam as assinaturas), pra evitar que o Word os separe de forma feia entre páginas. */
const PARAGRAFOS_FINAIS_UNIDOS = 4;

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
                shading: celula.background ? { fill: celula.background } : undefined,
                children: [new Paragraph({ children: runsToDocxRuns(celula.runs) })],
              })
          ),
        })
    ),
  });
}

export async function exportContratoDocx(
  conteudo: string,
  opts: { numeroContrato?: string | null; letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
) {
  downloadBlob(await gerarContratoDocxBlob(conteudo, opts), nomeArquivo(opts.numeroContrato, "docx"));
}

export async function gerarContratoDocxBlob(
  conteudo: string,
  opts: { letterheadDataUrl?: string | null; cabecalho?: CabecalhoDocumento }
) {
  const children: (Paragraph | Table)[] = [];

  const blocks = parseClauseHtml(conteudo);
  const indicesParagrafo = blocks.map((b, i) => (b.type === "paragraph" ? i : -1)).filter((i) => i >= 0);
  const indicesFinais = new Set(indicesParagrafo.slice(-PARAGRAFOS_FINAIS_UNIDOS));
  const ultimoIndiceParagrafo = indicesParagrafo[indicesParagrafo.length - 1];

  blocks.forEach((block, i) => {
    if (block.type === "table") {
      children.push(tableFromBlock(block));
      return;
    }
    // Os ultimos paragrafos (normalmente onde ficam as assinaturas) sao marcados pra ficarem
    // juntos: "keepLines" evita quebrar um deles ao meio, e "keepNext" gruda cada um ao
    // seguinte, entao o Word so quebra a pagina antes desse bloco inteiro, nunca no meio dele.
    const noBlocoFinal = indicesFinais.has(i);
    children.push(paragraphFromBlock(block, { keepLines: noBlocoFinal, keepNext: noBlocoFinal && i !== ultimoIndiceParagrafo }));
  });

  const headerChildren: Paragraph[] = [];
  if (opts.letterheadDataUrl) {
    headerChildren.push(new Paragraph({ children: [await letterheadImageRun(opts.letterheadDataUrl)] }));
  }
  if (opts.cabecalho) {
    for (const linha of linhasCabecalho(opts.cabecalho)) {
      headerChildren.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new DocxTextRun(linha)], spacing: { after: 40 } }));
    }
  }
  const header = headerChildren.length > 0 ? new Header({ children: headerChildren }) : undefined;

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
