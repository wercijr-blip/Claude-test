import helmet from 'helmet'
import cors from 'cors'
import type { Express, Request, Response, NextFunction } from 'express'
import { env } from './env.ts'
import { apiLimiter } from './rateLimiters.ts'
import { MAX_REQUEST_SIZE_BYTES } from '../../shared/security-constants.ts'

export function buildAllowedOrigins(): string[] {
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

export const allowedOrigins = buildAllowedOrigins()

export function isOriginAllowed(origin: string): boolean {
  // Allow localhost ONLY in development
  if (env.NODE_ENV === 'development' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return true

  // Exact equality — prevents subdomain takeover via startsWith
  return allowedOrigins.some((o) => origin === o)
}

export function applySecurityMiddleware(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // Development: Vite HMR requires unsafe-inline
            ...(env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : []),
            // Stripe checkout
            'https://js.stripe.com',
            'https://checkout.stripe.com',
            // Google Analytics and Tag Manager
            'https://www.googletagmanager.com',
            'https://www.google-analytics.com',
          ],
          // React inline style={{}} attributes require 'unsafe-inline' for style-src
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            // Google Fonts
            'https://fonts.googleapis.com',
          ],
          fontSrc: [
            "'self'",
            'https://fonts.gstatic.com',
            'data:',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https:',
          ],
          connectSrc: [
            "'self'",
            // Stripe API
            'https://api.stripe.com',
            'https://*.stripe.com',
            // Google Analytics
            'https://www.google-analytics.com',
            // ViaCEP (address autocomplete)
            'https://viacep.com.br',
          ],
          // Stripe 3D Secure usa iframes hospedados em hooks.stripe.com e js.stripe.com
          frameSrc: [
            "'self'",
            'https://js.stripe.com',
            'https://hooks.stripe.com',
            'https://checkout.stripe.com',
          ],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 15552000, // 180 days
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
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

  // Permissions-Policy — desabilita APIs sensíveis não utilizadas
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      [
        'camera=()',           // sem vídeo por enquanto
        'microphone=()',
        'geolocation=()',
        'payment=(self)',      // Stripe inline checkout
        'usb=()',
        'fullscreen=(self)',
        'autoplay=()',
        'accelerometer=()',
        'gyroscope=()',
        'magnetometer=()',
        'midi=()',
        'sync-xhr=()',
      ].join(', '),
    )
    next()
  })

  // Bloquear payloads gigantes (proteção contra payload bomb)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] ?? '0')
    if (contentLength > MAX_REQUEST_SIZE_BYTES) {
      res.status(413).json({ error: 'Payload muito grande' })
      return
    }
    next()
  })
}
