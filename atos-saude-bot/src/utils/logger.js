import pino from 'pino'

const isDev = (process.env.NODE_ENV || 'development') === 'development'

export const logger = pino(
  isDev
    ? { level: 'debug', transport: { target: 'pino-pretty', options: { colorize: true } } }
    : { level: 'info' }
)

export default logger
