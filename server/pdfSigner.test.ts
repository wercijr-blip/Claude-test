import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import forge from "node-forge";
import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

vi.mock("./_core/env.ts", () => ({
  env: {
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-with-at-least-32-chars-here",
    ENCRYPTION_KEY: "a".repeat(64),
    CPF_HASH_SALT: "test-salt-with-at-least-32-chars-here",
    OAUTH_SERVER_URL: "https://oauth.example.com",
    OWNER_OPEN_ID: "owner-id",
    VITE_APP_ID: "facilita-prep",
    AWS_ACCESS_KEY_ID: "key",
    AWS_SECRET_ACCESS_KEY: "secret",
    AWS_REGION: "sa-east-1",
    AWS_S3_BUCKET: "bucket",
    REDIS_URL: "redis://localhost:6379",
    ASAAS_ENV: "sandbox",
    BUILT_IN_FORGE_API_URL: "https://api.anthropic.com",
    APP_URL: "https://facilitaprep.com.br",
    PORT: 3000,
    CONSULTA_VALOR: 250,
    ENABLE_DEBIT_CARD: false,
    MEDICO_NOME: "Dr. Teste",
    MEDICO_CRM_TIPO: "CRM",
    MEDICO_CRM_UF: "DF",
    MEDICO_CRM: "12345",
  },
}));

// id-aa-signingCertificateV2 (RFC 5035) — nome que o próprio OpenSSL usa ao
// reconhecer o OID (confirma que é exatamente o atributo CAdES padrão, não
// um valor inventado).
const OID_SIGNING_CERTIFICATE_V2 = "1.2.840.113549.1.9.16.2.47";
const NOME_OPENSSL_SIGNING_CERTIFICATE_V2 = "id-smime-aa-signingCertificateV2";

// Não é um PDF real — só um payload para exercitar a assinatura detached.
// A estrutura do atributo CAdES sob teste independe do conteúdo assinado.
const CONTEUDO_TESTE = Buffer.from("conteudo-de-teste-para-assinatura");

/**
 * Gera um par de chaves + certificado autoassinado descartável, inteiramente
 * em memória — não usa nem precisa do certificado real ICP-Brasil. Serve para
 * validar a MECÂNICA ASN.1/criptográfica do signer (estrutura CMS correta,
 * hash correto, assinatura verificável por um parser independente — OpenSSL),
 * não para testar aceitação real no verificador do ITI. Isso exige o
 * certificado ICP-Brasil de produção e precisa ser conferido manualmente
 * (verificador.iti.gov.br) antes de confiar plenamente na correção.
 */
function gerarCertificadoDeTeste() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: "commonName", value: "Teste ICP-Brasil" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { keys, cert };
}

function gerarPfxDeTeste(
  keys: forge.pki.rsa.KeyPair,
  cert: forge.pki.Certificate,
  password: string,
): Buffer {
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "3des",
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(p12Der, "binary");
}

describe("IcpCadesP12Signer — atributo CAdES signingCertificateV2 (RFC 5035)", () => {
  const senha = "senha-teste";
  let certTeste: forge.pki.Certificate;
  let signedDer: Buffer;
  let opensslPrint: string;
  const tmpDir = mkdtempSync(path.join(tmpdir(), "icp-cades-test-"));
  const sigPath = path.join(tmpDir, "sig.der");
  const contentPath = path.join(tmpDir, "content.bin");
  const certPath = path.join(tmpDir, "cert.pem");

  beforeAll(async () => {
    const { keys, cert } = gerarCertificadoDeTeste();
    certTeste = cert;
    const pfxBuffer = gerarPfxDeTeste(keys, cert, senha);

    const { IcpCadesP12Signer } = await import("./pdfSigner.ts");
    const signer = new IcpCadesP12Signer(pfxBuffer, { passphrase: senha });
    signedDer = await signer.sign(
      CONTEUDO_TESTE,
      new Date("2025-01-01T12:00:00Z"),
    );

    writeFileSync(sigPath, signedDer);
    writeFileSync(contentPath, CONTEUDO_TESTE);
    writeFileSync(certPath, forge.pki.certificateToPem(certTeste));

    // Dump com um parser CMS/PKCS#7 padrão de mercado, independente deste
    // projeto e do forge — forge.pkcs7.fromAsn1 não reconstrói
    // authenticatedAttributes ao parsear de volta (só addSigner/sign
    // populam isso), então inspecionar a estrutura via forge não é viável.
    opensslPrint = execFileSync("openssl", [
      "cms",
      "-cmsout",
      "-print",
      "-in",
      sigPath,
      "-inform",
      "DER",
    ]).toString();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("produz uma assinatura sem lançar erro", () => {
    expect(signedDer).toBeInstanceOf(Buffer);
    expect(signedDer.length).toBeGreaterThan(0);
  });

  it("o PKCS#7 resultante contém os 4 atributos autenticados esperados, na ordem, incluindo signingCertificateV2", () => {
    const ordemEsperada = [
      "contentType",
      "signingTime",
      "messageDigest",
      NOME_OPENSSL_SIGNING_CERTIFICATE_V2,
    ];
    const posicoes = ordemEsperada.map((nome) => opensslPrint.indexOf(nome));

    expect(posicoes.every((p) => p !== -1)).toBe(true);
    // Confere a ordem relativa (cada atributo aparece depois do anterior no dump).
    for (let i = 1; i < posicoes.length; i++) {
      expect(posicoes[i]!).toBeGreaterThan(posicoes[i - 1]!);
    }

    // Garante que só existem 4 (não sobrou nenhum atributo extra/duplicado)
    // e que o OID bate exatamente com o esperado.
    expect(opensslPrint).toContain(
      `${NOME_OPENSSL_SIGNING_CERTIFICATE_V2} (${OID_SIGNING_CERTIFICATE_V2})`,
    );
    expect(
      opensslPrint.split("object:").length - 1, // "object:" aparece 1x por atributo no dump
    ).toBe(4);
  });

  it("o certHash dentro de signingCertificateV2 é o SHA-256 do certificado (DER) usado para assinar", () => {
    const certDer = forge.asn1
      .toDer(forge.pki.certificateToAsn1(certTeste))
      .getBytes();
    const md = forge.md.sha256.create();
    md.update(certDer);
    const certHashHex = md.digest().toHex().toUpperCase();

    // O dump do OpenSSL mostra o certHash como HEX DUMP dentro do OCTET
    // STRING do ESSCertIDv2 — confere que é exatamente o SHA-256 do
    // certificado usado, não um valor arbitrário ou de outro certificado.
    expect(opensslPrint).toContain(certHashHex);
  });

  it("o OpenSSL (parser CMS/PKCS#7 independente) verifica a assinatura sem erro", () => {
    // Verificação de ponta a ponta com um parser CMS padrão de mercado — não
    // depende de nenhuma lógica deste projeto (nem forge) para confirmar que
    // a estrutura ASN.1 e a assinatura RSA são válidas. -noverify pula a
    // cadeia de confiança (irrelevante aqui: o certificado de teste é
    // autoassinado, não ICP-Brasil real). Aceitação real no verificador do
    // ITI ainda precisa ser conferida manualmente com o certificado de
    // produção antes de confiar plenamente na correção.
    const outPath = path.join(tmpDir, "out.bin");
    expect(() =>
      execFileSync("openssl", [
        "cms",
        "-verify",
        "-in",
        sigPath,
        "-inform",
        "DER",
        "-content",
        contentPath,
        "-noverify",
        "-certfile",
        certPath,
        "-out",
        outPath,
      ]),
    ).not.toThrow();
  });
});
