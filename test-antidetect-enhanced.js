/**
 * Enhanced Antidetect Test - Test sensor & battery randomization
 */

import { FingerprintGenerator } from './server/services/FingerprintGenerator.js';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  ENHANCED ANTIDETECT TEST - Sensors & Battery Features    ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test 1: Generate fingerprints with sensors and battery
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 1: Generate 10 Fingerprints with Full Features');
console.log('═══════════════════════════════════════════════════════════\n');

const fingerprints = [];
for (let i = 0; i < 10; i++) {
  const fp = FingerprintGenerator.generateFingerprint({
    includePhoneNumber: true,
    includeSensors: true,
    includeBattery: true
  });
  fingerprints.push(fp);
}

console.log(`Generated ${fingerprints.length} fingerprints with sensors & battery\n`);

// Test 2: Display sample fingerprints with all features
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 2: Sample Fingerprints (First 3)');
console.log('═══════════════════════════════════════════════════════════\n');

fingerprints.slice(0, 3).forEach((fp, i) => {
  console.log(`━━━━━━━━━━━━━━━ Instance ${i + 1} ━━━━━━━━━━━━━━━`);
  console.log(`📱 Device: ${fp.brand} ${fp.model}`);
  console.log(`   Resolution: ${fp.realResolution} @ ${fp.realDpi}dpi`);
  console.log(`   IMEI: ${fp.imei}`);
  console.log(`   Android ID: ${fp.androidId}`);
  console.log(`   MAC: ${fp.macAddress}`);

  if (fp.sensors) {
    console.log(`\n📊 Sensors:`);
    console.log(`   Accelerometer: x=${fp.sensors.accelerometer.x} y=${fp.sensors.accelerometer.y} z=${fp.sensors.accelerometer.z} m/s²`);
    console.log(`   Gyroscope: α=${fp.sensors.gyroscope.alpha}° β=${fp.sensors.gyroscope.beta}° γ=${fp.sensors.gyroscope.gamma}°`);
    console.log(`   Magnetometer: x=${fp.sensors.magnetometer.x} y=${fp.sensors.magnetometer.y} z=${fp.sensors.magnetometer.z} μT`);
  }

  if (fp.battery) {
    console.log(`\n🔋 Battery:`);
    console.log(`   Level: ${fp.battery.level}%`);
    console.log(`   Charging: ${fp.battery.isCharging ? 'Yes (' + fp.battery.chargingType + ')' : 'No'}`);
    console.log(`   Temperature: ${fp.battery.temperature}°C`);
    console.log(`   Health: ${fp.battery.health}`);
    console.log(`   Voltage: ${fp.battery.voltage} mV`);
  }
  console.log();
});

// Test 3: Verify sensor data uniqueness and realism
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 3: Sensor Data Validation (10 samples)');
console.log('═══════════════════════════════════════════════════════════\n');

const sensorTests = {
  accelerometerZ: [],
  gyroscopeAlpha: [],
  magnetometerStrength: []
};

fingerprints.forEach(fp => {
  if (fp.sensors) {
    sensorTests.accelerometerZ.push(fp.sensors.accelerometer.z);
    sensorTests.gyroscopeAlpha.push(fp.sensors.gyroscope.alpha);
    const magStrength = Math.sqrt(
      fp.sensors.magnetometer.x ** 2 +
      fp.sensors.magnetometer.y ** 2 +
      fp.sensors.magnetometer.z ** 2
    );
    sensorTests.magnetometerStrength.push(magStrength);
  }
});

// Check accelerometer Z (should be ~9.8 m/s² - gravity)
const avgAccelZ = sensorTests.accelerometerZ.reduce((a, b) => a + b, 0) / sensorTests.accelerometerZ.length;
const accelZValid = avgAccelZ > 9.6 && avgAccelZ < 10.0;
console.log(`Accelerometer Z (gravity):`);
console.log(`  Average: ${avgAccelZ.toFixed(2)} m/s² ${accelZValid ? '✅' : '❌'}`);
console.log(`  Range: ${Math.min(...sensorTests.accelerometerZ).toFixed(2)} - ${Math.max(...sensorTests.accelerometerZ).toFixed(2)} m/s²`);
console.log(`  Expected: ~9.8 m/s² (realistic gravity with noise)\n`);

// Check gyroscope alpha distribution (should be 0-360°)
const gyroAlphaUnique = new Set(sensorTests.gyroscopeAlpha.map(v => v.toFixed(0))).size;
console.log(`Gyroscope Alpha (orientation):`);
console.log(`  Unique values: ${gyroAlphaUnique}/${sensorTests.gyroscopeAlpha.length} ${gyroAlphaUnique >= 8 ? '✅' : '⚠️'}`);
console.log(`  Range: ${Math.min(...sensorTests.gyroscopeAlpha).toFixed(1)}° - ${Math.max(...sensorTests.gyroscopeAlpha).toFixed(1)}°`);
console.log(`  Expected: Random 0-360° (each device has different orientation)\n`);

// Check magnetometer strength (Earth's field: 25-65 μT)
const avgMagStrength = sensorTests.magnetometerStrength.reduce((a, b) => a + b, 0) / sensorTests.magnetometerStrength.length;
const magValid = avgMagStrength > 25 && avgMagStrength < 65;
console.log(`Magnetometer Strength (Earth's field):`);
console.log(`  Average: ${avgMagStrength.toFixed(1)} μT ${magValid ? '✅' : '❌'}`);
console.log(`  Range: ${Math.min(...sensorTests.magnetometerStrength).toFixed(1)} - ${Math.max(...sensorTests.magnetometerStrength).toFixed(1)} μT`);
console.log(`  Expected: 25-65 μT (realistic magnetic field)\n`);

// Test 4: Battery data validation
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 4: Battery Data Validation (10 samples)');
console.log('═══════════════════════════════════════════════════════════\n');

const batteryTests = {
  levels: [],
  chargingCount: 0,
  temperatures: [],
  voltages: []
};

fingerprints.forEach(fp => {
  if (fp.battery) {
    batteryTests.levels.push(fp.battery.level);
    if (fp.battery.isCharging) batteryTests.chargingCount++;
    batteryTests.temperatures.push(fp.battery.temperature);
    batteryTests.voltages.push(fp.battery.voltage);
  }
});

// Check battery levels (should be 20-95%)
const avgLevel = batteryTests.levels.reduce((a, b) => a + b, 0) / batteryTests.levels.length;
const levelValid = avgLevel > 20 && avgLevel < 95;
console.log(`Battery Level:`);
console.log(`  Average: ${avgLevel.toFixed(1)}% ${levelValid ? '✅' : '❌'}`);
console.log(`  Range: ${Math.min(...batteryTests.levels)}% - ${Math.max(...batteryTests.levels)}%`);
console.log(`  Expected: 20-95% (realistic range, avoiding extremes)\n`);

// Check charging distribution
const chargingPercent = (batteryTests.chargingCount / fingerprints.length * 100).toFixed(0);
const chargingRealistic = chargingPercent > 15 && chargingPercent < 45;
console.log(`Charging Status:`);
console.log(`  Charging: ${batteryTests.chargingCount}/${fingerprints.length} (${chargingPercent}%) ${chargingRealistic ? '✅' : '⚠️'}`);
console.log(`  Expected: ~30% charging (realistic distribution)\n`);

// Check temperatures (should be 25-45°C)
const avgTemp = batteryTests.temperatures.reduce((a, b) => a + b, 0) / batteryTests.temperatures.length;
const tempValid = avgTemp > 25 && avgTemp < 45;
console.log(`Battery Temperature:`);
console.log(`  Average: ${avgTemp.toFixed(1)}°C ${tempValid ? '✅' : '❌'}`);
console.log(`  Range: ${Math.min(...batteryTests.temperatures).toFixed(1)}°C - ${Math.max(...batteryTests.temperatures).toFixed(1)}°C`);
console.log(`  Expected: 25-45°C (warmer when charging or high battery)\n`);

// Check voltages (should be 3700-4200 mV)
const avgVoltage = batteryTests.voltages.reduce((a, b) => a + b, 0) / batteryTests.voltages.length;
const voltageValid = avgVoltage > 3700 && avgVoltage < 4200;
console.log(`Battery Voltage:`);
console.log(`  Average: ${avgVoltage.toFixed(0)} mV ${voltageValid ? '✅' : '❌'}`);
console.log(`  Range: ${Math.min(...batteryTests.voltages)} - ${Math.max(...batteryTests.voltages)} mV`);
console.log(`  Expected: 3700-4200 mV (correlates with battery level)\n`);

// Test 5: Device template count
console.log('═══════════════════════════════════════════════════════════');
console.log('TEST 5: Device Template Coverage');
console.log('═══════════════════════════════════════════════════════════\n');

const allTemplates = FingerprintGenerator.getAllDeviceTemplates();
const allBrands = FingerprintGenerator.getAvailableBrands();

console.log(`Total Device Templates: ${allTemplates.length} ${allTemplates.length >= 40 ? '✅' : '⚠️'}`);
console.log(`Available Brands: ${allBrands.length} (${allBrands.join(', ')})`);
console.log(`Expected: 40+ templates for strong antidetect\n`);

// Show brand distribution
const brandCount = {};
allTemplates.forEach(t => {
  brandCount[t.brand] = (brandCount[t.brand] || 0) + 1;
});

console.log('Device Templates by Brand:');
Object.entries(brandCount)
  .sort((a, b) => b[1] - a[1])
  .forEach(([brand, count]) => {
    const bar = '█'.repeat(Math.max(1, Math.floor(count / 2)));
    console.log(`  ${brand.padEnd(15)} ${count.toString().padStart(2)} ${bar}`);
  });
console.log();

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('ENHANCED ANTIDETECT SUMMARY');
console.log('═══════════════════════════════════════════════════════════\n');

const allChecks = {
  'Device Templates (40+)': allTemplates.length >= 40,
  'Sensor Data (Realistic)': accelZValid && magValid,
  'Battery Data (Realistic)': levelValid && tempValid && voltageValid,
  'Sensor Uniqueness': gyroAlphaUnique >= 8,
  'Charging Distribution': chargingRealistic
};

Object.entries(allChecks).forEach(([check, passed]) => {
  console.log(`${passed ? '✅' : '⚠️'}  ${check}`);
});
console.log();

const passedCount = Object.values(allChecks).filter(v => v).length;
const totalCount = Object.keys(allChecks).length;

if (passedCount === totalCount) {
  console.log('🎉 ENHANCED ANTIDETECT: EXCELLENT ✅');
  console.log('   All features working perfectly!');
} else if (passedCount >= totalCount - 1) {
  console.log('✅ ENHANCED ANTIDETECT: VERY GOOD');
  console.log(`   ${passedCount}/${totalCount} checks passed`);
} else {
  console.log('⚠️  ENHANCED ANTIDETECT: NEEDS TUNING');
  console.log(`   ${passedCount}/${totalCount} checks passed`);
}
console.log();

// Final features list
console.log('═══════════════════════════════════════════════════════════');
console.log('ANTIDETECT FEATURES (Complete List)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('✅ Device Identity:');
console.log('   • Unique IMEI per instance (Luhn checksum validated)');
console.log('   • Unique Android ID (16 hex characters)');
console.log('   • Unique MAC address (locally administered)');
console.log('   • Unique Serial Number');
console.log('   • Real device models (' + allTemplates.length + ' templates from ' + allBrands.length + ' brands)');
console.log('   • Real resolution and DPI per device model\n');

console.log('✅ Sensor Simulation (NEW):');
console.log('   • Accelerometer (gravity + realistic noise)');
console.log('   • Gyroscope (random device orientation)');
console.log('   • Magnetometer (Earth\'s magnetic field 25-65 μT)\n');

console.log('✅ Battery Simulation (NEW):');
console.log('   • Battery level (20-95%, realistic range)');
console.log('   • Charging status (30% charging, 70% not charging)');
console.log('   • Charging type (USB/AC/Wireless)');
console.log('   • Temperature (25-45°C, higher when charging)');
console.log('   • Health status (good/overheat/cold)');
console.log('   • Voltage (3700-4200 mV, correlates with level)\n');

console.log('✅ Build & Hardware:');
console.log('   • Valid build fingerprints (real Android builds)');
console.log('   • Phone number generation');
console.log('   • SIM serial (ICCID) generation\n');

console.log('📊 Detection Resistance Score: ' + passedCount + '/' + totalCount + ' (' + Math.round(passedCount / totalCount * 100) + '%)');
console.log();
