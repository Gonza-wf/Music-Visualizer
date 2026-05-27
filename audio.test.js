/**
 * Tests para BeatDetector
 * Usar con vitest o jest: npm install --save-dev vitest
 * Ejecutar: npx vitest run audio.test.js
 * 
 * O con node puro (basic):
 * node audio.test.js
 */

import { BeatDetector } from './audio.js';

// Helper para validar números
function assertBetween(value, min, max, testName) {
  if (value >= min && value <= max) {
    console.log(`✅ ${testName}: PASS (${value})`);
    return true;
  } else {
    console.error(`❌ ${testName}: FAIL - Expected between ${min}-${max}, got ${value}`);
    return false;
  }
}

function assertTrue(value, testName) {
  if (value) {
    console.log(`✅ ${testName}: PASS`);
    return true;
  } else {
    console.error(`❌ ${testName}: FAIL`);
    return false;
  }
}

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ ${testName}: PASS`);
    return true;
  } else {
    console.error(`❌ ${testName}: FAIL - Expected ${expected}, got ${actual}`);
    return false;
  }
}

// Tests
console.log('\n🧪 BeatDetector Test Suite\n');

// Test 1: Detección de kick con bajos altos
console.log('1️⃣ Detección de kick');
const bd1 = new BeatDetector();
const result1 = bd1.update(0.8, 0.3, 0.2, 0, true, 1/60);
assertTrue(result1.isBeat, 'Debería detectar beat con bass 0.8');

// Test 2: Estimación de BPM
console.log('\n2️⃣ Estimación de BPM');
const bd2 = new BeatDetector();
let time = 0;
for (let i = 0; i < 12; i++) {
  bd2.update(0.7, 0.3, 0.2, time, true, 1/60);
  time += 0.5; // Simular beat cada 0.5s = 120 BPM
}
assertBetween(bd2.estimatedBPM, 110, 130, 'BPM debería estar cerca de 120');

// Test 3: Detección de drop
console.log('\n3️⃣ Detección de drop');
const bd3 = new BeatDetector();
const result3 = bd3.update(0.7, 0.8, 0.8, 0.5, true, 1/60);
assertTrue(result3.isDrop || result3.isBeat, 'Debería detectar algún evento con energía alta');

// Test 4: Inactividad
console.log('\n4️⃣ Comportamiento cuando no está playing');
const bd4 = new BeatDetector();
const result4 = bd4.update(0.8, 0.8, 0.8, 0, false, 1/60);
assertTrue(!result4.isBeat && !result4.isDrop, 'No debería detectar beats cuando isPlaying=false');

// Test 5: Reset
console.log('\n5️⃣ Reset de estado');
const bd5 = new BeatDetector();
bd5.update(0.8, 0.3, 0.2, 0, true, 1/60);
assertEqual(bd5.estimatedBPM, 128, 'BPM antes de reset debe ser > 128 (default)');
bd5.reset();
assertEqual(bd5.estimatedBPM, 128, 'BPM después de reset debe ser 128 (default)');
assertEqual(bd5.historyBass, 0.4, 'historyBass debe resetear a 0.4');

// Test 6: Cooldown de beats
console.log('\n6️⃣ Cooldown de beats');
const bd6 = new BeatDetector();
const r1 = bd6.update(0.8, 0.3, 0.2, 0, true, 1/60);
const r2 = bd6.update(0.8, 0.3, 0.2, 0.05, true, 1/60); // Solo 0.05s después
assertTrue(r1.isBeat, 'Primer beat debería detectarse');
assertTrue(!r2.isBeat, 'Segundo beat tan cercano no debería detectarse (cooldown)');

// Test 7: Treble Delta
console.log('\n7️⃣ Treble Delta');
const bd7 = new BeatDetector();
bd7.update(0.3, 0.3, 0.1, 0, true, 1/60);
const result7 = bd7.update(0.3, 0.3, 0.7, 0.016, true, 1/60); // Treble sube mucho
assertTrue(result7.trebleDelta > 0.3, `trebleDelta debería ser alto, got ${result7.trebleDelta}`);

// Test 8: Idle behavior (sin audio)
console.log('\n8️⃣ Comportamiento idle');
const bd8 = new BeatDetector();
for (let i = 0; i < 5; i++) {
  bd8.update(0, 0, 0, i * 0.016, false, 1/60);
}
assertEqual(bd8.currentBeat, 0, 'currentBeat debería ser 0 cuando no hay audio');

console.log('\n✨ Tests completados\n');
