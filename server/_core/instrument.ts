import * as Sentry from '@sentry/node'

// Must be the first import in the server entry point — patches HTTP/Express before they load.
// When SENTRY_DSN_SERVER is undefined, Sentry.init() is a no-op (disabled silently).
Sentry.init({
  dsn: process.env['SENTRY_DSN_SERVER'],
  environment: process.env['SENTRY_ENVIRONMENT'] ?? 'production',
  tracesSampleRate: process.env['NODE_ENV'] === 'development' ? 0 : 0.05,
  sendDefaultPii: false,
  beforeSend(event, hint) {
    const original = hint?.originalException
    if (original instanceof Error) {
      const userErrorCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST', 'CONFLICT', 'TOO_MANY_REQUESTS']
      if (userErrorCodes.includes((original as Error & { code?: string }).code ?? '')) return null
    }
    return event
  },
})

export { Sentry }
