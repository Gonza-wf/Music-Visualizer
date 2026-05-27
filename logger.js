/**
 * Logger - Sistema centralizado de logging
 * Proporciona métodos para error, warn e info con contexto y timestamps
 */

export class Logger {
  constructor(debugMode = false) {
    // Funciona tanto en navegador como en Node.js
    const isNode = typeof window === 'undefined';
    if (isNode) {
      this.debugMode = debugMode || process.env.DEBUG_MODE === 'true';
    } else {
      this.debugMode = debugMode || localStorage.getItem('DEBUG_MODE') === 'true';
    }
  }

  /**
   * Log de error con contexto
   * @param {string} context - Contexto donde ocurrió el error (ej: 'loadSettings')
   * @param {Error|string} err - Error o mensaje de error
   * @param {object} data - Datos adicionales opcionales
   */
  error(context, err, data = {}) {
    const message = err instanceof Error ? err.message : err;
    const stack = err instanceof Error ? err.stack : '';
    
    console.error(
      `%c❌ [${context}] ${message}`,
      'color: #ff0055; font-weight: bold;',
      { timestamp: new Date().toISOString(), stack, ...data }
    );
    
    // Enviar a servidor si está en producción (opcional)
    if (!this.debugMode && typeof window !== 'undefined') {
      this._reportError(context, message, data);
    }
  }

  /**
   * Log de advertencia
   * @param {string} context - Contexto
   * @param {string} msg - Mensaje de advertencia
   * @param {object} data - Datos adicionales opcionales
   */
  warn(context, msg, data = {}) {
    console.warn(
      `%c⚠️ [${context}] ${msg}`,
      'color: #ffaa00; font-weight: bold;',
      { timestamp: new Date().toISOString(), ...data }
    );
  }

  /**
   * Log de información
   * @param {string} context - Contexto
   * @param {string} msg - Mensaje
   * @param {object} data - Datos adicionales opcionales
   */
  info(context, msg, data = {}) {
    if (this.debugMode) {
      console.log(
        `%cℹ️ [${context}] ${msg}`,
        'color: #0099ff; font-weight: normal;',
        { timestamp: new Date().toISOString(), ...data }
      );
    }
  }

  /**
   * Log de debug (solo en modo debug)
   * @param {string} context - Contexto
   * @param {string} msg - Mensaje
   * @param {object} data - Datos adicionales
   */
  debug(context, msg, data = {}) {
    if (this.debugMode) {
      console.debug(
        `%🔧 [${context}] ${msg}`,
        'color: #888888; font-style: italic;',
        { timestamp: new Date().toISOString(), ...data }
      );
    }
  }

  /**
   * Habilitar/Deshabilitar modo debug
   * @param {boolean} enable
   */
  setDebugMode(enable) {
    this.debugMode = enable;
    if (typeof window !== 'undefined') {
      localStorage.setItem('DEBUG_MODE', enable.toString());
    } else if (typeof process !== 'undefined') {
      process.env.DEBUG_MODE = enable.toString();
    }
    this.info('Logger', `Debug mode: ${enable}`);
  }

  /**
   * Enviar error a servidor para monitoreo (placeholder)
   * @private
   */
  _reportError(context, message, data) {
    // Implementar según necesidad (Sentry, LogRocket, etc.)
    // fetch('/api/logs', { method: 'POST', body: JSON.stringify({ context, message, data }) });
  }
}

// Instancia global
export const logger = new Logger();

// Exposer en window para debug console
if (typeof window !== 'undefined') {
  window.logger = logger;
  window.enableDebug = () => logger.setDebugMode(true);
  window.disableDebug = () => logger.setDebugMode(false);
}
