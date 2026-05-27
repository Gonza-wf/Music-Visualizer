/**
 * Validación de archivos de audio
 */

import { logger } from './logger.js';

// MIME types válidos para audio
const VALID_AUDIO_TYPES = new Set([
  'audio/mpeg',        // MP3
  'audio/mp3',         // MP3 alternate
  'audio/wav',         // WAV
  'audio/wave',        // WAV alternate
  'audio/ogg',         // OGG/Vorbis
  'audio/webm',        // WebM
  'audio/aac',         // AAC
  'audio/mp4',         // M4A
  'audio/x-m4a'        // M4A alternate
]);

// Límite de tamaño: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Extensiones válidas
const VALID_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.webm', '.aac', '.m4a', '.flac'
]);

/**
 * Validar si un archivo es de audio válido
 * @param {File} file - Archivo a validar
 * @returns {object} { valid: boolean, error?: string }
 */
export function validateAudioFile(file) {
  if (!file) {
    return { valid: false, error: 'Archivo no válido' };
  }

  if (!(file instanceof File)) {
    return { valid: false, error: 'No es un objeto File' };
  }

  // Validar tamaño
  if (file.size === 0) {
    return { valid: false, error: 'Archivo vacío' };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    return { valid: false, error: `Archivo muy grande: ${sizeMB}MB (máximo 500MB)` };
  }

  // Validar tipo MIME
  if (!VALID_AUDIO_TYPES.has(file.type)) {
    logger.warn('validateAudioFile', `MIME type no reconocido: ${file.type} para ${file.name}`);
    // No fallar si el MIME es desconocido, pero avisar
    // Algunos navegadores no detectan MIME correctamente
  }

  // Validar extensión
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!VALID_EXTENSIONS.has(ext)) {
    logger.warn('validateAudioFile', `Extensión no estándar: ${ext} para ${file.name}`);
  }

  return { valid: true };
}

/**
 * Validar múltiples archivos
 * @param {FileList|array} files - Lista de archivos
 * @returns {object} { validFiles: array, errors: array }
 */
export function validateAudioFiles(files) {
  const validFiles = [];
  const errors = [];

  Array.from(files).forEach((file, index) => {
    const validation = validateAudioFile(file);
    
    if (validation.valid) {
      validFiles.push(file);
    } else {
      errors.push({
        file: file.name,
        error: validation.error,
        index
      });
      logger.warn('validateAudioFiles', `Archivo rechazado: ${file.name} - ${validation.error}`);
    }
  });

  return { validFiles, errors };
}

/**
 * Obtener información legible del archivo
 * @param {File} file - Archivo
 * @returns {string} Información formateada
 */
export function getFileInfo(file) {
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  const type = file.type || 'desconocido';
  const date = new Date(file.lastModified).toLocaleDateString();
  
  return `${file.name} (${sizeMB}MB, ${type}, ${date})`;
}
