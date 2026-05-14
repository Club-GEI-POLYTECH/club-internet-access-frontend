/**
 * Journalisation : tout est désactivé en production (`NODE_ENV === 'production'`).
 * En développement, les niveaux info / log / warn / error passent sur la console ; debug uniquement en dev.
 */

const PREFIX = '[ClubIA]'
const isProd = process.env.NODE_ENV === 'production'

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (isProd) return
    console.info(`${PREFIX} [INFO]`, message, ...args)
  },
  log: (message: string, ...args: unknown[]) => {
    if (isProd) return
    console.log(`${PREFIX}`, message, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    if (isProd) return
    console.warn(`${PREFIX} [WARN]`, message, ...args)
  },
  error: (message: string, ...args: unknown[]) => {
    if (isProd) return
    console.error(`${PREFIX} [ERROR]`, message, ...args)
  },
  debug: (message: string, ...args: unknown[]) => {
    if (isProd) return
    console.debug(`${PREFIX} [DEBUG]`, message, ...args)
  },
}
