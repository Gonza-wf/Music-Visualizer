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
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSettings(data) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('No se pudieron guardar los ajustes:', err);
  }
}

export async function savePlaylistTracks(tracks) {
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
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPlaylistTracks() {
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
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearPlaylistStorage() {
  const db = await openDB();
  const tx = db.transaction(PLAYLIST_STORE, 'readwrite');
  tx.objectStore(PLAYLIST_STORE).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
