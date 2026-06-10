import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  EXAMES_PRIMEIRO_ATENDIMENTO,
  EXAMES_FOLLOWUP_PREP,
  EXAMES_HIV_ISOLADO,
  EXAMES_SOROLOGICOS_IST,
  EXAMES_DENSITOMETRIA,
  type Exame,
} from "../shared/const.ts";
import {
  desenharCarimboDigital,
  carimboFromEnv,
} from "./sus/carimboDigital.ts";
import {
  desenharCabecalhoInstitucional,
  desenharBannerTitulo,
  desenharBlocoPaciente,
  desenharIndicacaoCID,
  type DadosPaciente,
} from "./pdfHeader.ts";

async function gerarPdfPedido(
  exames: readonly Exame[],
  titulo: string,
  subtitulo: string,
  paciente: DadosPaciente,
  tokenId: number,
  tipoDoc: string,
  observacao?: string,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const margin = 50;
  // y mínimo antes de iniciar nova página (reserva rodapé)
  const MIN_Y = 80;

  // Adiciona nova página e retorna referência + cursor inicial
  const novaPage = () => {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    return { page: p, y: PAGE_H - 60 };
  };

  let { page, y } = novaPage();
  const carimbo = carimboFromEnv(tipoDoc, tokenId);
  const desenharCarimboNaPagina = (p: import("pdf-lib").PDFPage) =>
    desenharCarimboDigital(
      doc,
      p,
      { x: margin, y: 8, width: PAGE_W - margin * 2, height: 60 },
      carimbo,
    );

  // Cabeçalho institucional (logo + clínica)
  y = desenharCabecalhoInstitucional({
    doc,
    page,
    font,
    fontBold,
    pageWidth: PAGE_W,
    margin,
    startY: y + 60,
  });

  // Banner destacado (mesmo modelo do Documento de Orientação)
  y = desenharBannerTitulo({
    page,
    font,
    fontBold,
    pageWidth: PAGE_W,
    margin,
    startY: y,
    titulo: titulo.toUpperCase(),
    subtitulo,
  });

  // Bloco do paciente (nome + CPF)
  y = desenharBlocoPaciente({
    page,
    font,
    fontBold,
    pageWidth: PAGE_W,
    margin,
    startY: y,
    paciente,
  });

  // Lista de exames
  page.drawText("EXAMES SOLICITADOS", {
    x: margin,
    y,
    font: fontBold,
    size: 9,
    color: rgb(0.4, 0.4, 0.45),
  });
  y -= 16;

  for (const exame of exames) {
    // Quebra de página quando o espaço acabar
    if (y < MIN_Y) {
      await desenharCarimboNaPagina(page);
      ({ page, y } = novaPage());
      // Cabeçalho de continuação
      page.drawText(`${titulo} (continuação)`, {
        x: margin,
        y,
        font: fontBold,
        size: 11,
        color: rgb(0.07, 0.27, 0.52),
      });
      y -= 14;
      page.drawLine({
        start: { x: margin, y },
        end: { x: PAGE_W - margin, y },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= 20;
    }
    page.drawText(`•  ${exame.nome}`, {
      x: margin + 8,
      y,
      font,
      size: 10,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(`TUSS ${exame.tuss}`, {
      x: PAGE_W - margin - 90,
      y,
      font,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 18;
  }

  if (observacao) {
    if (y < MIN_Y + 40) {
      await desenharCarimboNaPagina(page);
      ({ page, y } = novaPage());
    }
    y -= 8;
    page.drawText("OBSERVAÇÃO", {
      x: margin,
      y,
      font: fontBold,
      size: 9,
      color: rgb(0.4, 0.4, 0.45),
    });
    y -= 13;
    page.drawText(observacao, {
      x: margin,
      y,
      font,
      size: 9,
      color: rgb(0.3, 0.3, 0.35),
      maxWidth: PAGE_W - margin * 2,
    });
    y -= 18;
  }

  // Indicação clínica + CID + validade 180d
  // Garante espaço (mínimo ~80pt) ou nova página
  if (y < MIN_Y + 60) {
    await desenharCarimboNaPagina(page);
    ({ page, y } = novaPage());
  }
  desenharIndicacaoCID({
    page,
    font,
    fontBold,
    margin,
    pageWidth: PAGE_W,
    startY: y,
    indicacao:
      "Profilaxia Pré-Exposição (PrEP) ao HIV — protocolo Ministério da Saúde 2024.",
    validadeDias: 180,
  });

  // Carimbo digital com QR Code na última página
  await desenharCarimboNaPagina(page);

  return Buffer.from(await doc.save());
}

export async function gerarPedidosExames(
  tipoConsulta: "primeiro_atendimento" | "ja_faco_prep",
  paciente: DadosPaciente,
  tokenId: number,
): Promise<{
  completo: Buffer;
  ist: Buffer;
  hiv: Buffer;
  densitometria: Buffer;
}> {
  const examesCompleto =
    tipoConsulta === "primeiro_atendimento"
      ? EXAMES_PRIMEIRO_ATENDIMENTO
      : EXAMES_FOLLOWUP_PREP;

  const subtituloCompleto =
    tipoConsulta === "primeiro_atendimento"
      ? "Triagem inicial para início da PrEP"
      : "Acompanhamento semestral — PrEP em uso";

  const [completo, ist, hiv, densitometria] = await Promise.all([
    gerarPdfPedido(
      examesCompleto,
      "Pedido de Exames Completo",
      subtituloCompleto,
      paciente,
      tokenId,
      "pedido_completo",
    ),
    gerarPdfPedido(
      EXAMES_SOROLOGICOS_IST,
      "Pedido de Exames Sorológicos de IST",
      "Infecções sexualmente transmissíveis — rastreamento PrEP",
      paciente,
      tokenId,
      "pedido_ist",
    ),
    gerarPdfPedido(
      EXAMES_HIV_ISOLADO,
      "Pedido de Exame Anti-HIV",
      "Anti-HIV 1/2 com Ag p24 — 4ª geração",
      paciente,
      tokenId,
      "pedido_hiv",
    ),
    gerarPdfPedido(
      EXAMES_DENSITOMETRIA,
      "Pedido de Densitometria Óssea",
      "Monitoramento de densidade mineral óssea — uso de Tenofovir (TDF)",
      paciente,
      tokenId,
      "pedido_densitometria",
      "Indicado para monitoramento de pacientes em uso de Tenofovir Disoproxil Fumarato (TDF). Repetir a cada 12 meses.",
    ),
  ]);

  return { completo, ist, hiv, densitometria };
}
