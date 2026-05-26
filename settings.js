export const isMobile =
  /Android|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent) ||
  window.innerWidth < 768;

export const PRESETS = {
  low:   { pixelRatio: 1.0, geoDetail: 16, particles: 500,  bloom: false, wireframe: false, rgbShift: false },
  mid:   { pixelRatio: Math.min(window.devicePixelRatio, 1.5), geoDetail: 32, particles: 1200, bloom: true, wireframe: true, rgbShift: true },
  high:  { pixelRatio: Math.min(window.devicePixelRatio, 2),   geoDetail: 48, particles: 2000, bloom: true, wireframe: true, rgbShift: true },
  ultra: { pixelRatio: window.devicePixelRatio,                geoDetail: 64, particles: 4000, bloom: true, wireframe: true, rgbShift: true }
};

export const DEFAULT_SETTINGS = {
  isStrobeEnabled: true,
  isBlackAndWhite: true,
  flashDecay: 0.88,
  bassSensMult: 1.0,
  glowStrength: 0.1,
  cameraSpeedMult: 1.0,
  preset: null,
  currentTrackIndex: -1
};

export function getDefaultPreset() {
  return isMobile ? 'mid' : 'high';
}

export function createSettingsManager(initial = {}) {
  const state = {
    ...DEFAULT_SETTINGS,
    ...initial,
    preset: initial.preset ?? getDefaultPreset(),
    isStrobeEnabled: initial.isStrobeEnabled ?? DEFAULT_SETTINGS.isStrobeEnabled,
    isBlackAndWhite: initial.isBlackAndWhite ?? DEFAULT_SETTINGS.isBlackAndWhite
  };

  const listeners = new Set();

  return {
    get: () => state,

    set(key, value) {
      state[key] = value;
      listeners.forEach((fn) => fn(state));
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    reset() {
      Object.assign(state, {
        ...DEFAULT_SETTINGS,
        preset: getDefaultPreset()
      });
      listeners.forEach((fn) => fn(state));
      return state;
    },

    toJSON() {
      return {
        isStrobeEnabled: state.isStrobeEnabled,
        isBlackAndWhite: state.isBlackAndWhite,
        flashDecay: state.flashDecay,
        bassSensMult: state.bassSensMult,
        glowStrength: state.glowStrength,
        cameraSpeedMult: state.cameraSpeedMult,
        preset: state.preset,
        currentTrackIndex: state.currentTrackIndex
      };
    }
  };
}
