/**
 * Logger utility for development and production
 * Disables console logs in production builds
 */

const isDev = __DEV__;

class Logger {
  log(...args: any[]) {
    if (isDev) {
      console.log(...args);
    }
  }

  warn(...args: any[]) {
    if (isDev) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    // Always log errors even in production for debugging
    console.error(...args);
  }

  info(...args: any[]) {
    if (isDev) {
      console.info(...args);
    }
  }

  debug(...args: any[]) {
    if (isDev) {
      console.debug(...args);
    }
  }
}

export const logger = new Logger();