import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'

// Importações após env vars serem definidas pelo vitest.config.js (pool: forks)
const { default: authRouter } = await import('../panel/routes/auth.js')
const { default: apiRouter } = await import('../panel/routes/index.js')
const { insertUser, getUserByUsername } = await import('../services/db.js')
const { hashPassword, generateToken } = await import('../services/auth.js')

function buildApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use('/api', apiRouter)
  return app
}

let app
let adminToken
let secretariaToken

beforeAll(() => {
  app = buildApp()

  insertUser({ username: 'test_admin', password_hash: hashPassword('Admin@12345'), name: 'Admin Teste', role: 'admin' })
  insertUser({ username: 'test_sec', password_hash: hashPassword('Sec@123456'), name: 'Sec Teste', role: 'secretaria' })
  insertUser({ username: 'test_fat', password_hash: hashPassword('Fat@123456'), name: 'Fat Teste', role: 'faturamento' })

  const admin = getUserByUsername('test_admin')
  const sec = getUserByUsername('test_sec')
  adminToken = generateToken(admin)
  secretariaToken = generateToken(sec)
})

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('retorna token com credenciais válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_admin', password: 'Admin@12345' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.role).toBe('admin')
  })

  it('rejeita senha errada com 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_admin', password: 'senha-errada' })
    expect(res.status).toBe(401)
    expect(res.body.token).toBeUndefined()
  })

  it('rejeita usuário inexistente com 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nao-existe', password: 'qualquer' })
    expect(res.status).toBe(401)
  })

  it('rejeita requisição sem campos obrigatórios com 400', async () => {
    const res = await request(app).post('/api/auth/login').send({})
    expect(res.status).toBe(400)
  })
})

// ─── Proteção de rotas ────────────────────────────────────────────────────────

describe('Rotas protegidas — sem token', () => {
  it('GET /api/agendamentos exige autenticação', async () => {
    const res = await request(app).get('/api/agendamentos')
    expect(res.status).toBe(401)
  })

  it('GET /api/auth/users exige autenticação', async () => {
    const res = await request(app).get('/api/auth/users')
    expect(res.status).toBe(401)
  })
})

// ─── Controle de acesso por role ──────────────────────────────────────────────

describe('Controle de acesso', () => {
  it('secretaria não acessa rota admin-only /api/auth/users', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${secretariaToken}`)
    expect(res.status).toBe(403)
  })

  it('admin acessa /api/auth/users com 200', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('admin acessa /api/agendamentos', async () => {
    const res = await request(app)
      .get('/api/agendamentos')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
  })

  it('secretaria acessa /api/agendamentos', async () => {
    const res = await request(app)
      .get('/api/agendamentos')
      .set('Authorization', `Bearer ${secretariaToken}`)
    expect(res.status).toBe(200)
  })
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('retorna dados do usuário autenticado', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('admin')
    expect(res.body.permissions).toBeDefined()
  })
})

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('GET /api/stats', () => {
  it('retorna estatísticas com token válido', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.hoje).toBe('number')
    expect(typeof res.body.pendentes).toBe('number')
  })
})

// ─── Criar usuário (admin) ────────────────────────────────────────────────────

describe('POST /api/auth/users', () => {
  it('admin cria usuário com sucesso', async () => {
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'novo_user', password: 'Novo@12345', name: 'Novo', role: 'secretaria' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rejeita role inválida', async () => {
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'x', password: 'Senha@123', name: 'X', role: 'superadmin' })
    expect(res.status).toBe(400)
  })

  it('rejeita senha muito curta', async () => {
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'y', password: '123', name: 'Y', role: 'secretaria' })
    expect(res.status).toBe(400)
  })

  it('secretaria não pode criar usuários', async () => {
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({ username: 'z', password: 'Senha@1234', name: 'Z', role: 'secretaria' })
    expect(res.status).toBe(403)
  })
})
