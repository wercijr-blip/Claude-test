import { randomBytes } from 'crypto'
import { userCount, insertUser } from './db.js'
import { hashPassword } from './auth.js'
import { logger } from '../utils/logger.js'

function randomPassword() {
  return randomBytes(12).toString('base64url')
}

export function seedDefaultUsers() {
  if (userCount() > 0) return

  const adminPwd       = randomPassword()
  const secretariaPwd  = randomPassword()
  const faturamentoPwd = randomPassword()

  const defaults = [
    { username: 'admin',       password: adminPwd,       name: 'Administrador', role: 'admin'       },
    { username: 'secretaria',  password: secretariaPwd,  name: 'Secretaria',    role: 'secretaria'  },
    { username: 'faturamento', password: faturamentoPwd, name: 'Faturamento',   role: 'faturamento' }
  ]

  for (const u of defaults) {
    insertUser({ username: u.username, password_hash: hashPassword(u.password), name: u.name, role: u.role })
  }

  logger.warn(
    '\n╔══════════════════════════════════════════════════════════════════╗\n' +
    '║  ATENÇÃO: Usuários criados com senhas aleatórias. ANOTE AGORA!  ║\n' +
    `║  admin       : ${adminPwd.padEnd(16)}                           ║\n` +
    `║  secretaria  : ${secretariaPwd.padEnd(16)}                           ║\n` +
    `║  faturamento : ${faturamentoPwd.padEnd(16)}                           ║\n` +
    '║  Estas senhas NÃO serão exibidas novamente.                     ║\n' +
    '╚══════════════════════════════════════════════════════════════════╝'
  )
}
