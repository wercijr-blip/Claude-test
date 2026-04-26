import helmet from 'helmet'
import cors from 'cors'
import type { Express, Request, Response, NextFunction } from 'express'
import { env } from './env.ts'
import { apiLimiter } from './rateLimiters.ts'

function buildAllowedOrigins(): string[] {
  const origins = new Set<string>()

  // Always include APP_URL
  origins.add(env.APP_URL)

  // Include any extra origins from the ALLOWED_ORIGINS env var (comma-separated)
  if (env.ALLOWED_ORIGINS) {
    for (const o of env.ALLOWED_ORIGINS.split(',')) {
      const trimmed = o.trim()
      if (trimmed) origins.add(trimmed)
    }
  }

  return Array.from(origins)
}

const allowedOrigins = buildAllowedOrigins()

function isOriginAllowed(origin: string): boolean {
  // Always allow localhost for development
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true

  return allowedOrigins.some((o) => origin === o || origin.startsWith(o))
}

export function applySecurityMiddleware(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  )

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server requests (no origin header)
        if (!origin) {
          callback(null, true)
          return
        }
        if (isOriginAllowed(origin)) {
          callback(null, true)
        } else {
          callback(new Error('CORS: origin não permitida'))
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
    }),
  )

  app.use(apiLimiter)

  // Bloquear payloads gigantes (proteção contra payload bomb)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] ?? '0')
    if (contentLength > 20 * 1024 * 1024) {
      res.status(413).json({ error: 'Payload muito grande' })
      return
    }
    next()
  })
}
