/**
 * Cabeçalho institucional reutilizável para PDFs custom (Receita, Formulário,
 * Pedidos de Exame). Os PDFs oficiais SUS mantêm seus próprios layouts.
 *
 * Renderiza:
 *  - Logo Facilita PrEP (versão vetorial simplificada — duas formas em curva
 *    + glow central, mantendo a estética lilás/azul da marca)
 *  - Nome do app + tagline
 *  - Bloco institucional da clínica (nome, CNPJ, endereço, telefone, e-mail)
 *  - Linha divisória
 */

import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import { CLINICA_INFO } from "../shared/const.ts";
import { formatarCpf } from "./_core/cpfValidator.ts";

export interface DadosPaciente {
  nome: string;
  cpf?: string | null;
}

/**
 * Word-wrap manual para pdf-lib. O `maxWidth` nativo quebra visualmente
 * mas NÃO incrementa o cursor Y, causando sobreposição com o conteúdo
 * seguinte. Esta helper desenha linha-a-linha e retorna o Y final.
 *
 * Quebra preferencialmente em espaço; palavras maiores que `maxWidth`
 * são quebradas a meio-caractere (último recurso).
 */
export function drawTextWrapped(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    maxWidth: number;
    /** Espaçamento entre linhas (default = size * 1.2) */
    lineHeight?: number;
  },
): number {
  const { x, font, size, color, maxWidth } = opts;
  const lineHeight = opts.lineHeight ?? size * 1.2;
  let y = opts.y;
  if (!text) return y;

  const words = String(text).split(/\s+/);
  let line = "";

  const flush = () => {
    if (line) {
      page.drawText(line, { x, y, font, size, color });
      y -= lineHeight;
      line = "";
    }
  };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    flush();
    // Palavra sozinha excede maxWidth: quebra em pedaços
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
          chunk += ch;
        } else {
          page.drawText(chunk, { x, y, font, size, color });
          y -= lineHeight;
          chunk = ch;
        }
      }
      line = chunk;
    } else {
      line = word;
    }
  }
  flush();
  return y;
}

/**
 * Trunca texto para caber em `maxWidth` adicionando '…' no fim.
 * Se já couber, retorna o texto original.
 */
export function truncarParaLargura(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "…";
  const ellipsisW = font.widthOfTextAtSize(ellipsis, size);
  let result = "";
  for (const ch of text) {
    if (font.widthOfTextAtSize(result + ch, size) + ellipsisW > maxWidth) break;
    result += ch;
  }
  return result + ellipsis;
}

/**
 * Banner roxo destacado com título do documento — usado em pedidos de
 * exame, orientação e outros PDFs custom para máxima visibilidade.
 */
export function desenharBannerTitulo(args: {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  pageWidth: number;
  margin: number;
  startY: number;
  titulo: string;
  subtitulo?: string;
}): number {
  const { page, font, fontBold, pageWidth, margin, startY, titulo, subtitulo } =
    args;
  const bannerH = subtitulo ? 56 : 42;

  page.drawRectangle({
    x: margin,
    y: startY - bannerH + 2,
    width: pageWidth - margin * 2,
    height: bannerH,
    color: rgb(0.96, 0.93, 0.99),
    borderColor: rgb(0.45, 0.36, 0.62),
    borderWidth: 1.2,
  });
  page.drawText(titulo, {
    x: margin + 18,
    y: startY - 22,
    font: fontBold,
    size: 18,
    color: rgb(0.45, 0.36, 0.62),
  });
  if (subtitulo) {
    page.drawText(subtitulo, {
      x: margin + 18,
      y: startY - 42,
      font,
      size: 9,
      color: rgb(0.5, 0.5, 0.55),
    });
  }
  return startY - bannerH - 14;
}

/**
 * Desenha o bloco "PACIENTE" abaixo do cabeçalho institucional.
 * Mostra nome + CPF (sem data de nascimento, conforme decisão do cliente).
 */
export function desenharBlocoPaciente(args: {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  pageWidth: number;
  margin: number;
  startY: number;
  paciente: DadosPaciente;
}): number {
  const { page, font, fontBold, pageWidth, margin, startY, paciente } = args;
  let y = startY;

  page.drawText("PACIENTE", {
    x: margin,
    y,
    font: fontBold,
    size: 9,
    color: rgb(0.4, 0.4, 0.45),
  });
  y -= 14;

  // Calcula espaço disponível para o nome considerando o CPF à direita
  const cpfTexto = paciente.cpf ? `CPF ${formatarCpf(paciente.cpf)}` : "";
  const cpfW = cpfTexto ? font.widthOfTextAtSize(cpfTexto, 9) : 0;
  const nomeMaxWidth = pageWidth - margin * 2 - (cpfW ? cpfW + 12 : 0);
  const nomeTruncado = truncarParaLargura(
    paciente.nome,
    fontBold,
    11,
    nomeMaxWidth,
  );

  page.drawText(nomeTruncado, {
    x: margin,
    y,
    font: fontBold,
    size: 11,
    color: rgb(0.1, 0.1, 0.15),
  });
  if (cpfTexto) {
    page.drawText(cpfTexto, {
      x: pageWidth - margin - cpfW,
      y,
      font,
      size: 9,
      color: rgb(0.45, 0.45, 0.5),
    });
  }
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.4,
    color: rgb(0.88, 0.86, 0.92),
  });
  return y - 18;
}

/**
 * Bloco de indicação clínica + CID + validade do pedido (rodapé do conteúdo,
 * antes do carimbo digital).
 */
export function desenharIndicacaoCID(args: {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  margin: number;
  pageWidth: number;
  startY: number;
  indicacao: string;
  validadeDias?: number;
}): number {
  const {
    page,
    font,
    fontBold,
    margin,
    pageWidth,
    startY,
    indicacao,
    validadeDias = 180,
  } = args;
  let y = startY;

  page.drawLine({
    start: { x: margin, y: y + 8 },
    end: { x: pageWidth - margin, y: y + 8 },
    thickness: 0.4,
    color: rgb(0.88, 0.86, 0.92),
  });

  page.drawText("INDICAÇÃO CLÍNICA", {
    x: margin,
    y,
    font: fontBold,
    size: 9,
    color: rgb(0.4, 0.4, 0.45),
  });
  y -= 13;
  y = drawTextWrapped(page, indicacao, {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0.1, 0.1, 0.15),
    maxWidth: pageWidth - margin * 2,
    lineHeight: 12,
  });
  y -= 2;
  page.drawText(
    "CID-10: Z20.6 (Contato/exposição ao HIV) · Z29.2 (Outra quimioprofilaxia profilática)",
    {
      x: margin,
      y,
      font,
      size: 8,
      color: rgb(0.4, 0.4, 0.45),
    },
  );
  y -= 12;
  page.drawText(
    `Pedido válido por ${validadeDias} dias a contar da data de emissão.`,
    {
      x: margin,
      y,
      font,
      size: 8,
      color: rgb(0.45, 0.36, 0.62),
    },
  );
  return y - 6;
}

interface CabecalhoInstitucionalArgs {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  pageWidth: number;
  margin: number;
  /** Posição Y inicial (topo) — função desce conforme desenha */
  startY: number;
}

/**
 * Desenha o cabeçalho institucional. Retorna o cursor Y final (logo abaixo
 * da linha divisória), pronto para o conteúdo específico do documento.
 */
export function desenharCabecalhoInstitucional(
  args: CabecalhoInstitucionalArgs,
): number {
  const { page, font, fontBold, pageWidth, margin, startY } = args;

  // ── Logo Facilita PrEP (esquerda, versão simplificada) ──
  desenharLogoFacilita(page, margin, startY - 38, 36);

  // ── Texto do app ao lado do logo ──
  const textoX = margin + 48;
  page.drawText(CLINICA_INFO.appNome, {
    x: textoX,
    y: startY - 14,
    font: fontBold,
    size: 18,
    color: rgb(0.45, 0.36, 0.62), // brand purple
  });
  page.drawText(CLINICA_INFO.appTagline, {
    x: textoX,
    y: startY - 28,
    font,
    size: 9,
    color: rgb(0.5, 0.5, 0.55),
  });

  // ── Bloco institucional à direita (CNPJ, endereço, contato) ──
  const dirX = pageWidth - margin;
  let dirY = startY - 8;
  const linhaDir = (
    texto: string,
    size: number,
    color = rgb(0.4, 0.4, 0.45),
    bold = false,
  ) => {
    const f = bold ? fontBold : font;
    const w = f.widthOfTextAtSize(texto, size);
    page.drawText(texto, { x: dirX - w, y: dirY, font: f, size, color });
    dirY -= size + 1.5;
  };

  linhaDir(CLINICA_INFO.nomeFantasia, 9, rgb(0.2, 0.2, 0.25), true);
  linhaDir(`CNPJ ${CLINICA_INFO.cnpj}`, 7);
  linhaDir(CLINICA_INFO.endereco, 7);
  linhaDir(`${CLINICA_INFO.bairroCidadeUf} · CEP ${CLINICA_INFO.cep}`, 7);
  linhaDir(
    `WhatsApp: ${CLINICA_INFO.whatsapp} · Fixo: ${CLINICA_INFO.telefone} · ${CLINICA_INFO.email}`,
    7,
  );
  linhaDir(
    `Resp. técnico: ${CLINICA_INFO.responsavelTecnico} · ${CLINICA_INFO.crmRt}`,
    7,
    rgb(0.45, 0.36, 0.62),
    true,
  );

  // ── Linha divisória ──
  const lineY = Math.min(startY - 60, dirY - 4);
  page.drawLine({
    start: { x: margin, y: lineY },
    end: { x: pageWidth - margin, y: lineY },
    thickness: 0.8,
    color: rgb(0.85, 0.82, 0.92),
  });

  return lineY - 18;
}

/**
 * Logo Facilita PrEP — versão simplificada para PDF (vetorial via pdf-lib).
 * Mantém a estética: 2 "pétalas" em gradiente lilás/azul + glow central branco.
 *
 * Como pdf-lib não tem gradientes/filtros, emulamos com camadas concêntricas
 * de elipses com opacidades diferentes.
 */
function desenharLogoFacilita(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;

  // Pétala esquerda (lilás)
  const lilas = rgb(0.72, 0.56, 0.82);
  page.drawEllipse({
    x: cx - r * 0.22,
    y: cy,
    xScale: r * 0.42,
    yScale: r * 0.78,
    color: lilas,
    opacity: 0.25,
  });
  page.drawEllipse({
    x: cx - r * 0.22,
    y: cy,
    xScale: r * 0.36,
    yScale: r * 0.68,
    color: lilas,
    opacity: 0.45,
  });

  // Pétala direita (azul)
  const azul = rgb(0.53, 0.67, 0.81);
  page.drawEllipse({
    x: cx + r * 0.22,
    y: cy,
    xScale: r * 0.42,
    yScale: r * 0.78,
    color: azul,
    opacity: 0.25,
  });
  page.drawEllipse({
    x: cx + r * 0.22,
    y: cy,
    xScale: r * 0.36,
    yScale: r * 0.68,
    color: azul,
    opacity: 0.45,
  });

  // Glow central
  page.drawEllipse({
    x: cx,
    y: cy,
    xScale: r * 0.32,
    yScale: r * 0.42,
    color: rgb(0.95, 0.92, 0.98),
    opacity: 0.85,
  });
  page.drawEllipse({
    x: cx,
    y: cy,
    xScale: r * 0.16,
    yScale: r * 0.22,
    color: rgb(1, 1, 1),
    opacity: 0.95,
  });
}
