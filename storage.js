import { logger } from './logger.js';

const SETTINGS_KEY = 'techno-vis-settings';
const DB_NAME = 'techno-vis';
const DB_VERSION = 1;
const PLAYLIST_STORE = 'tracks';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PLAYLIST_STORE)) {
        db.createObjectStore(PLAYLIST_STORE, { keyPath: 'id', autoIncrement: true });
        logger.info('storage', 'ObjectStore creado: tracks');
      }
    };
    request.onsuccess = () => {
      logger.info('storage', 'IndexedDB abierta correctamente');
      resolve(request.result);
    };
    request.onerror = () => {
      logger.error('storage', request.error, { action: 'openDB' });
      reject(request.error);
    };
  });
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const settings = raw ? JSON.parse(raw) : {};
    logger.info('storage', 'Configuración cargada correctamente', { keys: Object.keys(settings) });
    return settings;
  } catch (err) {
    logger.error('storage', err, { action: 'loadSettings' });
    return {};
  }
}

export function saveSettings(data) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    logger.info('storage', 'Configuración guardada', { keys: Object.keys(data) });
  } catch (err) {
    logger.error('storage', err, { action: 'saveSettings', dataSize: JSON.stringify(data).length });
  }
}

export async function savePlaylistTracks(tracks) {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE, 'readwrite');
    const store = tx.objectStore(PLAYLIST_STORE);
    store.clear();

    tracks.forEach((track, order) => {
      store.add({
        name: track.file.name,
        type: track.file.type,
        lastModified: track.file.lastModified,
        order,
        blob: track.file
      });
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        logger.info('storage', 'Playlist guardada en IndexedDB', { trackCount: tracks.length });
        resolve();
      };
      tx.onerror = () => {
        logger.error('storage', tx.error, { action: 'savePlaylistTracks', trackCount: tracks.length });
        reject(tx.error);
      };
    });
  } catch (err) {
    logger.error('storage', err, { action: 'savePlaylistTracks' });
    throw err;
  }
}

export async function loadPlaylistTracks() {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE, 'readonly');
    const store = tx.objectStore(PLAYLIST_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = request.result.sort((a, b) => a.order - b.order);
        const files = rows.map((row) => new File([row.blob], row.name, {
          type: row.type,
          lastModified: row.lastModified
        }));
        logger.info('storage', 'Playlist cargada desde IndexedDB', { trackCount: files.length });
        resolve(files);
      };
      request.onerror = () => {
        logger.error('storage', request.error, { action: 'loadPlaylistTracks' });
        reject(request.error);
      };
    });
  } catch (err) {
    logger.error('storage', err, { action: 'loadPlaylistTracks' });
    throw err;
  }
}

export async function clearPlaylistStorage() {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE, 'readwrite');
    tx.objectStore(PLAYLIST_STORE).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        logger.info('storage', 'Playlist limpiada correctamente');
        resolve();
      };
      tx.onerror = () => {
        logger.error('storage', tx.error, { action: 'clearPlaylistStorage' });
        reject(tx.error);
      };
    });
  } catch (err) {
    logger.error('storage', err, { action: 'clearPlaylistStorage' });
    throw err;
  }
}
