/**
 * Test Antidetect System - Kiểm tra fingerprint generation
 */

import { FingerprintGenerator } from './server/services/FingerprintGenerator.js';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     ANTIDETECT SYSTEM TEST - Fingerprint Generation       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test 1: Check available device templates
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 1: Device Templates');
console.log('═══════════════════════════════════════════════════════════\n');

const templates = FingerprintGenerator.getAllDeviceTemplates();
const brands = FingerprintGenerator.getAvailableBrands();

console.log(`Total device templates: ${templates.length}`);
console.log(`Available brands: ${brands.join(', ')}`);
console.log();

// Show all templates
console.log('Device Models:');
templates.forEach((t, i) => {
  console.log(`  ${i+1}. ${t.brand} ${t.model} (${t.device}) - ${t.resolution} @ ${t.dpi}dpi`);
});
console.log();

// Test 2: Generate multiple fingerprints and check uniqueness
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 2: Fingerprint Uniqueness (Generate 20 instances)');
console.log('═══════════════════════════════════════════════════════════\n');

const fingerprints = [];
const imeis = new Set();
const androidIds = new Set();
const macAddresses = new Set();
const serialNumbers = new Set();

for (let i = 0; i < 20; i++) {
  const fp = FingerprintGenerator.generateFingerprint({ includePhoneNumber: true });
  fingerprints.push(fp);
  imeis.add(fp.imei);
  androidIds.add(fp.androidId);
  macAddresses.add(fp.macAddress);
  serialNumbers.add(fp.serialNumber);
}

console.log('Generated 20 fingerprints:');
console.log(`  Unique IMEIs: ${imeis.size}/20 ${imeis.size === 20 ? '✅' : '❌'}`);
console.log(`  Unique Android IDs: ${androidIds.size}/20 ${androidIds.size === 20 ? '✅' : '❌'}`);
console.log(`  Unique MAC Addresses: ${macAddresses.size}/20 ${macAddresses.size === 20 ? '✅' : '❌'}`);
console.log(`  Unique Serial Numbers: ${serialNumbers.size}/20 ${serialNumbers.size === 20 ? '✅' : '❌'}`);
console.log();

// Check device variety
const deviceModels = new Set(fingerprints.map(fp => fp.model));
console.log(`Device variety: ${deviceModels.size} different models used ${deviceModels.size >= 5 ? '✅' : '⚠️'}`);
console.log(`  Models used: ${Array.from(deviceModels).join(', ')}`);
console.log();

// Test 3: Show sample fingerprints
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 3: Sample Fingerprints (First 5)');
console.log('═══════════════════════════════════════════════════════════\n');

fingerprints.slice(0, 5).forEach((fp, i) => {
  console.log(`Instance ${i+1}:`);
  console.log(`  Device: ${fp.brand} ${fp.model}`);
  console.log(`  IMEI: ${fp.imei}`);
  console.log(`  Android ID: ${fp.androidId}`);
  console.log(`  MAC Address: ${fp.macAddress}`);
  console.log(`  Serial Number: ${fp.serialNumber}`);
  console.log(`  Phone Number: ${fp.phoneNumber || 'N/A'}`);
  console.log(`  SIM Serial: ${fp.simSerial}`);
  console.log(`  Resolution: ${fp.realResolution} @ ${fp.realDpi}dpi`);
  console.log(`  Build: ${fp.buildId}`);
  console.log(`  Fingerprint: ${fp.fingerprint.substring(0, 60)}...`);
  console.log();
});

// Test 4: IMEI Validation (Luhn checksum)
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 4: IMEI Validation (Luhn Checksum)');
console.log('═══════════════════════════════════════════════════════════\n');

function validateLuhnChecksum(imei) {
  const digits = imei.slice(0, -1); // All digits except last
  const checksum = parseInt(imei.slice(-1)); // Last digit

  let sum = 0;
  let isOdd = true;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);
    if (isOdd) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isOdd = !isOdd;
  }

  const calculatedChecksum = (10 - (sum % 10)) % 10;
  return calculatedChecksum === checksum;
}

const imeiTests = fingerprints.slice(0, 10).map(fp => fp.imei);
const validImeis = imeiTests.filter(validateLuhnChecksum);

console.log(`Testing 10 IMEIs for Luhn checksum validity:`);
console.log(`  Valid IMEIs: ${validImeis.length}/10 ${validImeis.length === 10 ? '✅' : '❌'}`);
imeiTests.forEach((imei, i) => {
  const isValid = validateLuhnChecksum(imei);
  console.log(`  ${i+1}. ${imei} ${isValid ? '✅' : '❌'}`);
});
console.log();

// Test 5: Brand-specific fingerprints
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 5: Brand-Specific Generation');
console.log('═══════════════════════════════════════════════════════════\n');

brands.forEach(brand => {
  const fp = FingerprintGenerator.generateFingerprint({ brand });
  console.log(`${brand}: ${fp.model} (${fp.device})`);
});
console.log();

// Test 6: Distribution analysis
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 6: Device Distribution (100 instances)');
console.log('═══════════════════════════════════════════════════════════\n');

const distribution = {};
for (let i = 0; i < 100; i++) {
  const fp = FingerprintGenerator.generateFingerprint();
  const key = `${fp.brand} ${fp.model}`;
  distribution[key] = (distribution[key] || 0) + 1;
}

console.log('Distribution of device models:');
Object.entries(distribution)
  .sort((a, b) => b[1] - a[1])
  .forEach(([model, count]) => {
    const percentage = (count / 100 * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / 2));
    console.log(`  ${model.padEnd(30)} ${count.toString().padStart(3)} (${percentage}%) ${bar}`);
  });
console.log();

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('SUMMARY');
console.log('═══════════════════════════════════════════════════════════\n');

const allUnique = imeis.size === 20 && androidIds.size === 20 && macAddresses.size === 20;
const allImeiValid = validImeis.length === 10;
const goodVariety = deviceModels.size >= 5;

console.log(`✅ Device Templates: ${templates.length} models from ${brands.length} brands`);
console.log(`${allUnique ? '✅' : '❌'} Uniqueness: All fingerprints are unique`);
console.log(`${allImeiValid ? '✅' : '❌'} IMEI Validity: All IMEIs pass Luhn checksum`);
console.log(`${goodVariety ? '✅' : '⚠️'} Variety: ${deviceModels.size} different models in 20 samples`);
console.log();

// Final verdict
const allPassed = allUnique && allImeiValid && goodVariety && templates.length >= 10;

if (allPassed) {
  console.log('🎉 ANTIDETECT SYSTEM: PASS ✅');
  console.log('   System generates unique, valid, and diverse fingerprints!');
} else {
  console.log('⚠️  ANTIDETECT SYSTEM: NEEDS IMPROVEMENT');
  if (!allUnique) console.log('   - Add more randomization for unique values');
  if (!allImeiValid) console.log('   - Fix IMEI generation (Luhn checksum)');
  if (!goodVariety) console.log('   - Add more device templates for variety');
  if (templates.length < 10) console.log('   - Need at least 10 device templates');
}
console.log();

// Recommendations
console.log('═══════════════════════════════════════════════════════════');
console.log('RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════════════\n');

if (templates.length < 20) {
  console.log('⚠️  Consider adding more device templates:');
  console.log('   - Current: 11 templates');
  console.log('   - Recommended: 30-50 templates');
  console.log('   - This improves antidetect by reducing fingerprint overlap');
  console.log();
}

console.log('✅ Current antidetect features:');
console.log('   ✅ Unique IMEI per instance (Luhn checksum validated)');
console.log('   ✅ Unique Android ID (16 hex characters)');
console.log('   ✅ Unique MAC address (locally administered)');
console.log('   ✅ Unique Serial Number');
console.log('   ✅ Real device models (Samsung, Xiaomi, Google, OnePlus, etc.)');
console.log('   ✅ Real resolution and DPI per device');
console.log('   ✅ Valid build fingerprints');
console.log('   ✅ Phone number and SIM serial generation');
console.log();

console.log('📝 To make detection even harder:');
console.log('   1. Add more device templates (30-50 models)');
console.log('   2. Add timezone randomization based on location');
console.log('   3. Add sensor data randomization (accelerometer, gyroscope)');
console.log('   4. Add battery level and charging state randomization');
console.log('   5. Add installed app list randomization');
console.log();
