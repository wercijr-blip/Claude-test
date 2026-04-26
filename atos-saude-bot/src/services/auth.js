import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'atos-saude-secret-TROQUE-EM-PRODUCAO'
const JWT_EXPIRES = '12h'

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10)
}

export function checkPassword(password, hash) {
  return bcrypt.compareSync(password, hash)
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// Middleware Express: exige autenticação, roles opcionais
export function requireAuth(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado.' })
    }
    const user = verifyToken(header.slice(7))
    if (!user) return res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' })
    if (roles.length > 0 && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' })
    }
    req.user = user
    next()
  }
}

// Permissões por papel
export const ROLES = {
  admin:      { label: 'Administrador',  color: 'red'    },
  secretaria: { label: 'Secretaria',     color: 'blue'   },
  faturamento:{ label: 'Faturamento',    color: 'green'  }
}

export const PERMISSIONS = {
  admin: {
    tabs: ['agenda','medicacoes','conhecimento','satisfacao','marcacao','medicos','textos','usuarios'],
    canCancel: true, canBlock: true, canExport: true,
    canUploadKnowledge: true, canEditTextos: true, canManageUsers: true, canManageDoctors: true
  },
  secretaria: {
    tabs: ['agenda','medicacoes','satisfacao','marcacao'],
    canCancel: true, canBlock: true, canExport: false,
    canUploadKnowledge: false, canEditTextos: false, canManageUsers: false, canManageDoctors: false
  },
  faturamento: {
    tabs: ['agenda','medicacoes','satisfacao'],
    canCancel: false, canBlock: false, canExport: true,
    canUploadKnowledge: false, canEditTextos: false, canManageUsers: false, canManageDoctors: false
  }
}
