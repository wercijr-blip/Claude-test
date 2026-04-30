import { z } from 'zod'
import { router, staffProcedure } from '../_core/trpc.ts'
import { db } from '../db.ts'
import { exames, pacientes } from '../../drizzle/schema.ts'
import { eq } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { filtrarExamePorStatus } from '../examUtils.ts'

export const secretariaRouter = router({
  // Listar todos os documentos (exames) enviados por pacientes
  listarDocumentos: staffProcedure
    .input(
      z.object({
        status: z.enum(['todos', 'pendente', 'validado', 'rejeitado', 'liberado']).default('todos'),
      }).optional(),
    )
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: exames.id,
          pacienteId: exames.pacienteId,
          nomeArquivo: exames.nomeArquivo,
          tipoExame: exames.tipoExame,
          mimeType: exames.mimeType,
          resultadoIa: exames.resultadoIa,
          revisadoPorId: exames.revisadoPorId,
          revisadoEm: exames.revisadoEm,
          liberadoPorMedicoId: exames.liberadoPorMedicoId,
          liberadoEm: exames.liberadoEm,
          createdAt: exames.createdAt,
          // Paciente info
          pacienteNomeEncrypted: pacientes.nomeEncrypted,
          pacienteEmailEncrypted: pacientes.emailEncrypted,
          pacienteStatus: pacientes.status,
          pacienteTipoAtendimento: pacientes.tipoAtendimento,
        })
        .from(exames)
        .leftJoin(pacientes, eq(pacientes.id, exames.pacienteId))
        .orderBy(exames.createdAt)

      const statusFiltro = input?.status ?? 'todos'

      return rows
        .filter((r) =>
          filtrarExamePorStatus(r.resultadoIa as { status?: string } | null, statusFiltro),
        )
        .map((r) => ({
          id: r.id,
          pacienteId: r.pacienteId,
          nomeArquivo: r.nomeArquivo,
          tipoExame: r.tipoExame,
          mimeType: r.mimeType,
          resultadoIa: r.resultadoIa,
          revisadoEm: r.revisadoEm,
          liberadoEm: r.liberadoEm,
          createdAt: r.createdAt,
          paciente: {
            nome: r.pacienteNomeEncrypted ? decrypt(r.pacienteNomeEncrypted) : null,
            email: r.pacienteEmailEncrypted ? decrypt(r.pacienteEmailEncrypted) : null,
            status: r.pacienteStatus,
            tipoAtendimento: r.pacienteTipoAtendimento,
          },
        }))
    }),
})
