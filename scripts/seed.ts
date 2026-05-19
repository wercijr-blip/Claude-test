#!/usr/bin/env tsx
/**
 * Seed script para desenvolvimento local.
 * Uso: pnpm tsx scripts/seed.ts
 *
 * Cria: 1 usuário admin, 1 usuário médico, 1 token de acesso de exemplo.
 * Idempotente: usa INSERT IGNORE / onDuplicateKeyUpdate.
 */

import { db } from "../server/db.ts";
import { users } from "../drizzle/cis-schema.ts";

async function seed() {
  console.log("🌱 Iniciando seed...");

  // Admin de desenvolvimento
  await db
    .insert(users)
    .values({
      openId: "dev-admin-openid-001",
      email: "admin@dev.local",
      nome: "Admin Dev",
      role: "admin",
      ativo: true,
    })
    .onDuplicateKeyUpdate({ set: { email: "admin@dev.local" } });

  // Médico de desenvolvimento
  await db
    .insert(users)
    .values({
      openId: "dev-medico-openid-002",
      email: "medico@dev.local",
      nome: "Dr. Werciley Dev",
      role: "medico",
      ativo: true,
    })
    .onDuplicateKeyUpdate({ set: { email: "medico@dev.local" } });

  console.log("✅ Seed concluído.");
  console.log("   Admin: admin@dev.local");
  console.log("   Médico: medico@dev.local");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed falhou:", err);
  process.exit(1);
});
