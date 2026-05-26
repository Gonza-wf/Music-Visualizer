import { createSettingsManager } from './settings.js';
import { loadSettings, saveSettings, loadPlaylistTracks, savePlaylistTracks, clearPlaylistStorage } from './storage.js';
import { createAudioEngine } from './audio.js';
import { createVisualizer } from './visualizer.js';
import { initUI } from './ui.js';

async function bootstrap() {
  const savedSettings = loadSettings();
  const settingsManager = createSettingsManager(savedSettings);

  const container = document.getElementById('canvas-container');
  const visualizer = createVisualizer(container, settingsManager);
  const audio = createAudioEngine(settingsManager);

  initUI({
    audio,
    visualizer,
    settingsManager,
    onSettingsChange: (data) => saveSettings(data),
    onPlaylistChange: async (tracks) => {
      if (tracks.length === 0) {
        await clearPlaylistStorage();
      } else {
        const trackObjects = tracks.map((file) => ({ file }));
        await savePlaylistTracks(trackObjects);
      }
      saveSettings(settingsManager.toJSON());
    }
  });

  visualizer.start(audio);

  try {
    const savedTracks = await loadPlaylistTracks();
    if (savedTracks.length > 0) {
      const startIndex = savedSettings.currentTrackIndex ?? 0;
      audio.setTracksFromFiles(savedTracks, startIndex);
    }
  } catch (err) {
    console.warn('No se pudo restaurar la playlist:', err);
  }
}

bootstrap();
