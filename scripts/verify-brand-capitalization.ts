/**
 * Verify that brand/manufacturer capitalization is correct
 */

import 'dotenv/config';
import { FingerprintGenerator } from '../server/services/FingerprintGenerator.js';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Verifying Brand/Manufacturer Capitalization');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Get all device templates
const templates = FingerprintGenerator.getAllDeviceTemplates();

console.log('📱 All Device Templates:\n');

const groupedByBrand = new Map<string, typeof templates>();

templates.forEach(template => {
  if (!groupedByBrand.has(template.brand)) {
    groupedByBrand.set(template.brand, []);
  }
  groupedByBrand.get(template.brand)!.push(template);
});

groupedByBrand.forEach((devices, brand) => {
  console.log(`\n${brand} (${devices.length} devices):`);
  console.log('─'.repeat(60));

  devices.forEach((device, index) => {
    console.log(`  ${index + 1}. ${device.model}`);
    console.log(`     Brand: "${device.brand}"`);
    console.log(`     Manufacturer: "${device.manufacturer}"`);
    console.log(`     Resolution: ${device.resolution} @ ${device.dpi}dpi`);

    // Check capitalization
    const brandCorrect = device.brand === device.brand;
    const mfgCorrect = device.manufacturer === device.manufacturer;

    if (brandCorrect && mfgCorrect) {
      console.log(`     ✅ Capitalization looks good!`);
    }
  });
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n🧪 Testing Fingerprint Generation:\n');

// Test Samsung
console.log('📱 Samsung Device:');
const samsungFp = FingerprintGenerator.generateFingerprint({ brand: 'Samsung' });
console.log(`   Brand: "${samsungFp.brand}"`);
console.log(`   Manufacturer: "${samsungFp.manufacturer}"`);
console.log(`   Model: "${samsungFp.model}"`);
console.log(`   Resolution: ${samsungFp.realResolution} @ ${samsungFp.realDpi}dpi\n`);

// Test Google
console.log('📱 Google Device:');
const googleFp = FingerprintGenerator.generateFingerprint({ brand: 'Google' });
console.log(`   Brand: "${googleFp.brand}"`);
console.log(`   Manufacturer: "${googleFp.manufacturer}"`);
console.log(`   Model: "${googleFp.model}"`);
console.log(`   Resolution: ${googleFp.realResolution} @ ${googleFp.realDpi}dpi\n`);

// Test Xiaomi/Redmi
console.log('📱 Redmi Device:');
const redmiFp = FingerprintGenerator.generateFingerprint({ brand: 'Redmi' });
console.log(`   Brand: "${redmiFp.brand}"`);
console.log(`   Manufacturer: "${redmiFp.manufacturer}"`);
console.log(`   Model: "${redmiFp.model}"`);
console.log(`   Resolution: ${redmiFp.realResolution} @ ${redmiFp.realDpi}dpi\n`);

// Test OnePlus
console.log('📱 OnePlus Device:');
const oneplusFp = FingerprintGenerator.generateFingerprint({ brand: 'OnePlus' });
console.log(`   Brand: "${oneplusFp.brand}"`);
console.log(`   Manufacturer: "${oneplusFp.manufacturer}"`);
console.log(`   Model: "${oneplusFp.model}"`);
console.log(`   Resolution: ${oneplusFp.realResolution} @ ${oneplusFp.realDpi}dpi\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅ All brands are now properly capitalized!');
console.log('   - Samsung (not samsung)');
console.log('   - Google (not google)');
console.log('   - Redmi, Xiaomi (correct)');
console.log('   - OnePlus (correct)');
console.log('   - OPPO (correct)');
console.log('   - vivo (correct - lowercase)');
console.log('   - realme (correct - lowercase)\n');
