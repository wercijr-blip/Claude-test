/**
 * Seed de dados para desenvolvimento local.
 * Uso: pnpm seed  (ou pnpm db:seed)
 *
 * Cria:
 *  - Usuários de teste (admin, médico, secretaria)
 *  - Token de acesso fixo para facilitar testes manuais:
 *      DEV_TOKEN = dev-access-token-1234567890abcdef
 *  - Paciente de exemplo vinculado ao token
 */
import { db } from "./db.ts";
import { users, accessTokens, pacientes } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { encrypt, hashCpf } from "./_core/encryption.ts";
import { hashToken } from "./_core/tokenUtils.ts";

const DEV_RAW_TOKEN = "dev-access-token-1234567890abcdef";
const DEV_TOKEN_HASH = hashToken(DEV_RAW_TOKEN);

async function seed() {
  console.log("Seeding dados de desenvolvimento...");

  // ── Usuários ────────────────────────────────────────────────
  await db
    .insert(users)
    .values([
      {
        openId: "dev-admin-google-sub",
        nome: "Dev Admin",
        email: "admin@dev.local",
        role: "admin",
        ativo: true,
      },
      {
        openId: "dev-medico-google-sub",
        nome: "Dr. Dev Médico",
        email: "medico@dev.local",
        role: "medico",
        ativo: true,
      },
      {
        openId: "dev-secretaria-google-sub",
        nome: "Dev Secretaria",
        email: "secretaria@dev.local",
        role: "secretaria",
        ativo: true,
      },
    ])
    .onDuplicateKeyUpdate({ set: { ativo: true } });

  const [adminRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.openId, "dev-admin-google-sub"))
    .limit(1);

  if (!adminRow) {
    console.error("Admin user não encontrado após insert.");
    process.exit(1);
  }

  // ── Token de acesso DEV ─────────────────────────────────────
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days

  await db
    .insert(accessTokens)
    .values({
      tokenHash: DEV_TOKEN_HASH,
      patientEmail: "paciente@dev.local",
      tipo: "privado",
      expiresAt,
      createdById: adminRow.id,
    })
    .onDuplicateKeyUpdate({ set: { expiresAt } });

  const [tokenRow] = await db
    .select({ id: accessTokens.id })
    .from(accessTokens)
    .where(eq(accessTokens.tokenHash, DEV_TOKEN_HASH))
    .limit(1);

  if (!tokenRow) {
    console.error("Token não encontrado após insert.");
    process.exit(1);
  }

  // ── Paciente de exemplo ──────────────────────────────────────
  const retentionUntil = new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000); // +20 anos (CFM)

  await db
    .insert(pacientes)
    .values({
      tokenId: tokenRow.id,
      cpfEncrypted: encrypt("123.456.789-09"),
      cpfHash: hashCpf("123.456.789-09"),
      nomeEncrypted: encrypt("Paciente Dev Exemplo"),
      dataNascimentoEncrypted: encrypt("1990-01-01"),
      emailEncrypted: encrypt("paciente@dev.local"),
      telefoneEncrypted: encrypt("+5561999999999"),
      status: "pendente",
      currentStep: 3,
      retentionUntil,
    })
    .onDuplicateKeyUpdate({ set: { status: "pendente" } });

  console.log("✓ Seed concluído.");
  console.log();
  console.log("  Usuários:");
  console.log("    admin@dev.local       (role: admin)");
  console.log("    medico@dev.local      (role: medico)");
  console.log("    secretaria@dev.local  (role: secretaria)");
  console.log();
  console.log("  Token de acesso para paciente:");
  console.log(`    DEV_TOKEN = ${DEV_RAW_TOKEN}`);
  console.log("    Acesso: POST /trpc/token.validar { token: DEV_TOKEN }");
  console.log();
  console.log("  Paciente de exemplo:");
  console.log("    CPF: 123.456.789-09 | Status: pendente | Step: 3");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed falhou:", err);
  process.exit(1);
});
