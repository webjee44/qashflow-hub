/**
 * Secure logging utility that only logs errors in development mode.
 * In production, errors are silently ignored to avoid exposing
 * sensitive system information in the browser console.
 */

const isDev = import.meta.env.DEV;

/**
 * Log an error message only in development mode.
 * In production, this is a no-op to prevent information leakage.
 */
export function logError(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.error(message, ...args);
  }
}

/**
 * Log a warning message only in development mode.
 */
export function logWarn(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.warn(message, ...args);
  }
}

/**
 * Log an info message only in development mode.
 */
export function logInfo(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.info(message, ...args);
  }
}

/**
 * Log a debug message only in development mode.
 */
export function logDebug(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.log(message, ...args);
  }
}
