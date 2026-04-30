import { relations } from 'drizzle-orm'
import {
  users,
  accessTokens,
  pacientes,
  exames,
  tcleAssinaturas,
  pdfs,
  nfseRegistros,
  pagamentos,
  securityEvents,
  consultasInicio,
  precadastros,
  satisfacaoPesquisas,
  pesquisaTokens,
} from './schema.ts'

export const usersRelations = relations(users, ({ many }) => ({
  tokensGerados: many(accessTokens),
  pacientesComoMedico: many(pacientes),
  eventosSeguranca: many(securityEvents),
}))

export const accessTokensRelations = relations(accessTokens, ({ one }) => ({
  criadoPor: one(users, {
    fields: [accessTokens.createdById],
    references: [users.id],
  }),
  paciente: one(pacientes, {
    fields: [accessTokens.id],
    references: [pacientes.tokenId],
  }),
}))

export const pacientesRelations = relations(pacientes, ({ one, many }) => ({
  token: one(accessTokens, {
    fields: [pacientes.tokenId],
    references: [accessTokens.id],
  }),
  medico: one(users, {
    fields: [pacientes.medicoId],
    references: [users.id],
  }),
  exames: many(exames),
  tcleAssinatura: one(tcleAssinaturas, {
    fields: [pacientes.id],
    references: [tcleAssinaturas.pacienteId],
  }),
  pdfs: many(pdfs),
  nfseRegistros: many(nfseRegistros),
  pagamentos: many(pagamentos),
}))

export const examesRelations = relations(exames, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [exames.pacienteId],
    references: [pacientes.id],
  }),
  revisadoPor: one(users, {
    fields: [exames.revisadoPorId],
    references: [users.id],
  }),
}))

export const tcleAssinaturasRelations = relations(tcleAssinaturas, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [tcleAssinaturas.pacienteId],
    references: [pacientes.id],
  }),
}))

export const pdfsRelations = relations(pdfs, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [pdfs.pacienteId],
    references: [pacientes.id],
  }),
}))

export const nfseRegistrosRelations = relations(nfseRegistros, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [nfseRegistros.pacienteId],
    references: [pacientes.id],
  }),
}))

export const pagamentosRelations = relations(pagamentos, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [pagamentos.pacienteId],
    references: [pacientes.id],
  }),
}))

export const securityEventsRelations = relations(securityEvents, ({ one }) => ({
  user: one(users, {
    fields: [securityEvents.userId],
    references: [users.id],
  }),
}))

export const consultasInicioRelations = relations(consultasInicio, ({ one }) => ({
  token: one(accessTokens, {
    fields: [consultasInicio.tokenId],
    references: [accessTokens.id],
  }),
  validadoPor: one(users, {
    fields: [consultasInicio.validadoPorId],
    references: [users.id],
  }),
}))

export const precadastrosRelations = relations(precadastros, ({ one }) => ({
  accessToken: one(accessTokens, {
    fields: [precadastros.accessTokenId],
    references: [accessTokens.id],
  }),
  validadoPor: one(users, {
    fields: [precadastros.validadoPorId],
    references: [users.id],
  }),
}))

export const satisfacaoPesquisasRelations = relations(satisfacaoPesquisas, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [satisfacaoPesquisas.pacienteId],
    references: [pacientes.id],
  }),
}))

export const pesquisaTokensRelations = relations(pesquisaTokens, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [pesquisaTokens.pacienteId],
    references: [pacientes.id],
  }),
}))
