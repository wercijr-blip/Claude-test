import { userCount, insertUser } from './db.js'
import { hashPassword } from './auth.js'
import { logger } from '../utils/logger.js'

export function seedDefaultUsers() {
  if (userCount() > 0) return

  const defaults = [
    { username: 'admin',      password: 'Admin@123',  name: 'Administrador',   role: 'admin'       },
    { username: 'secretaria', password: 'Secr@123',   name: 'Secretaria',      role: 'secretaria'  },
    { username: 'faturamento',password: 'Fat@123',    name: 'Faturamento',     role: 'faturamento' }
  ]

  for (const u of defaults) {
    insertUser({ username: u.username, password_hash: hashPassword(u.password), name: u.name, role: u.role })
  }

  logger.warn(
    '\n╔══════════════════════════════════════════════════════╗\n' +
    '║  ATENÇÃO: Usuários padrão criados. TROQUE AS SENHAS! ║\n' +
    '║  admin / Admin@123                                   ║\n' +
    '║  secretaria / Secr@123                               ║\n' +
    '║  faturamento / Fat@123                               ║\n' +
    '╚══════════════════════════════════════════════════════╝'
  )
}
