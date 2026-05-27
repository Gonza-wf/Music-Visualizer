/**
 * DOM Helpers - Utilities para manejo consistente del DOM
 */

import { logger } from './logger.js';

/**
 * Query múltiples elementos del DOM de una sola vez
 * @param {object} selectors - Objeto con keys y selectors CSS
 * @returns {object} Objeto con los elementos encontrados
 * 
 * @example
 * const el = queryElements({
 *   btnPlay: '#btn-play',
 *   btnNext: '#btn-next',
 *   playlist: '#playlist'
 * });
 */
export function queryElements(selectors) {
  const result = {};
  
  Object.entries(selectors).forEach(([key, selector]) => {
    try {
      const element = document.querySelector(selector);
      result[key] = element;
      
      if (!element) {
        logger.warn('queryElements', `Elemento no encontrado: ${selector}`);
      }
    } catch (err) {
      logger.error('queryElements', err, { selector, key });
    }
  });
  
  return result;
}

/**
 * Query todos los elementos que matcheen un selector
 * @param {string} selector - Selector CSS
 * @returns {array} Array de elementos
 */
export function queryAll(selector) {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch (err) {
    logger.error('queryAll', err, { selector });
    return [];
  }
}

/**
 * Delegador de eventos mejorado con cleanup
 */
export class EventDelegator {
  constructor() {
    this.listeners = [];
  }

  /**
   * Agregar listener y registrarlo para cleanup
   */
  on(element, event, handler) {
    if (!element) {
      logger.warn('EventDelegator', `Elemento null al agregar listener: ${event}`);
      return () => {};
    }
    
    element.addEventListener(event, handler);
    
    // Guardar para cleanup
    const unsubscribe = () => {
      element.removeEventListener(event, handler);
      this.listeners = this.listeners.filter(l => l !== unsubscribe);
    };
    
    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Limpiar todos los listeners registrados
   */
  cleanup() {
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
    logger.info('EventDelegator', 'All event listeners cleaned up');
  }
}

/**
 * Mezclar array de forma aleatoria (Fisher-Yates)
 */
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Debounce function
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Throttle function
 */
export function throttle(fn, ms) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}
