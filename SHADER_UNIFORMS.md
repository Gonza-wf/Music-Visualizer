/**
 * SHADER UNIFORMS DOCUMENTATION
 * =============================
 * 
 * Documentación completa de los uniforms utilizados en los vertex y fragment shaders
 * del visualizador. Estos uniforms son actualizados en tiempo real por la función
 * updateUniforms() en visualizer.js
 */

/**
 * UNIFORMS BÁSICOS DE TIEMPO Y AUDIO
 * ==================================
 */

/**
 * @uniform uTime (float)
 * Tiempo total en segundos desde el inicio de la reproducción
 * - Rango: 0 → ∞
 * - Uso: Animaciones continuas, noise perlin, rotaciones
 * - Actualización: Cada frame (clock.getElapsedTime())
 * 
 * Efecto visual:
 * - Controla la "respiración" orgánica del mesh
 * - Anima el ruido Simplex para efectos de ondulación
 * - Base de todas las animaciones continuas
 * 
 * @example
 * float baseNoise = snoise(position * 0.25 + uTime * 0.12);
 */

/**
 * UNIFORMS DE FRECUENCIAS DE AUDIO
 * ================================
 */

/**
 * @uniform uBass (float)
 * Intensidad de las frecuencias bajas (0-200 Hz aprox)
 * - Rango: 0.0 → 1.0 (normalizado)
 * - Actualización: Cada frame desde analyser FFT
 * - EMA applied: Sí (envelope ADSR)
 * 
 * Efecto visual:
 * - Estiramiento vertical principal del mesh
 * - Escala general del visualizador
 * - Intensidad de particles
 * - Magnitud del camera shake
 * 
 * @example
 * float kickAccent = pow(max(0.0, 1.0 - uBeatPhase), 2.2) * uBeatPulse;
 * float stretchIntensity = smoothstep(0.32, 0.88, uBass) * (0.28 + uBeat * 0.5);
 */

/**
 * @uniform uMid (float)
 * Intensidad de las frecuencias medias (200-2000 Hz aprox)
 * - Rango: 0.0 → 1.0
 * - Actualización: Cada frame
 * - EMA applied: Sí
 * 
 * Efecto visual:
 * - Torsión y anillos en el mesh (twist, rings)
 * - Brillo/saturation del color
 * - Wobble en la rotación de cámara
 * - Movimiento de particles en eje X
 * 
 * @example
 * float twist = snoise(vec3(...)) * uMid * 0.28;
 * float rings = sin((position.x * 2.8 + position.y * 3.2) + ...) * uMid * 0.16;
 */

/**
 * @uniform uTreble (float)
 * Intensidad de las frecuencias altas (2000+ Hz)
 * - Rango: 0.0 → 1.0
 * - Actualización: Cada frame
 * - EMA applied: Sí
 * 
 * Efecto visual:
 * - Textura fina en la superficie (trebleRipples)
 * - RGB Shift shader (distorsión cromática)
 * - Rim lighting en bordes
 * - Opacidad del wireframe
 * 
 * @example
 * float trebleRipples = snoise(position * 1.6 + uTime * 2.6) * uTreble * 0.24;
 */

/**
 * @uniform uEnergy (float)
 * Energía general combinada (weighted mix)
 * - Rango: 0.0 → 1.0
 * - Cálculo: bass*0.55 + mid*0.30 + treble*0.15
 * - Actualización: Cada frame
 * 
 * Efecto visual:
 * - Escala general del mesh
 * - Brightness del color base
 * - Escala de particles
 * 
 * Nota: Refleja la "sensación" energética general del sonido
 * 
 * @example
 * value = 0.13 + uBass * 0.24 + uEnergy * 0.1 + vDisplacement * 0.08;
 */

/**
 * UNIFORMS DE BEAT DETECTION
 * ==========================
 */

/**
 * @uniform uBeat (float)
 * Indicador de presencia de beat
 * - Rango: 0.0 → 1.0
 * - Valores: 0=no beat, 1=fuerte beat
 * - Actualización: Cada frame desde BeatDetector
 * 
 * Efecto visual:
 * - Escala y brightness instantáneos
 * - Prioridad en animaciones
 * 
 * @example
 * color += color * rim * (0.3 + uTreble * 0.3 + uDrop * 0.35);
 */

/**
 * @uniform uBeatPhase (float)
 * Fase dentro del beat actual (0-1)
 * - Rango: 0.0 → 1.0
 * - Significado: 0=inicio beat, 1=fin beat
 * - Período: Basado en BPM estimado
 * 
 * Efecto visual:
 * - Wobble suave durante el beat
 * - Fade suave de animaciones de beat
 * 
 * @example
 * float kickAccent = pow(max(0.0, 1.0 - uBeatPhase), 2.2) * uBeatPulse;
 * float phaseWobble = sin(uBeatPhase * PI * 2) * displayMid * 0.042;
 */

/**
 * @uniform uBeatPulse (float)
 * Magnitud del pulso del beat
 * - Rango: 0.0 → 1.0
 * - Valores: 0.75=beat normal, 1.0=heavy kick
 * - Actualización: En detección de beat
 * 
 * Efecto visual:
 * - Amplitud de estiramiento vertical
 * - Intensidad de flashes strobo
 * - Amplitud del camera shake
 */

/**
 * @uniform uDrop (float)
 * Magnitud del "drop" (pico energético)
 * - Rango: 0.0 → 1.0
 * - Valores: Solo > 0 durante drops
 * - Decaimiento: Suave (0.9 per frame cuando no-drop)
 * 
 * Efecto visual:
 * - Escala MÁS grande que beats normales
 * - Camera zoom muy agresivo
 * - Stroboscopic flash intenso
 * - Intensidad del RGB shift
 * - Tilt de rotación
 * 
 * Importancia: El efecto visual más dramático del proyecto
 * 
 * @example
 * let targetScale = 1.0 + ... + drop * 0.85 + ...;
 * const targetFov = 70 + ... + drop * 52 + ...;
 */

/**
 * @uniform uImpact (float)
 * Nivel de "impacto" combinado
 * - Rango: 0.0 → 1.0
 * - Cálculo: max(impactLevel, energySpikes)
 * - Decaimiento: Suave (0.9 per frame)
 * 
 * Efecto visual:
 * - Intensidad de camera shake
 * - Amplificador de efectos visuales
 */

/**
 * COLOR Y APARIENCIA
 * ==================
 */

/**
 * @uniform uOpacity (float)
 * Opacidad general del mesh
 * - Rango: 0.0 → 1.0
 * - Valores: Cambia dinámicamente con treble
 * 
 * Cálculo:
 * - Material: value + energy * 0.1 + beatPulse * 0.16 + drop * 0.22
 * - Wireframe: 0.08 + treble * 0.5 + snare * 0.28 + drop * 0.18
 * 
 * @example
 * gl_FragColor = vec4(color, uOpacity);
 */

/**
 * UNIFORMS DERIVADOS/INTERNOS
 * ===========================
 */

/**
 * Estos uniforms se calculan internamente pero se documentan para claridad:
 */

/**
 * @internal offbeatPulse
 * Pulso en los "offbeats" (entre beats principales)
 * 
 * @internal snarePulse
 * Pulso específico de snare/hi-hat
 * 
 * @internal midPulse
 * Pulso de frecuencias medias
 * 
 * @internal trebleDelta
 * Cambio instantáneo en treble (útil para kicks de hi-hat)
 * 
 * @internal anticipatedBeat
 * Predicción de siguiente beat (para anticipación visual)
 */

/**
 * ACTUALIZACIÓN DE UNIFORMS
 * =========================
 * 
 * La función updateUniforms() en visualizer.js es responsable de:
 * 1. Leer datos del BeatDetector y analyser
 * 2. Aplicar envelopes ADSR
 * 3. Normalizar valores
 * 4. Pasar al material.uniforms
 * 
 * Timing:
 * - Se llama cada frame en la función animate()
 * - Antes de render (composition)
 * - Después de beat detection
 * 
 * @example
 * updateUniforms(material, time, displayBass, displayMid, displayTreble, energy, beat);
 * material.uniforms.uBass.value = displayBass;
 * material.uniforms.uBeatPhase.value = beat.beatPhase;
 * // ... etc
 */

/**
 * RANGO Y NORMALIZACIÓN
 * =====================
 * 
 * Todos los uniforms float están normalizados a 0.0-1.0 para:
 * - Prevenir artefactos en shaders
 * - Mantener control consistente
 * - Facilitar transiciones suaves
 * 
 * Clamp en critical values:
 * value = clamp(value, 0.06, 0.6);  // Ejemplo del valor final
 * 
 */

/**
 * TIPS PARA TUNING
 * ================
 * 
 * 1. Bass dominance: Aumentar multiplicador en stretchIntensity
 * 2. Treble detail: Aumentar scale del trebleRipples noise
 * 3. Beat snappiness: Aumentar velocidad de ADSR attack
 * 4. Drop intensity: Multiplicar dropAccent por valores más altos
 * 5. Color vividness: Aumentar saturation en HSV
 * 
 * Valores recomendados están comentados en el código del shader
 */
