import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { getUserByUsername, insertUser, getAllUsers, toggleUserActive, updateUserPassword } from '../../services/db.js'
import { checkPassword, hashPassword, generateToken, requireAuth, PERMISSIONS } from '../../services/auth.js'
import { logger } from '../../utils/logger.js'

const authRouter = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
})

// POST /auth/login
authRouter.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios.' })

  const user = getUserByUsername(username)
  if (!user || !checkPassword(password, user.password_hash)) {
    logger.warn({ username, ip: req.ip }, 'Falha de login — credenciais inválidas')
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' })
  }

  logger.info({ username, role: user.role, ip: req.ip }, 'Login bem-sucedido')
  const token = generateToken(user)
  const perms = PERMISSIONS[user.role] || {}

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, first_login: !!user.first_login },
    permissions: perms
  })
})

// POST /auth/change-password  (usuário troca própria senha)
authRouter.post('/change-password', requireAuth(), (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Preencha senha atual e nova senha.' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres.' })

  const user = getUserByUsername(req.user.username)
  if (!user || !checkPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' })
  }

  updateUserPassword(user.id, hashPassword(newPassword))
  res.json({ ok: true })
})

// GET /auth/users  (admin only)
authRouter.get('/users', requireAuth(['admin']), (req, res) => {
  res.json(getAllUsers())
})

// POST /auth/users  (admin only — criar usuário)
authRouter.post('/users', requireAuth(['admin']), (req, res) => {
  const { username, password, name, role } = req.body
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: 'username, password, name e role são obrigatórios.' })
  }
  if (!['admin','secretaria','faturamento'].includes(role)) {
    return res.status(400).json({ error: 'Role inválida.' })
  }
  if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' })

  try {
    const id = insertUser({ username, password_hash: hashPassword(password), name, role })
    res.json({ ok: true, id })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Usuário já existe.' })
    res.status(500).json({ error: err.message })
  }
})

// PATCH /auth/users/:id/toggle  (admin only — ativar/desativar)
authRouter.patch('/users/:id/toggle', requireAuth(['admin']), (req, res) => {
  const { active } = req.body
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Não é possível desativar a si mesmo.' })
  }
  toggleUserActive(Number(req.params.id), active)
  res.json({ ok: true })
})

// POST /auth/users/:id/reset-password  (admin only)
authRouter.post('/users/:id/reset-password', requireAuth(['admin']), (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' })
  }
  updateUserPassword(Number(req.params.id), hashPassword(newPassword))
  res.json({ ok: true })
})

// GET /auth/me  (verifica token e retorna dados do usuário)
authRouter.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.user, permissions: PERMISSIONS[req.user.role] || {} })
})

export default authRouter
