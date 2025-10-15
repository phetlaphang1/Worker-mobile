import { logger } from '../utils/logger.js';

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
    }
  ];

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
  }): DeviceFingerprint {
    const { brand, includePhoneNumber = false } = options || {};

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

    logger.info(`Generated fingerprint for ${template.brand} ${template.model} (${template.resolution} @ ${template.dpi}dpi)`);
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
