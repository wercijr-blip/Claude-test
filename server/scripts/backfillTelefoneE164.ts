/**
 * One-time backfill: converts legacy BR phone numbers (10-11 digits, no +55)
 * stored in encrypted columns to E.164 format (+55XXXXXXXXXXX).
 *
 * Run ONCE in production after deploying the E.164 validation change:
 *   tsx server/scripts/backfillTelefoneE164.ts
 *
 * Safe to re-run — skips records that are already in E.164 format.
 */
import "../_core/instrument.ts";
import { db } from "../db.ts";
import { pacientes, precadastros } from "../../drizzle/schema.ts";
import { decrypt, encrypt } from "../_core/encryption.ts";
import { isNotNull, eq } from "drizzle-orm";

let updated = 0;
let skipped = 0;
let errors = 0;

async function backfillTable(
  table: typeof pacientes | typeof precadastros,
  tableName: string,
): Promise<void> {
  const rows = await db
    .select({ id: table.id, telefoneEncrypted: table.telefoneEncrypted })
    .from(table)
    .where(isNotNull(table.telefoneEncrypted));

  console.log(`[${tableName}] ${rows.length} registros com telefone`);

  for (const row of rows) {
    if (!row.telefoneEncrypted) continue;
    try {
      const tel = decrypt(row.telefoneEncrypted);
      if (!tel || tel.startsWith("+")) {
        skipped++;
        continue;
      }

      const digits = tel.replace(/\D/g, "");
      if (digits.length !== 10 && digits.length !== 11) {
        skipped++;
        continue;
      }

      const e164 = `+55${digits}`;
      await db
        .update(table)
        .set({ telefoneEncrypted: encrypt(e164) })
        .where(eq(table.id, row.id));
      updated++;
    } catch (err) {
      console.error(
        `[${tableName}] Erro no registro ${row.id}:`,
        (err as Error).message,
      );
      errors++;
    }
  }
}

await backfillTable(pacientes, "pacientes");
await backfillTable(precadastros, "precadastros");

console.log(`\nBackfill concluído:`);
console.log(`  Atualizados: ${updated}`);
console.log(`  Ignorados (já E.164 ou inválidos): ${skipped}`);
console.log(`  Erros: ${errors}`);

process.exit(errors > 0 ? 1 : 0);
