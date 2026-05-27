import { getDefaultPreset } from './settings.js';
import { queryElements, EventDelegator, debounce } from './dom-helpers.js';
import { logger } from './logger.js';

export const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
export const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function initUI({ audio, visualizer, settingsManager, onSettingsChange, onPlaylistChange }) {
  const eventDelegator = new EventDelegator();
  
  // Query todos los elementos del DOM de una sola vez
  const el = queryElements({
    uiContainer: '#ui-container',
    btnPlay: '#btn-play',
    btnNext: '#btn-next',
    btnPrev: '#btn-prev',
    trackName: '#track-name',
    uploadInput: '#audio-upload',
    playlist: '#playlist',
    progressBar: '#progress-bar',
    currentTime: '#current-time',
    totalTime: '#total-time',
    btnFullscreen: '#btn-fullscreen',
    mobilePlaylistBtn: '#mobile-playlist-btn',
    mobileSettingsBtn: '#mobile-settings-btn',
    closePlaylistBtn: '#close-playlist-btn',
    closeSettingsBtn: '#close-settings-btn',
    sidebar: '#sidebar',
    settingsSidebar: '#settings-sidebar',
    toggleStrobe: '#toggle-strobe',
    toggleBwMode: '#toggle-bw-mode',
    bwModeGroup: '#bw-mode-group',
    sliderFlash: '#slider-flash',
    sliderBass: '#slider-bass',
    sliderGlow: '#slider-glow',
    sliderCam: '#slider-cam',
    valFlash: '#val-flash',
    valBass: '#val-bass',
    valGlow: '#val-glow',
    valCam: '#val-cam',
    trackCount: '#track-count',
    btnShuffle: '#btn-shuffle',
    btnClearPlaylist: '#btn-clear-playlist',
    btnResetSettings: '#btn-reset-settings',
    presetLow: '#preset-low',
    presetMid: '#preset-mid',
    presetHigh: '#preset-high',
    presetUltra: '#preset-ultra',
    sidebarTrigger: '#sidebar-trigger',
    settingsTrigger: '#settings-trigger'
  });

  // Usar aliases más cortos
  const {
    uiContainer, btnPlay, btnNext, btnPrev, trackName: trackNameEl, uploadInput,
    playlist: playlistEl, progressBar, currentTime: currentTimeEl, totalTime: totalTimeEl,
    btnFullscreen, mobilePlaylistBtn, mobileSettingsBtn, closePlaylistBtn, closeSettingsBtn,
    sidebar, settingsSidebar, toggleStrobe, toggleBwMode, bwModeGroup,
    sliderFlash, sliderBass, sliderGlow, sliderCam,
    valFlash, valBass, valGlow, valCam, trackCount: trackCountEl,
    btnShuffle, btnClearPlaylist, btnResetSettings
  } = el;

  const presetBtns = {
    low: el.presetLow,
    mid: el.presetMid,
    high: el.presetHigh,
    ultra: el.presetUltra
  };

  let isSeeking = false;
  let dragFromIndex = null;
  let idleTimeout;

  const persistSettings = debounce(() => {
    onSettingsChange?.(settingsManager.toJSON());
  }, 300);

  const persistPlaylist = debounce(() => {
    onPlaylistChange?.(audio.getTracks());
  }, 500);

  function syncStrobeSubOptions() {
    const strobeOn = toggleStrobe?.checked;
    if (strobeOn) {
      bwModeGroup?.querySelector?.('.setting-label')?.classList?.remove?.('disabled');
    } else {
      bwModeGroup?.querySelector?.('.setting-label')?.classList?.add?.('disabled');
    }
  }

  function syncSettingsToDOM() {
    const s = settingsManager.get();
    if (toggleStrobe) toggleStrobe.checked = s.isStrobeEnabled;
    if (toggleBwMode) toggleBwMode.checked = s.isBlackAndWhite;
    syncStrobeSubOptions();
    if (sliderFlash) sliderFlash.value = s.flashDecay;
    if (sliderBass) sliderBass.value = s.bassSensMult;
    if (sliderGlow) sliderGlow.value = s.glowStrength;
    if (sliderCam) sliderCam.value = s.cameraSpeedMult;
    if (valFlash) valFlash.textContent = s.flashDecay.toFixed(2);
    if (valBass) valBass.textContent = s.bassSensMult.toFixed(1);
    if (valGlow) valGlow.textContent = s.glowStrength.toFixed(2);
    if (valCam) valCam.textContent = s.cameraSpeedMult.toFixed(1);
    Object.entries(presetBtns).forEach(([key, btn]) => {
      btn?.classList?.toggle?.('active', key === s.preset);
    });
  }

  function applyPreset(name) {
    visualizer.applyPreset(name);
    Object.entries(presetBtns).forEach(([key, btn]) => {
      btn.classList.toggle('active', key === name);
    });
    persistSettings();
  }

  function resetIdleTimer() {
    uiContainer.classList.remove('hidden');
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      if (audio.getIsPlaying()) uiContainer.classList.add('hidden');
    }, 3000);
  }

  function renderPlaylist() {
    const tracks = audio.getTracks();
    const currentTrackIndex = audio.getCurrentIndex();

    playlistEl.innerHTML = '';
    if (tracks.length === 0) {
      playlistEl.innerHTML = '<li class="empty-state">Playlist empty</li>';
      trackCountEl.textContent = '0 tracks';
      return;
    }

    trackCountEl.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;

    tracks.forEach((file, index) => {
      const li = document.createElement('li');
      li.draggable = true;

      const numSpan = document.createElement('span');
      numSpan.className = 'track-number';
      numSpan.textContent = `${index + 1}`;
      li.appendChild(numSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'track-name-text';
      nameSpan.textContent = file.name.replace(/\.[^/.]+$/, '');
      li.appendChild(nameSpan);

      const delBtn = document.createElement('button');
      delBtn.className = 'track-delete-btn';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Eliminar';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.removeTrack(index);
        renderPlaylist();
        persistPlaylist();
      });
      li.appendChild(delBtn);

      li.addEventListener('click', () => {
        audio.initAudio();
        audio.loadTrack(index);
      });

      if (index === currentTrackIndex) li.classList.add('active');

      li.addEventListener('dragstart', (e) => {
        dragFromIndex = index;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        dragFromIndex = null;
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        if (dragFromIndex !== null && dragFromIndex !== index) {
          audio.reorderTrack(dragFromIndex, index);
          renderPlaylist();
          persistPlaylist();
        }
      });

      playlistEl.appendChild(li);
    });
  }

  function closePlaylist(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    sidebar.classList.remove('open');
    mobilePlaylistBtn.style.display = '';
  }

  function closeSettings(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    settingsSidebar.classList.remove('open');
    mobileSettingsBtn.style.display = '';
  }

  // --- Settings listeners ---
  toggleStrobe.addEventListener('change', () => {
    settingsManager.set('isStrobeEnabled', toggleStrobe.checked);
    syncStrobeSubOptions();
    persistSettings();
  });

  toggleBwMode.addEventListener('change', () => {
    settingsManager.set('isBlackAndWhite', toggleBwMode.checked);
    persistSettings();
  });

  sliderFlash.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settingsManager.set('flashDecay', val);
    valFlash.textContent = val.toFixed(2);
    persistSettings();
  });

  sliderBass.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settingsManager.set('bassSensMult', val);
    valBass.textContent = val.toFixed(1);
    persistSettings();
  });

  sliderGlow.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settingsManager.set('glowStrength', val);
    valGlow.textContent = val.toFixed(2);
    persistSettings();
  });

  sliderCam.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settingsManager.set('cameraSpeedMult', val);
    valCam.textContent = val.toFixed(1);
    persistSettings();
  });

  Object.entries(presetBtns).forEach(([key, btn]) => {
    btn.addEventListener('click', () => applyPreset(key));
  });

  btnResetSettings.addEventListener('click', () => {
    settingsManager.reset();
    syncSettingsToDOM();
    applyPreset(getDefaultPreset());
    persistSettings();
  });

  // --- Playback controls ---
  btnPlay.addEventListener('click', () => {
    const result = audio.togglePlay();
    if (result === 'empty') {
      uploadInput.click();
      return;
    }
    btnPlay.innerHTML = result ? PAUSE_ICON : PLAY_ICON;
    resetIdleTimer();
  });

  btnNext.addEventListener('click', () => {
    if (audio.getTracks().length > 0) audio.next();
  });

  btnPrev.addEventListener('click', () => {
    if (audio.getTracks().length > 0) audio.prev();
  });

  uploadInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const existingNames = audio.getTracks().map((t) => t.name);
    const duplicates = files.filter((f) => existingNames.includes(f.name));
    const newFiles = files.filter((f) => !existingNames.includes(f.name));

    if (duplicates.length > 0) {
      const dupeNames = duplicates.map((f) => f.name.replace(/\.[^/.]+$/, '')).join(', ');
      const addAnyway = confirm(`⚠️ Estas canciones ya están en la playlist:\n\n${dupeNames}\n\n¿Quieres duplicarlas?`);
      if (addAnyway) newFiles.push(...duplicates);
    }

    if (newFiles.length === 0) { uploadInput.value = ''; return; }

    const wasEmpty = audio.getTracks().length === 0;
    audio.addTracks(newFiles);
    renderPlaylist();
    persistPlaylist();

    if (wasEmpty) {
      audio.initAudio();
      audio.loadTrack(0);
    }

    uploadInput.value = '';
  });

  progressBar.addEventListener('input', () => {
    isSeeking = true;
    currentTimeEl.textContent = formatTime(progressBar.value);
  });

  progressBar.addEventListener('change', () => {
    audio.seek(progressBar.value);
    isSeeking = false;
  });

  btnShuffle.addEventListener('click', () => {
    audio.shufflePlaylist();
    renderPlaylist();
    persistPlaylist();
  });

  btnClearPlaylist.addEventListener('click', async () => {
    if (audio.getTracks().length === 0) return;
    if (!confirm('¿Limpiar toda la playlist?')) return;
    audio.clearPlaylist();
    renderPlaylist();
    persistPlaylist();
  });

  // --- Sidebar & idle ---
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  mobilePlaylistBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    mobilePlaylistBtn.style.display = 'none';
  });

  mobileSettingsBtn.addEventListener('click', () => {
    settingsSidebar.classList.add('open');
    mobileSettingsBtn.style.display = 'none';
  });

  closePlaylistBtn.addEventListener('click', closePlaylist);
  closePlaylistBtn.addEventListener('touchstart', closePlaylist, { passive: false });
  closeSettingsBtn.addEventListener('click', closeSettings);
  closeSettingsBtn.addEventListener('touchstart', closeSettings, { passive: false });

  document.getElementById('canvas-container').addEventListener('click', () => {
    sidebar.classList.remove('open');
    settingsSidebar.classList.remove('open');
    mobilePlaylistBtn.style.display = '';
    mobileSettingsBtn.style.display = '';
  });

  ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((evt) => {
    document.addEventListener(evt, resetIdleTimer);
  });

  // --- Audio callbacks ---
  audio.on('error', () => {
    alert('Error al cargar la canción.');
    audio.setIsPlaying(false);
    btnPlay.innerHTML = PLAY_ICON;
  });

  audio.on('trackchange', ({ name, isPlaying }) => {
    trackNameEl.textContent = name;
    btnPlay.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
    renderPlaylist();
    resetIdleTimer();
  });

  audio.on('loadedmetadata', (duration) => {
    totalTimeEl.textContent = formatTime(duration);
    progressBar.max = duration;
  });

  audio.on('timeupdate', (currentTime) => {
    if (!isSeeking) {
      progressBar.value = currentTime;
      currentTimeEl.textContent = formatTime(currentTime);
    }
  });

  audio.on('playlistchange', () => renderPlaylist());

  syncSettingsToDOM();
  resetIdleTimer();

  return { renderPlaylist, syncSettingsToDOM, applyPreset };
}
