import { PDFDocument, PDFName, rgb, StandardFonts } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import forge from "node-forge";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { SUBFILTER_ETSI_CADES_DETACHED } from "@signpdf/utils";
import { env } from "./_core/env.ts";
import {
  RT_NOME,
  RT_CRM,
  RT_RQE,
  RT_ESPECIALIDADE,
  SBIS_MODEL_VERSION,
  SBIS_SYSTEM_VERSION,
  SBIS_NIVEL,
} from "./_core/sbis.ts";
import {
  desenharCarimboDigital,
  carimboFromEnv,
} from "./sus/carimboDigital.ts";
import {
  desenharCabecalhoInstitucional,
  desenharBannerTitulo,
  desenharBlocoPaciente,
  desenharIndicacaoCID,
  drawTextWrapped,
} from "./pdfHeader.ts";

const signpdf = new SignPdf();

// ── NGS2.05 — XMP metadata helper ───────────────────────────
// Builds a minimal XMP packet with SBIS custom namespace for auditability.
// Injected into the PDF catalog before ICP-Brasil signing.
function buildXmpSbis(titulo: string, createDate: Date): string {
  const iso = createDate.toISOString();
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:sbis="http://sbis.org.br/ns/conformidade/1.0/">
      <dc:title><rdf:Alt><rdf:li xml:lang="pt-BR">${titulo}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${RT_NOME}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="pt-BR">Documento médico telemedicina — Facilita PrEP — SBIS NGS2</rdf:li></rdf:Alt></dc:description>
      <xmp:CreatorTool>Facilita PrEP v${SBIS_SYSTEM_VERSION}</xmp:CreatorTool>
      <xmp:CreateDate>${iso}</xmp:CreateDate>
      <xmp:ModifyDate>${iso}</xmp:ModifyDate>
      <pdf:Producer>Facilita PrEP — ICP-Brasil</pdf:Producer>
      <pdf:Keywords>SBIS;PrEP;ICP-Brasil;CFM 2.299/2021;LGPD;Telemedicina;${RT_CRM}</pdf:Keywords>
      <sbis:nivel>${SBIS_NIVEL}</sbis:nivel>
      <sbis:responsavelTecnico>${RT_NOME} — ${RT_CRM} — RQE ${RT_RQE} — ${RT_ESPECIALIDADE}</sbis:responsavelTecnico>
      <sbis:modeloIa>${SBIS_MODEL_VERSION}</sbis:modeloIa>
      <sbis:conformidade>BPIA+ECF+NGS1+NGS2</sbis:conformidade>
      <sbis:assinaturaDigital>ICP-Brasil — CFM 2.299/2021 — ETSI CAdES Detached</sbis:assinaturaDigital>
      <sbis:lgpd>Lei 13.709/2018 — art. 11 — Retenção 20 anos (CFM 2.218/2018)</sbis:lgpd>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CERTS_DIR = path.join(__dirname, "certs");

export interface PdfSignResult {
  buffer: Buffer;
  certificadoSerial: string;
  assinadoEm: Date;
}

export async function gerarPrescricaoPdf(
  paciente: Paciente & { pacienteId?: number; cpf?: string | null },
): Promise<Buffer> {
  const doc = await PDFDocument.create();

  // NGS2.05 — Metadados padrão PDF (Info dictionary) para auditabilidade
  doc.setTitle("Receita Médica — PrEP — Facilita PrEP");
  doc.setAuthor(RT_NOME);
  doc.setSubject(
    `Prescrição PrEP — Profilaxia Pré-Exposição ao HIV — ${RT_CRM}`,
  );
  doc.setKeywords([
    "PrEP",
    "HIV",
    "Infectologia",
    "ICP-Brasil",
    "CFM 2.299/2021",
    "SBIS",
    "LGPD",
    RT_CRM,
  ]);
  doc.setProducer("Facilita PrEP — ICP-Brasil");
  doc.setCreator(`Facilita PrEP v${SBIS_SYSTEM_VERSION}`);
  doc.setCreationDate(new Date());

  const PAGE_W = 595;
  const PAGE_H = 842;
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;

  // Cabeçalho institucional padronizado (mesmo layout dos pedidos de exame).
  // startY = PAGE_H corresponde ao topo da página — equivalente ao padrão
  // de pdfExameRequest/pdfOrientacao que usam (PAGE_H - 60) + 60.
  let y = desenharCabecalhoInstitucional({
    doc,
    page,
    font,
    fontBold,
    pageWidth: PAGE_W,
    margin,
    startY: PAGE_H,
  });

  // Banner roxo "RECEITA MÉDICA"
  const validadeDate = new Date();
  validadeDate.setMonth(validadeDate.getMonth() + 4);
  const dataValidade = validadeDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  y = desenharBannerTitulo({
    page,
    font,
    fontBold,
    pageWidth: PAGE_W,
    margin,
    startY: y,
    titulo: "RECEITA MÉDICA",
    subtitulo: `Profilaxia Pré-Exposição (PrEP) ao HIV · Validade até ${dataValidade}`,
  });

  // Bloco do paciente (nome + CPF)
  y = desenharBlocoPaciente({
    page,
    font,
    fontBold,
    pageWidth: PAGE_W,
    margin,
    startY: y,
    paciente: { nome: paciente.nome, cpf: paciente.cpf },
  });

  // Bloco PRESCRIÇÃO
  const prescricao = paciente.prescricaoJson as {
    medicamento?: string;
    posologia?: string;
    duracao?: string;
    observacoes?: string;
  } | null;
  const medicamento =
    prescricao?.medicamento === "tenofovir_emtricitabina"
      ? "Tenofovir 300 mg + Entricitabina 200 mg (TDF/FTC)"
      : (prescricao?.medicamento ?? "—");

  page.drawText("PRESCRIÇÃO", {
    x: margin,
    y,
    font: fontBold,
    size: 9,
    color: rgb(0.4, 0.4, 0.45),
  });
  y -= 16;

  const linhaPrescricao = (label: string, value: string) => {
    page.drawText(`${label}:`, {
      x: margin,
      y,
      font: fontBold,
      size: 10,
      color: rgb(0.2, 0.2, 0.25),
    });
    const valueX = margin + 110;
    const valueMaxW = PAGE_W - margin - valueX;
    const yStart = y;
    const yAfter = drawTextWrapped(page, value, {
      x: valueX,
      y,
      font,
      size: 10,
      color: rgb(0.1, 0.1, 0.15),
      maxWidth: valueMaxW,
      lineHeight: 14,
    });
    // garante pelo menos um avanço de 18pt mesmo se valor for vazio
    y = Math.min(yAfter - 4, yStart - 18);
  };

  linhaPrescricao("Medicamento", medicamento);
  linhaPrescricao("Posologia", prescricao?.posologia ?? "—");
  linhaPrescricao("Duração", prescricao?.duracao ?? "—");

  if (prescricao?.observacoes) {
    y -= 4;
    page.drawText("Observações:", {
      x: margin,
      y,
      font: fontBold,
      size: 9,
      color: rgb(0.4, 0.4, 0.45),
    });
    y -= 13;
    y = drawTextWrapped(page, prescricao.observacoes, {
      x: margin,
      y,
      font,
      size: 9,
      color: rgb(0.2, 0.2, 0.25),
      maxWidth: PAGE_W - margin * 2,
      lineHeight: 12,
    });
    y -= 4;
  }

  // Indicação clínica + CID + validade (mesmo bloco dos pedidos)
  y = Math.max(y - 8, 160);
  desenharIndicacaoCID({
    page,
    font,
    fontBold,
    margin,
    pageWidth: PAGE_W,
    startY: y,
    indicacao:
      "Profilaxia Pré-Exposição (PrEP) ao HIV — protocolo Ministério da Saúde 2024.",
    validadeDias: 120,
  });

  // Carimbo digital com QR Code (assinatura ICP-Brasil é aplicada por assinarPdf)
  const carimboPresc = carimboFromEnv("prescricao", paciente.pacienteId ?? 0);
  await desenharCarimboDigital(
    doc,
    page,
    { x: margin, y: 8, width: PAGE_W - margin * 2, height: 60 },
    carimboPresc,
  );

  return Buffer.from(await doc.save());
}

// gerarFormularioPdf removido — o Formulário Clínico foi descontinuado.
// prepararExameAnexadoComoPdf removido — o exame que o paciente subiu
// fica em consultas_inicio.exameS3Key apenas para auditoria e revisão
// médica; não é reentregue ao paciente no bundle final.

/**
 * Lê o certificado .pfx do ICP-Brasil — prioridade:
 *   1. env.ICP_PFX_BASE64 (Railway/produção)
 *   2. server/certs/werciley.pfx (desenvolvimento)
 */
async function lerPfx(): Promise<Buffer | null> {
  if (env.ICP_PFX_BASE64) return Buffer.from(env.ICP_PFX_BASE64, "base64");
  try {
    return await readFile(path.join(CERTS_DIR, "werciley.pfx"));
  } catch {
    return null;
  }
}

/**
 * Lê o serial do certificado a partir do .pfx para registro de auditoria.
 *
 * Cacheado por byteLength + primeiros 32 bytes do .pfx — em workload de
 * fila (cada PDF assinado), evita re-parsear ASN.1 em todo job.
 *
 * Nunca lança: erro de parsing retorna 'unknown' (a assinatura PAdES já
 * foi aplicada com sucesso pelo P12Signer; a auditoria não deve
 * derrubar o resultado).
 */
let serialCache: { key: string; serial: string } | null = null;

function extrairSerial(pfxData: Buffer, password: string): string {
  const cacheKey = `${pfxData.byteLength}:${pfxData.subarray(0, 32).toString("hex")}`;
  if (serialCache?.key === cacheKey) return serialCache.serial;

  try {
    const pfxDer = pfxData.toString("binary");
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
    const certBag = pfxObj.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ]?.[0];
    const serial = certBag?.cert?.serialNumber ?? "unknown";
    serialCache = { key: cacheKey, serial };
    return serial;
  } catch {
    return "unknown";
  }
}

export interface CertificadoInfo {
  status: "configurado" | "demo" | "erro";
  /** CN (Common Name) do titular */
  titular?: string;
  /** CN do emissor */
  emissor?: string;
  serial?: string;
  validoDe?: Date;
  validoAte?: Date;
  diasRestantes?: number;
  /** True se está dentro do período de validade */
  valido?: boolean;
  /** True se vence em menos de 60 dias */
  vencendoEm60Dias?: boolean;
  mensagem?: string;
}

/**
 * Inspeciona o certificado .pfx ICP-Brasil configurado e retorna informações
 * de validade. Útil para painel de admin acompanhar vencimento do certificado.
 *
 * Não lança exceção em nenhum caso — sempre retorna um status.
 */
export async function inspecionarCertificado(): Promise<CertificadoInfo> {
  const pfxData = await lerPfx();
  if (!pfxData) {
    return {
      status: "demo",
      mensagem:
        "Certificado ICP-Brasil não configurado (modo DEMO em desenvolvimento)",
    };
  }

  try {
    const password = env.ICP_PFX_PASSWORD ?? "";
    const pfxDer = pfxData.toString("binary");
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
    const certBag = pfxObj.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ]?.[0];
    const cert = certBag?.cert;
    if (!cert) {
      return {
        status: "erro",
        mensagem: "Não foi possível extrair certificado do .pfx",
      };
    }

    const agora = new Date();
    const validoDe = cert.validity.notBefore;
    const validoAte = cert.validity.notAfter;
    const diasRestantes = Math.floor(
      (validoAte.getTime() - agora.getTime()) / 86_400_000,
    );
    const valido = agora >= validoDe && agora <= validoAte;

    return {
      status: "configurado",
      titular: cert.subject.getField("CN")?.value,
      emissor: cert.issuer.getField("CN")?.value,
      serial: cert.serialNumber,
      validoDe,
      validoAte,
      diasRestantes,
      valido,
      vencendoEm60Dias: valido && diasRestantes <= 60,
    };
  } catch (err) {
    return {
      status: "erro",
      mensagem: `Erro ao ler certificado: ${(err as Error).message}`,
    };
  }
}

export async function assinarPdf(
  pdfBuffer: Buffer,
  titulo = "Documento PrEP — Facilita PrEP",
): Promise<PdfSignResult> {
  const pfxPassword = env.ICP_PFX_PASSWORD ?? "";
  const pfxData = await lerPfx();

  // Sem certificado: modo DEMO (apenas em desenvolvimento)
  if (!pfxData) {
    if (env.NODE_ENV !== "production") {
      const doc = await PDFDocument.load(pdfBuffer);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      doc.getPages().forEach((p) => {
        const { width } = p.getSize();
        p.drawRectangle({
          x: 0,
          y: 0,
          width,
          height: 22,
          color: rgb(1, 0.92, 0.7),
        });
        p.drawText(
          "DEMO LOCAL — documento NÃO assinado digitalmente (certificado ICP-Brasil ausente)",
          {
            x: 16,
            y: 7,
            size: 8,
            font,
            color: rgb(0.45, 0.3, 0),
          },
        );
      });
      const buf = Buffer.from(await doc.save());
      return {
        buffer: buf,
        certificadoSerial: "DEMO-LOCAL",
        assinadoEm: new Date(),
      };
    }
    throw new Error(
      "Certificado ICP-Brasil não configurado. Defina ICP_PFX_BASE64 no Railway ou coloque werciley.pfx em server/certs/",
    );
  }

  // 1. Atualiza metadados antes da assinatura (para que sejam parte do que é assinado)
  const docComMetadados = await PDFDocument.load(pdfBuffer);
  const assinadoEm = new Date();
  docComMetadados.setTitle(titulo);
  docComMetadados.setAuthor(RT_NOME);
  docComMetadados.setSubject(
    `Documento médico telemedicina — Facilita PrEP — ${RT_CRM} — SBIS NGS2`,
  );
  docComMetadados.setKeywords([
    "ICP-Brasil",
    "SBIS",
    "CFM 2.299/2021",
    "PrEP",
    RT_CRM,
    SBIS_MODEL_VERSION,
  ]);
  docComMetadados.setProducer("Facilita PrEP — ICP-Brasil");
  docComMetadados.setCreator(`Facilita PrEP v${SBIS_SYSTEM_VERSION}`);
  docComMetadados.setModificationDate(assinadoEm);

  // NGS2.05 — Inject XMP metadata stream into PDF catalog for machine-readable audit
  const xmpXml = buildXmpSbis(titulo, assinadoEm);
  const xmpBytes = Buffer.from(xmpXml, "utf-8");
  const xmpStream = docComMetadados.context.stream(xmpBytes, {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  });
  docComMetadados.catalog.set(
    PDFName.of("Metadata"),
    docComMetadados.context.register(xmpStream),
  );

  // NGS2.05 — Add visible SBIS compliance footer strip to every page
  const sbisFont = await docComMetadados.embedFont(StandardFonts.Helvetica);
  const stripLabel =
    `SBIS NGS2 · Auditável | RT: ${RT_NOME} · ${RT_CRM} · RQE ${RT_RQE} | ` +
    `ICP-Brasil CFM 2.299/2021 | ${assinadoEm.toISOString().replace("T", " ").slice(0, 19)} UTC`;
  for (const page of docComMetadados.getPages()) {
    const { width } = page.getSize();
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 13,
      color: rgb(0.18, 0.12, 0.35),
    });
    page.drawText(stripLabel, {
      x: 8,
      y: 2.5,
      size: 5,
      font: sbisFont,
      color: rgb(0.85, 0.8, 0.95),
    });
  }

  const pdfComMetadados = Buffer.from(
    await docComMetadados.save({ useObjectStreams: false }),
  );

  // 2. Adiciona placeholder de assinatura no PDF (PAdES SubFilter ETSI.CAdES.detached)
  const pdfComPlaceholder = plainAddPlaceholder({
    pdfBuffer: pdfComMetadados,
    reason: "Documento médico assinado digitalmente — Facilita PrEP",
    contactInfo: env.MEDICO_NOME,
    name: env.MEDICO_NOME,
    location: `${env.MEDICO_CRM_TIPO}/${env.MEDICO_CRM_UF} ${env.MEDICO_CRM}`,
    signingTime: assinadoEm,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
    appName: "Facilita PrEP",
  });

  // 3. Assina o placeholder com o .pfx (PKCS#7 detached SignedData)
  const signer = new P12Signer(pfxData, { passphrase: pfxPassword });
  const signedBuffer = await signpdf.sign(pdfComPlaceholder, signer);

  const certificadoSerial = extrairSerial(pfxData, pfxPassword);

  return {
    buffer: Buffer.from(signedBuffer),
    certificadoSerial,
    assinadoEm,
  };
}

// Tipos locais auxiliares
interface Paciente {
  nome: string;
  dataNascimento: string | null;
  sexo: string | null;
  prescricaoJson: unknown;
}
