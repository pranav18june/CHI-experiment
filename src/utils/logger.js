/**
 * Logger utility for controlled research environments.
 * Supports 'development', 'production', and 'silent' log modes.
 * Prevents log clutter in production while maintaining auditability in dev.
 */

const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || (import.meta.env.DEV ? 'development' : 'production')

export const logger = {
  debug(...args) {
    if (LOG_LEVEL === 'development') {
      console.debug('[RESEARCH DEBUG]', ...args)
    }
  },

  info(...args) {
    if (LOG_LEVEL !== 'silent') {
      console.info('[RESEARCH INFO]', ...args)
    }
  },

  warn(...args) {
    if (LOG_LEVEL !== 'silent') {
      console.warn('[RESEARCH WARN]', ...args)
    }
  },

  error(...args) {
    if (LOG_LEVEL !== 'silent') {
      console.error('[RESEARCH ERROR]', ...args)
    }
  },
}

export default logger
