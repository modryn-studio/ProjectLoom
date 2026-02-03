/**
 * Logger Utility
 * 
 * Centralized logging with environment-aware behavior.
 * In development: logs to console
 * In production: suppresses warnings, can integrate with telemetry
 * 
 * @version 1.0.0
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * Application logger with environment-aware behavior
 */
export const logger: Logger = {
  /**
   * Debug messages - only in development
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug('[ProjectLoom]', ...args);
    }
  },

  /**
   * Info messages - only in development
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info('[ProjectLoom]', ...args);
    }
  },

  /**
   * Warnings - only in development
   */
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn('[ProjectLoom]', ...args);
    }
    // In production, could send to telemetry service
  },

  /**
   * Errors - always logged
   */
  error: (...args: unknown[]) => {
    console.error('[ProjectLoom]', ...args);
    // In production, could send to error tracking service (Sentry, etc.)
  },
};

export default logger;
