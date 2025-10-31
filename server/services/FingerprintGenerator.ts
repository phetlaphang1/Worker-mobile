import { logger } from '../utils/logger.js';

/**
 * Sensor Data - Dữ liệu cảm biến giống thiết bị thật
 */
export interface SensorData {
  accelerometer: {
    x: number; // -10 to +10 m/s²
    y: number;
    z: number;
  };
  gyroscope: {
    alpha: number; // 0-360 degrees (rotation around Z)
    beta: number;  // -180 to 180 degrees (rotation around X)
    gamma: number; // -90 to 90 degrees (rotation around Y)
  };
  magnetometer: {
    x: number; // -100 to +100 μT
    y: number;
    z: number;
  };
}

/**
 * Battery Data - Thông tin pin giống thiết bị thật
 */
export interface BatteryData {
  level: number; // 20-95% (realistic range)
  isCharging: boolean;
  chargingType?: 'usb' | 'ac' | 'wireless'; // Type of charging
  temperature: number; // 25-45°C (realistic range)
  health: 'good' | 'overheat' | 'cold'; // Battery health
  voltage: number; // 3700-4200 mV
}

/**
 * Device Fingerprint - Tất cả thông tin để fake 1 thiết bị Android
 */
export interface DeviceFingerprint {
  imei: string;
  androidId: string;
  model: string;
  manufacturer: string;
  brand: string;
  device: string; // Device codename (e.g., "beyond1" for S10)
  macAddress: string;
  serialNumber: string;
  phoneNumber?: string;
  simSerial?: string;
  // Build info
  buildId: string;
  buildDisplay: string;
  fingerprint: string; // ro.build.fingerprint
  // Real device specs
  realResolution?: string; // Real device resolution (e.g., "1080x2400")
  realDpi?: number; // Real device DPI (e.g., 420)
  // Sensor data (NEW)
  sensors?: SensorData;
  // Battery data (NEW)
  battery?: BatteryData;
}

/**
 * Real Android Device Template
 */
export interface AndroidDeviceTemplate {
  brand: string;
  manufacturer: string;
  model: string;
  device: string;
  buildId: string;
  fingerprint: string;
  // Common specs for this device
  resolution?: string;
  dpi?: number;
}

/**
 * FingerprintGenerator - Generate random but realistic device fingerprints
 */
export class FingerprintGenerator {
  private static readonly REAL_DEVICES: AndroidDeviceTemplate[] = [
    // Samsung Galaxy Series
    {
      brand: 'Samsung',
      manufacturer: 'Samsung',
      model: 'SM-G991B',
      device: 'o1s',
      buildId: 'TP1A.220624.014',
      fingerprint: 'samsung/o1sxxx/o1s:13/TP1A.220624.014/G991BXXU5EWGA:user/release-keys',
      resolution: '1080x2400',
      dpi: 450
    },
    {
      brand: 'Samsung',
      manufacturer: 'Samsung',
      model: 'SM-G996B',
      device: 'o1q',
      buildId: 'TP1A.220624.014',
      fingerprint: 'samsung/o1qxxx/o1q:13/TP1A.220624.014/G996BXXU5EWGA:user/release-keys',
      resolution: '1080x2400',
      dpi: 450
    },
    {
      brand: 'Samsung',
      manufacturer: 'Samsung',
      model: 'SM-A525F',
      device: 'a52q',
      buildId: 'TP1A.220624.014',
      fingerprint: 'samsung/a52qxxx/a52q:13/TP1A.220624.014/A525FXXU5CWK3:user/release-keys',
      resolution: '1080x2400',
      dpi: 450
    },
    // Xiaomi Redmi Series
    {
      brand: 'Redmi',
      manufacturer: 'Xiaomi',
      model: 'Redmi Note 11',
      device: 'spes',
      buildId: 'TKQ1.220829.002',
      fingerprint: 'Redmi/spes_global/spes:13/TKQ1.220829.002/V14.0.3.0.TGCMIXM:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    {
      brand: 'Redmi',
      manufacturer: 'Xiaomi',
      model: 'Redmi Note 12 Pro',
      device: 'sweet',
      buildId: 'TKQ1.221114.001',
      fingerprint: 'Redmi/sweet_global/sweet:13/TKQ1.221114.001/V14.0.5.0.TKFMIXM:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    // Google Pixel Series
    {
      brand: 'Google',
      manufacturer: 'Google',
      model: 'Pixel 7',
      device: 'panther',
      buildId: 'TQ3A.230805.001',
      fingerprint: 'google/panther/panther:14/TQ3A.230805.001/10316531:user/release-keys',
      resolution: '1080x2400',
      dpi: 420
    },
    {
      brand: 'Google',
      manufacturer: 'Google',
      model: 'Pixel 6',
      device: 'oriole',
      buildId: 'TQ3A.230805.001',
      fingerprint: 'google/oriole/oriole:14/TQ3A.230805.001/10316531:user/release-keys',
      resolution: '1080x2400',
      dpi: 420
    },
    // OnePlus Series
    {
      brand: 'OnePlus',
      manufacturer: 'OnePlus',
      model: 'OnePlus 9',
      device: 'lemonade',
      buildId: 'RKQ1.201105.002',
      fingerprint: 'OnePlus/OnePlus9/OnePlus9:13/RKQ1.201105.002/Q.202302132349:user/release-keys',
      resolution: '1080x2400',
      dpi: 420
    },
    {
      brand: 'OnePlus',
      manufacturer: 'OnePlus',
      model: 'OnePlus Nord 2',
      device: 'denniz',
      buildId: 'RKQ1.211119.001',
      fingerprint: 'OnePlus/Nord2/denniz:13/RKQ1.211119.001/Q.202302280949:user/release-keys',
      resolution: '1080x2400',
      dpi: 420
    },
    // Oppo Series
    {
      brand: 'OPPO',
      manufacturer: 'OPPO',
      model: 'CPH2269',
      device: 'OP4F2FL1',
      buildId: 'SP1A.210812.016',
      fingerprint: 'OPPO/CPH2269/OP4F2FL1:13/SP1A.210812.016/1682576920861:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    // Vivo Series
    {
      brand: 'vivo',
      manufacturer: 'vivo',
      model: 'V2111',
      device: 'PD2111',
      buildId: 'RP1A.200720.012',
      fingerprint: 'vivo/PD2111/PD2111:13/RP1A.200720.012/compiler08241909:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    // Realme Series
    {
      brand: 'realme',
      manufacturer: 'realme',
      model: 'RMX3393',
      device: 'RE54E4L1',
      buildId: 'SP1A.210812.016',
      fingerprint: 'realme/RMX3393/RE54E4L1:13/SP1A.210812.016/R.202302161809:user/release-keys',
      resolution: '1080x2400',
      dpi: 450
    },
    // Samsung Galaxy A Series (More models)
    {
      brand: 'Samsung',
      manufacturer: 'Samsung',
      model: 'SM-A536B',
      device: 'a53x',
      buildId: 'TP1A.220624.014',
      fingerprint: 'samsung/a53xxxx/a53x:13/TP1A.220624.014/A536BXXU5CWL2:user/release-keys',
      resolution: '1080x2400',
      dpi: 450
    },
    {
      brand: 'Samsung',
      manufacturer: 'Samsung',
      model: 'SM-A736B',
      device: 'a73xq',
      buildId: 'TP1A.220624.014',
      fingerprint: 'samsung/a73xqxxx/a73xq:13/TP1A.220624.014/A736BXXU5CWK5:user/release-keys',
      resolution: '1080x2400',
      dpi: 450
    },
    {
      brand: 'Samsung',
      manufacturer: 'Samsung',
      model: 'SM-S911B',
      device: 'dm1q',
      buildId: 'TP1A.220624.014',
      fingerprint: 'samsung/dm1qxxx/dm1q:13/TP1A.220624.014/S911BXXU2AWK1:user/release-keys',
      resolution: '1080x2340',
      dpi: 450
    },
    {
      brand: 'Samsung',
      manufacturer: 'Samsung',
      model: 'SM-S916B',
      device: 'dm2q',
      buildId: 'TP1A.220624.014',
      fingerprint: 'samsung/dm2qxxx/dm2q:13/TP1A.220624.014/S916BXXU2AWK1:user/release-keys',
      resolution: '1440x3088',
      dpi: 560
    },
    {
      brand: 'Samsung',
      manufacturer: 'Samsung',
      model: 'SM-S918B',
      device: 'dm3q',
      buildId: 'TP1A.220624.014',
      fingerprint: 'samsung/dm3qxxx/dm3q:13/TP1A.220624.014/S918BXXU2AWK1:user/release-keys',
      resolution: '1440x3088',
      dpi: 560
    },
    // Xiaomi Mi Series
    {
      brand: 'Xiaomi',
      manufacturer: 'Xiaomi',
      model: 'Mi 11',
      device: 'venus',
      buildId: 'TKQ1.220829.002',
      fingerprint: 'Xiaomi/venus_global/venus:13/TKQ1.220829.002/V14.0.4.0.TKBMIXM:user/release-keys',
      resolution: '1440x3200',
      dpi: 560
    },
    {
      brand: 'Xiaomi',
      manufacturer: 'Xiaomi',
      model: 'Mi 12',
      device: 'cupid',
      buildId: 'TKQ1.220905.001',
      fingerprint: 'Xiaomi/cupid_global/cupid:13/TKQ1.220905.001/V14.0.3.0.TLCMIXM:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    {
      brand: 'Xiaomi',
      manufacturer: 'Xiaomi',
      model: 'Mi 13',
      device: 'fuxi',
      buildId: 'TKQ1.221114.001',
      fingerprint: 'Xiaomi/fuxi_global/fuxi:13/TKQ1.221114.001/V14.0.5.0.TMCMIXM:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    // Xiaomi Poco Series
    {
      brand: 'POCO',
      manufacturer: 'Xiaomi',
      model: 'POCO X4 Pro',
      device: 'veux',
      buildId: 'TKQ1.220829.002',
      fingerprint: 'POCO/veux_global/veux:13/TKQ1.220829.002/V14.0.2.0.TKCMIXM:user/release-keys',
      resolution: '1080x2400',
      dpi: 395
    },
    {
      brand: 'POCO',
      manufacturer: 'Xiaomi',
      model: 'POCO F4',
      device: 'munch',
      buildId: 'TKQ1.220807.001',
      fingerprint: 'POCO/munch_global/munch:13/TKQ1.220807.001/V14.0.4.0.TLMMIXM:user/release-keys',
      resolution: '1080x2400',
      dpi: 395
    },
    {
      brand: 'POCO',
      manufacturer: 'Xiaomi',
      model: 'POCO X5 Pro',
      device: 'redwood',
      buildId: 'TKQ1.221114.001',
      fingerprint: 'POCO/redwood_global/redwood:13/TKQ1.221114.001/V14.0.3.0.TGPMIXM:user/release-keys',
      resolution: '1080x2400',
      dpi: 395
    },
    // Google Pixel (More models)
    {
      brand: 'Google',
      manufacturer: 'Google',
      model: 'Pixel 7 Pro',
      device: 'cheetah',
      buildId: 'TQ3A.230805.001',
      fingerprint: 'google/cheetah/cheetah:14/TQ3A.230805.001/10316531:user/release-keys',
      resolution: '1440x3120',
      dpi: 560
    },
    {
      brand: 'Google',
      manufacturer: 'Google',
      model: 'Pixel 6 Pro',
      device: 'raven',
      buildId: 'TQ3A.230805.001',
      fingerprint: 'google/raven/raven:14/TQ3A.230805.001/10316531:user/release-keys',
      resolution: '1440x3120',
      dpi: 560
    },
    {
      brand: 'Google',
      manufacturer: 'Google',
      model: 'Pixel 8',
      device: 'shiba',
      buildId: 'TQ3A.230805.001',
      fingerprint: 'google/shiba/shiba:14/TQ3A.230805.001/10316531:user/release-keys',
      resolution: '1080x2400',
      dpi: 420
    },
    {
      brand: 'Google',
      manufacturer: 'Google',
      model: 'Pixel 8 Pro',
      device: 'husky',
      buildId: 'TQ3A.230805.001',
      fingerprint: 'google/husky/husky:14/TQ3A.230805.001/10316531:user/release-keys',
      resolution: '1344x2992',
      dpi: 480
    },
    // OnePlus (More models)
    {
      brand: 'OnePlus',
      manufacturer: 'OnePlus',
      model: 'OnePlus 10 Pro',
      device: 'op515bl1',
      buildId: 'SKQ1.220815.001',
      fingerprint: 'OnePlus/OnePlus10Pro/OP515BL1:13/SKQ1.220815.001/Q.202303151942:user/release-keys',
      resolution: '1440x3216',
      dpi: 560
    },
    {
      brand: 'OnePlus',
      manufacturer: 'OnePlus',
      model: 'OnePlus 11',
      device: 'salami',
      buildId: 'SKQ1.221119.001',
      fingerprint: 'OnePlus/OnePlus11/salami:13/SKQ1.221119.001/R.202304251742:user/release-keys',
      resolution: '1440x3216',
      dpi: 560
    },
    {
      brand: 'OnePlus',
      manufacturer: 'OnePlus',
      model: 'OnePlus Nord 3',
      device: 'CPH2491',
      buildId: 'TP1A.220905.001',
      fingerprint: 'OnePlus/Nord3/CPH2491:13/TP1A.220905.001/R.202308171942:user/release-keys',
      resolution: '1080x2412',
      dpi: 420
    },
    // Oppo (More models)
    {
      brand: 'OPPO',
      manufacturer: 'OPPO',
      model: 'CPH2375',
      device: 'OP4F85L1',
      buildId: 'TP1A.220905.001',
      fingerprint: 'OPPO/CPH2375/OP4F85L1:13/TP1A.220905.001/1688765920123:user/release-keys',
      resolution: '1080x2412',
      dpi: 440
    },
    {
      brand: 'OPPO',
      manufacturer: 'OPPO',
      model: 'CPH2505',
      device: 'OP557AL1',
      buildId: 'TP1A.220905.001',
      fingerprint: 'OPPO/CPH2505/OP557AL1:13/TP1A.220905.001/1695432156789:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    {
      brand: 'OPPO',
      manufacturer: 'OPPO',
      model: 'CPH2451',
      device: 'OP556CL1',
      buildId: 'SP1A.210812.016',
      fingerprint: 'OPPO/CPH2451/OP556CL1:13/SP1A.210812.016/1692817654321:user/release-keys',
      resolution: '1080x2412',
      dpi: 450
    },
    // Vivo (More models)
    {
      brand: 'vivo',
      manufacturer: 'vivo',
      model: 'V2219',
      device: 'PD2219',
      buildId: 'SP1A.210812.003',
      fingerprint: 'vivo/PD2219/PD2219:13/SP1A.210812.003/compiler09211523:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    {
      brand: 'vivo',
      manufacturer: 'vivo',
      model: 'V2227',
      device: 'PD2227',
      buildId: 'TP1A.220624.014',
      fingerprint: 'vivo/PD2227/PD2227:13/TP1A.220624.014/compiler10121815:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    {
      brand: 'vivo',
      manufacturer: 'vivo',
      model: 'V2250',
      device: 'PD2250',
      buildId: 'TP1A.220624.014',
      fingerprint: 'vivo/PD2250/PD2250:13/TP1A.220624.014/compiler11051720:user/release-keys',
      resolution: '1260x2800',
      dpi: 480
    },
    // Realme (More models)
    {
      brand: 'realme',
      manufacturer: 'realme',
      model: 'RMX3511',
      device: 'RE54C4L1',
      buildId: 'SP1A.210812.016',
      fingerprint: 'realme/RMX3511/RE54C4L1:13/SP1A.210812.016/R.202303251645:user/release-keys',
      resolution: '1080x2412',
      dpi: 450
    },
    {
      brand: 'realme',
      manufacturer: 'realme',
      model: 'RMX3710',
      device: 'RE58B8L1',
      buildId: 'TP1A.220905.001',
      fingerprint: 'realme/RMX3710/RE58B8L1:13/TP1A.220905.001/R.202308151923:user/release-keys',
      resolution: '1080x2412',
      dpi: 450
    },
    {
      brand: 'realme',
      manufacturer: 'realme',
      model: 'RMX3800',
      device: 'RE879BL1',
      buildId: 'TP1A.220905.001',
      fingerprint: 'realme/RMX3800/RE879BL1:13/TP1A.220905.001/R.202309201845:user/release-keys',
      resolution: '1080x2400',
      dpi: 395
    },
    // Motorola Series
    {
      brand: 'Motorola',
      manufacturer: 'Motorola',
      model: 'moto g73',
      device: 'dubai',
      buildId: 'T1SDS33.113-87-5-1',
      fingerprint: 'motorola/dubai/dubai:13/T1SDS33.113-87-5-1/1a8f5e:user/release-keys',
      resolution: '1080x2400',
      dpi: 395
    },
    {
      brand: 'Motorola',
      manufacturer: 'Motorola',
      model: 'moto g84',
      device: 'hawaii',
      buildId: 'T1THS33.113-94-8-2',
      fingerprint: 'motorola/hawaii/hawaii:13/T1THS33.113-94-8-2/c8e9f:user/release-keys',
      resolution: '1080x2400',
      dpi: 395
    },
    {
      brand: 'Motorola',
      manufacturer: 'Motorola',
      model: 'edge 40',
      device: 'rtwo',
      buildId: 'T1SRS33.72-18-3-5',
      fingerprint: 'motorola/rtwo/rtwo:13/T1SRS33.72-18-3-5/5d4a2:user/release-keys',
      resolution: '1080x2400',
      dpi: 402
    },
    // Honor Series
    {
      brand: 'HONOR',
      manufacturer: 'HONOR',
      model: 'LGE-LX1',
      device: 'HWLGE-H',
      buildId: 'TP1A.220624.014',
      fingerprint: 'HONOR/LGE-LX1/HWLGE-H:13/TP1A.220624.014/11.0.0.145:user/release-keys',
      resolution: '1080x2400',
      dpi: 440
    },
    {
      brand: 'HONOR',
      manufacturer: 'HONOR',
      model: 'NTN-LX2',
      device: 'HWNTN-H',
      buildId: 'SP1A.210812.016',
      fingerprint: 'HONOR/NTN-LX2/HWNTN-H:13/SP1A.210812.016/13.0.0.231:user/release-keys',
      resolution: '1080x2412',
      dpi: 440
    },
    // Asus Series
    {
      brand: 'ASUS',
      manufacturer: 'ASUS',
      model: 'ASUS_AI2203',
      device: 'AI2203',
      buildId: 'TKQ1.220807.001',
      fingerprint: 'asus/WW_AI2203/ASUS_AI2203:13/TKQ1.220807.001/33.0804.2060.73:user/release-keys',
      resolution: '1080x2448',
      dpi: 395
    },
    {
      brand: 'ASUS',
      manufacturer: 'ASUS',
      model: 'ASUS_Z01QD',
      device: 'ASUS_Z01QD',
      buildId: 'SKQ1.220303.001',
      fingerprint: 'asus/WW_Phone/ASUS_Z01QD:13/SKQ1.220303.001/32.2810.2203.63:user/release-keys',
      resolution: '1080x2160',
      dpi: 403
    }
  ];

  /**
   * Generate realistic sensor data (accelerometer, gyroscope, magnetometer)
   */
  static generateSensorData(): SensorData {
    // Accelerometer: Slight variations simulating device at rest on table
    // Real devices have small noise even when stationary
    const accelX = (Math.random() - 0.5) * 0.4; // -0.2 to +0.2 m/s²
    const accelY = (Math.random() - 0.5) * 0.4;
    const accelZ = 9.8 + (Math.random() - 0.5) * 0.2; // ~9.8 m/s² (gravity) with noise

    // Gyroscope: Small rotations (device mostly still)
    const gyroAlpha = Math.random() * 360; // Random orientation
    const gyroBeta = (Math.random() - 0.5) * 10; // Small tilt -5 to +5 degrees
    const gyroGamma = (Math.random() - 0.5) * 10;

    // Magnetometer: Earth's magnetic field varies by location (25-65 μT)
    // Simulate realistic magnetic field with some device interference
    const magneticStrength = 30 + Math.random() * 20; // 30-50 μT
    const magneticAngle = Math.random() * Math.PI * 2;
    const magneticTilt = (Math.random() - 0.5) * Math.PI / 4;

    const magX = magneticStrength * Math.cos(magneticAngle) * Math.cos(magneticTilt);
    const magY = magneticStrength * Math.sin(magneticAngle) * Math.cos(magneticTilt);
    const magZ = magneticStrength * Math.sin(magneticTilt);

    return {
      accelerometer: {
        x: parseFloat(accelX.toFixed(3)),
        y: parseFloat(accelY.toFixed(3)),
        z: parseFloat(accelZ.toFixed(3))
      },
      gyroscope: {
        alpha: parseFloat(gyroAlpha.toFixed(2)),
        beta: parseFloat(gyroBeta.toFixed(2)),
        gamma: parseFloat(gyroGamma.toFixed(2))
      },
      magnetometer: {
        x: parseFloat(magX.toFixed(2)),
        y: parseFloat(magY.toFixed(2)),
        z: parseFloat(magZ.toFixed(2))
      }
    };
  }

  /**
   * Generate realistic battery data
   */
  static generateBatteryData(): BatteryData {
    // Battery level: 20-95% (realistic range, avoid extremes)
    const level = 20 + Math.floor(Math.random() * 76);

    // Charging state: 70% not charging, 30% charging
    const isCharging = Math.random() < 0.3;

    // Charging type (if charging)
    let chargingType: 'usb' | 'ac' | 'wireless' | undefined;
    if (isCharging) {
      const types: ('usb' | 'ac' | 'wireless')[] = ['usb', 'ac', 'wireless'];
      const weights = [0.4, 0.5, 0.1]; // AC most common, then USB, wireless rare
      const rand = Math.random();
      if (rand < weights[0]) chargingType = 'usb';
      else if (rand < weights[0] + weights[1]) chargingType = 'ac';
      else chargingType = 'wireless';
    }

    // Temperature: 25-45°C (realistic for active device)
    // Higher when charging or high battery
    let temperature = 28 + Math.random() * 10; // Base: 28-38°C
    if (isCharging) temperature += 3 + Math.random() * 4; // +3-7°C when charging
    if (level > 80) temperature += Math.random() * 2; // Slightly warmer at high charge
    temperature = Math.min(temperature, 45); // Cap at 45°C

    // Health
    let health: 'good' | 'overheat' | 'cold';
    if (temperature > 42) health = 'overheat';
    else if (temperature < 15) health = 'cold';
    else health = 'good';

    // Voltage: 3700-4200 mV (correlates with battery level)
    // 3700 mV at 0%, 4200 mV at 100%
    const voltage = 3700 + (level / 100) * 500;

    return {
      level,
      isCharging,
      chargingType,
      temperature: parseFloat(temperature.toFixed(1)),
      health,
      voltage: Math.round(voltage)
    };
  }

  /**
   * Generate random IMEI với thuật toán Luhn checksum
   */
  static generateIMEI(): string {
    // IMEI format: TAC (8 digits) + SNR (6 digits) + Luhn checksum (1 digit)
    // TAC (Type Allocation Code): First 8 digits (identifies manufacturer/model)
    const tac = this.generateRandomDigits(8);
    const snr = this.generateRandomDigits(6);

    const imeiWithoutChecksum = tac + snr;
    const checksum = this.calculateLuhnChecksum(imeiWithoutChecksum);

    const imei = imeiWithoutChecksum + checksum;
    logger.debug(`Generated IMEI: ${imei}`);
    return imei;
  }

  /**
   * Thuật toán Luhn để tính checksum
   */
  private static calculateLuhnChecksum(digits: string): number {
    let sum = 0;
    let isOdd = true;

    // Traverse từ phải sang trái
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isOdd) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isOdd = !isOdd;
    }

    return (10 - (sum % 10)) % 10;
  }

  /**
   * Generate random digits
   */
  private static generateRandomDigits(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10);
    }
    return result;
  }

  /**
   * Generate random Android ID (16 hex characters)
   */
  static generateAndroidId(): string {
    const hex = '0123456789abcdef';
    let androidId = '';
    for (let i = 0; i < 16; i++) {
      androidId += hex[Math.floor(Math.random() * hex.length)];
    }
    logger.debug(`Generated Android ID: ${androidId}`);
    return androidId;
  }

  /**
   * Generate random MAC address
   */
  static generateMacAddress(): string {
    const hex = '0123456789ABCDEF';
    let mac = '';

    // First byte: locally administered unicast (02:xx:xx:xx:xx:xx)
    mac += '02';

    for (let i = 1; i < 6; i++) {
      mac += ':';
      mac += hex[Math.floor(Math.random() * hex.length)];
      mac += hex[Math.floor(Math.random() * hex.length)];
    }

    logger.debug(`Generated MAC: ${mac}`);
    return mac;
  }

  /**
   * Generate random serial number (alphanumeric)
   */
  static generateSerialNumber(length: number = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let serial = '';
    for (let i = 0; i < length; i++) {
      serial += chars[Math.floor(Math.random() * chars.length)];
    }
    logger.debug(`Generated Serial: ${serial}`);
    return serial;
  }

  /**
   * Generate random phone number (format: +1234567890)
   */
  static generatePhoneNumber(countryCode: string = '+1'): string {
    const digits = this.generateRandomDigits(10);
    return countryCode + digits;
  }

  /**
   * Generate random SIM serial (ICCID - 19-20 digits)
   */
  static generateSimSerial(): string {
    const iccid = this.generateRandomDigits(19);
    const checksum = this.calculateLuhnChecksum(iccid);
    return iccid + checksum;
  }

  /**
   * Pick random device template from database
   */
  static getRandomDeviceTemplate(): AndroidDeviceTemplate {
    const index = Math.floor(Math.random() * this.REAL_DEVICES.length);
    return { ...this.REAL_DEVICES[index] };
  }

  /**
   * Get specific device template by brand
   */
  static getDeviceTemplateByBrand(brand: string): AndroidDeviceTemplate {
    const devices = this.REAL_DEVICES.filter(
      d => d.brand.toLowerCase() === brand.toLowerCase()
    );

    if (devices.length === 0) {
      logger.warn(`No device found for brand ${brand}, using random`);
      return this.getRandomDeviceTemplate();
    }

    const index = Math.floor(Math.random() * devices.length);
    return { ...devices[index] };
  }

  /**
   * Generate complete device fingerprint
   */
  static generateFingerprint(options?: {
    brand?: string;
    includePhoneNumber?: boolean;
    includeSensors?: boolean;
    includeBattery?: boolean;
  }): DeviceFingerprint {
    const {
      brand,
      includePhoneNumber = false,
      includeSensors = true, // Default to true for enhanced antidetect
      includeBattery = true  // Default to true for enhanced antidetect
    } = options || {};

    // Pick device template
    const template = brand
      ? this.getDeviceTemplateByBrand(brand)
      : this.getRandomDeviceTemplate();

    // Generate random identifiers
    const imei = this.generateIMEI();
    const androidId = this.generateAndroidId();
    const macAddress = this.generateMacAddress();
    const serialNumber = this.generateSerialNumber();
    const simSerial = this.generateSimSerial();

    // Build fingerprint with slight randomization
    const buildDisplay = `${template.model}-${template.buildId}`;

    const fingerprint: DeviceFingerprint = {
      imei,
      androidId,
      model: template.model,
      manufacturer: template.manufacturer,
      brand: template.brand,
      device: template.device,
      macAddress,
      serialNumber,
      simSerial,
      buildId: template.buildId,
      buildDisplay,
      fingerprint: template.fingerprint,
      realResolution: template.resolution, // Real device resolution
      realDpi: template.dpi // Real device DPI
    };

    if (includePhoneNumber) {
      fingerprint.phoneNumber = this.generatePhoneNumber();
    }

    // Add sensor data for enhanced antidetect
    if (includeSensors) {
      fingerprint.sensors = this.generateSensorData();
    }

    // Add battery data for enhanced antidetect
    if (includeBattery) {
      fingerprint.battery = this.generateBatteryData();
    }

    logger.info(`Generated fingerprint for ${template.brand} ${template.model} (${template.resolution} @ ${template.dpi}dpi) [Sensors: ${includeSensors}, Battery: ${includeBattery}]`);
    return fingerprint;
  }

  /**
   * Get all available device templates
   */
  static getAllDeviceTemplates(): AndroidDeviceTemplate[] {
    return [...this.REAL_DEVICES];
  }

  /**
   * Get available brands
   */
  static getAvailableBrands(): string[] {
    return Array.from(new Set(this.REAL_DEVICES.map(d => d.brand)));
  }
}

export default FingerprintGenerator;
