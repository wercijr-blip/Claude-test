// Set timezone before any date operation — Railway containers run in UTC by default
process.env.TZ ??= 'America/Sao_Paulo'

import * as Sentry from '@sentry/node'

// Must be the first import in the server entry point — patches HTTP/Express before they load.
// DSN is semi-public by design (Sentry's write-only ingest key).
const DSN = process.env['SENTRY_DSN_SERVER']
  ?? 'https://28f3a8121c4739f8c9b9fd5390f784aa@o4511343385444352.ingest.us.sentry.io/4511343513108481'

Sentry.init({
  dsn: DSN,
  environment: process.env['SENTRY_ENVIRONMENT'] ?? 'production',
  // No traces locally; 5% sample in production keeps quota low
  tracesSampleRate: process.env['NODE_ENV'] === 'development' ? 0 : 0.05,
  // Healthcare platform — never attach request bodies or PII to events
  sendDefaultPii: false,
  beforeSend(event, hint) {
    // Drop tRPC user-input errors (4xx) — these are not bugs
    const original = hint?.originalException
    if (original instanceof Error) {
      const userErrorCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST', 'CONFLICT', 'TOO_MANY_REQUESTS']
      if (userErrorCodes.includes((original as Error & { code?: string }).code ?? '')) return null
    }
    return event
  },
})

export { Sentry }
