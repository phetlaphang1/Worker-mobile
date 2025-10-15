import LDPlayerController from '../core/LDPlayerController.js';
import { FingerprintGenerator, DeviceFingerprint } from './FingerprintGenerator.js';
import { logger } from '../utils/logger.js';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * FingerprintService - Apply device fingerprints to LDPlayer instances
 *
 * Sử dụng 3 methods:
 * 1. LDConsole commands (fastest, không cần instance running)
 * 2. ADB shell setprop (requires running instance)
 * 3. Edit build.prop file (advanced, requires restart)
 */
export class FingerprintService {
  private controller: LDPlayerController;
  private ldConsolePath: string;
  private adbPath: string;
  private fingerprintCache: Map<string, DeviceFingerprint> = new Map();

  constructor(controller: LDPlayerController) {
    this.controller = controller;
    this.ldConsolePath = process.env.LDCONSOLE_PATH || 'D:\\LDPlayer\\LDPlayer9\\ldconsole.exe';
    this.adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';
  }

  /**
   * Apply complete fingerprint to instance
   * Tự động chọn method phù hợp (LDConsole hoặc ADB)
   */
  async applyFingerprint(
    instanceName: string,
    fingerprint?: DeviceFingerprint,
    options?: {
      method?: 'auto' | 'ldconsole' | 'adb';
      requireRestart?: boolean;
    }
  ): Promise<DeviceFingerprint> {
    const { method = 'auto', requireRestart = false } = options || {};

    try {
      // Generate fingerprint if not provided
      const fp = fingerprint || FingerprintGenerator.generateFingerprint();

      logger.info(`Applying fingerprint to instance ${instanceName}...`);
      logger.info(`  Device: ${fp.brand} ${fp.model}`);
      logger.info(`  IMEI: ${fp.imei}`);
      logger.info(`  Android ID: ${fp.androidId}`);

      // Check if instance exists
      const instance = this.controller.getInstance(instanceName);
      if (!instance) {
        throw new Error(`Instance ${instanceName} not found`);
      }

      // Determine method
      let useMethod = method;
      if (method === 'auto') {
        // Use LDConsole if instance is stopped, ADB if running
        useMethod = instance.status === 'running' ? 'adb' : 'ldconsole';
        logger.info(`Auto-selected method: ${useMethod}`);
      }

      // Apply fingerprint using selected method
      if (useMethod === 'ldconsole') {
        await this.applyViaLDConsole(instanceName, fp);
      } else {
        await this.applyViaADB(instanceName, fp);
      }

      // Cache fingerprint
      this.fingerprintCache.set(instanceName, fp);

      // Restart if required
      if (requireRestart && instance.status === 'running') {
        logger.info(`Restarting instance ${instanceName} to apply changes...`);
        await this.controller.restartInstance(instanceName);
      }

      logger.info(`✅ Fingerprint applied successfully to ${instanceName}`);
      return fp;

    } catch (error) {
      logger.error(`Failed to apply fingerprint to ${instanceName}:`, error);
      throw error;
    }
  }

  /**
   * Apply fingerprint via LDConsole (recommended - không cần instance running)
   */
  private async applyViaLDConsole(instanceName: string, fp: DeviceFingerprint): Promise<void> {
    try {
      logger.info(`[LDCONSOLE] Applying fingerprint via LDConsole...`);

      // IMEI
      await this.execLDConsole(`modify --name "${instanceName}" --imei "${fp.imei}"`);

      // Phone number (if available)
      if (fp.phoneNumber) {
        await this.execLDConsole(`modify --name "${instanceName}" --pnumber "${fp.phoneNumber}"`);
      }

      // Android ID
      await this.execLDConsole(`modify --name "${instanceName}" --androidid "${fp.androidId}"`);

      // Device model
      await this.execLDConsole(`modify --name "${instanceName}" --model "${fp.model}"`);

      // Manufacturer
      await this.execLDConsole(`modify --name "${instanceName}" --manufacturer "${fp.manufacturer}"`);

      // MAC Address
      await this.execLDConsole(`modify --name "${instanceName}" --macaddress "${fp.macAddress}"`);

      logger.info(`[LDCONSOLE] ✅ Fingerprint applied via LDConsole`);

    } catch (error) {
      logger.error(`[LDCONSOLE] Failed to apply fingerprint:`, error);
      throw error;
    }
  }

  /**
   * Apply fingerprint via ADB (fallback - requires running instance)
   */
  private async applyViaADB(instanceName: string, fp: DeviceFingerprint): Promise<void> {
    try {
      logger.info(`[ADB] Applying fingerprint via ADB...`);

      const instance = this.controller.getInstance(instanceName);
      if (!instance) {
        throw new Error(`Instance ${instanceName} not found`);
      }

      if (instance.status !== 'running') {
        throw new Error(`Instance ${instanceName} is not running. Use ldconsole method instead.`);
      }

      const port = instance.port;

      // Set properties via ADB shell
      await this.execADBShell(port, `setprop gsm.device.imei ${fp.imei}`);
      await this.execADBShell(port, `settings put secure android_id ${fp.androidId}`);
      await this.execADBShell(port, `setprop ro.product.model ${fp.model}`);
      await this.execADBShell(port, `setprop ro.product.manufacturer ${fp.manufacturer}`);
      await this.execADBShell(port, `setprop ro.product.brand ${fp.brand}`);
      await this.execADBShell(port, `setprop ro.product.device ${fp.device}`);
      await this.execADBShell(port, `setprop ro.serialno ${fp.serialNumber}`);
      await this.execADBShell(port, `setprop ro.build.id ${fp.buildId}`);
      await this.execADBShell(port, `setprop ro.build.display.id ${fp.buildDisplay}`);

      // SIM serial
      if (fp.simSerial) {
        await this.execADBShell(port, `setprop gsm.sim.serial ${fp.simSerial}`);
      }

      // Set REAL resolution to system properties (for app detection)
      // LDPlayer window will still be small (360x640), but apps will see real resolution
      if (fp.realResolution && fp.realDpi) {
        const [width, height] = fp.realResolution.split('x');
        logger.info(`[ADB] Setting real resolution: ${fp.realResolution} @ ${fp.realDpi}dpi (anti-detect)`);

        // Override display metrics that apps read
        await this.execADBShell(port, `wm size ${width}x${height}`);
        await this.execADBShell(port, `wm density ${fp.realDpi}`);

        // Also set system properties for extra coverage
        await this.execADBShell(port, `setprop ro.sf.lcd_density ${fp.realDpi}`);
      }

      logger.info(`[ADB] ✅ Fingerprint applied via ADB`);

    } catch (error) {
      logger.error(`[ADB] Failed to apply fingerprint:`, error);
      throw error;
    }
  }

  /**
   * Apply fingerprint to multiple instances (batch operation)
   */
  async applyFingerprintBatch(
    instanceNames: string[],
    options?: {
      useSameBrand?: boolean;
      brand?: string;
      method?: 'auto' | 'ldconsole' | 'adb';
    }
  ): Promise<Map<string, DeviceFingerprint>> {
    const { useSameBrand = false, brand, method = 'auto' } = options || {};
    const results = new Map<string, DeviceFingerprint>();

    logger.info(`Applying fingerprints to ${instanceNames.length} instances...`);

    for (const instanceName of instanceNames) {
      try {
        // Generate fingerprint
        const fp = useSameBrand && brand
          ? FingerprintGenerator.generateFingerprint({ brand })
          : FingerprintGenerator.generateFingerprint();

        // Apply
        await this.applyFingerprint(instanceName, fp, { method });
        results.set(instanceName, fp);

        // Delay between applications
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.error(`Failed to apply fingerprint to ${instanceName}:`, error);
      }
    }

    logger.info(`✅ Applied fingerprints to ${results.size}/${instanceNames.length} instances`);
    return results;
  }

  /**
   * Get current fingerprint from instance (read from device)
   */
  async getCurrentFingerprint(instanceName: string): Promise<Partial<DeviceFingerprint>> {
    try {
      const instance = this.controller.getInstance(instanceName);
      if (!instance) {
        throw new Error(`Instance ${instanceName} not found`);
      }

      if (instance.status !== 'running') {
        // Return cached fingerprint if available
        const cached = this.fingerprintCache.get(instanceName);
        if (cached) {
          logger.info(`Returning cached fingerprint for ${instanceName}`);
          return cached;
        }
        throw new Error(`Instance ${instanceName} is not running. Cannot read current fingerprint.`);
      }

      const port = instance.port;

      // Read properties from device
      const imei = await this.readADBProperty(port, 'gsm.device.imei');
      const androidId = await this.readADBProperty(port, 'settings get secure android_id');
      const model = await this.readADBProperty(port, 'ro.product.model');
      const manufacturer = await this.readADBProperty(port, 'ro.product.manufacturer');
      const brand = await this.readADBProperty(port, 'ro.product.brand');
      const device = await this.readADBProperty(port, 'ro.product.device');
      const serialNumber = await this.readADBProperty(port, 'ro.serialno');
      const buildId = await this.readADBProperty(port, 'ro.build.id');

      const fingerprint: Partial<DeviceFingerprint> = {
        imei,
        androidId,
        model,
        manufacturer,
        brand,
        device,
        serialNumber,
        buildId
      };

      logger.info(`Read current fingerprint from ${instanceName}`);
      return fingerprint;

    } catch (error) {
      logger.error(`Failed to read fingerprint from ${instanceName}:`, error);
      throw error;
    }
  }

  /**
   * Verify fingerprint has been applied correctly
   */
  async verifyFingerprint(instanceName: string, expectedFingerprint: DeviceFingerprint): Promise<boolean> {
    try {
      const current = await this.getCurrentFingerprint(instanceName);

      const checks = {
        imei: current.imei === expectedFingerprint.imei,
        androidId: current.androidId === expectedFingerprint.androidId,
        model: current.model === expectedFingerprint.model,
        manufacturer: current.manufacturer === expectedFingerprint.manufacturer
      };

      const allMatch = Object.values(checks).every(v => v);

      if (allMatch) {
        logger.info(`✅ Fingerprint verified for ${instanceName}`);
      } else {
        logger.warn(`⚠️ Fingerprint mismatch for ${instanceName}:`, checks);
      }

      return allMatch;

    } catch (error) {
      logger.error(`Failed to verify fingerprint for ${instanceName}:`, error);
      return false;
    }
  }

  /**
   * Get cached fingerprint
   */
  getCachedFingerprint(instanceName: string): DeviceFingerprint | undefined {
    return this.fingerprintCache.get(instanceName);
  }

  /**
   * Clear fingerprint cache
   */
  clearCache(instanceName?: string): void {
    if (instanceName) {
      this.fingerprintCache.delete(instanceName);
      logger.info(`Cleared fingerprint cache for ${instanceName}`);
    } else {
      this.fingerprintCache.clear();
      logger.info('Cleared all fingerprint cache');
    }
  }

  /**
   * Export fingerprint to JSON
   */
  exportFingerprint(instanceName: string): string {
    const fp = this.fingerprintCache.get(instanceName);
    if (!fp) {
      throw new Error(`No cached fingerprint for ${instanceName}`);
    }
    return JSON.stringify(fp, null, 2);
  }

  /**
   * Import fingerprint from JSON
   */
  async importFingerprint(instanceName: string, fingerprintJson: string): Promise<void> {
    try {
      const fp: DeviceFingerprint = JSON.parse(fingerprintJson);
      await this.applyFingerprint(instanceName, fp);
      logger.info(`Imported and applied fingerprint to ${instanceName}`);
    } catch (error) {
      logger.error(`Failed to import fingerprint for ${instanceName}:`, error);
      throw error;
    }
  }

  // ========== Helper Methods ==========

  /**
   * Execute LDConsole command
   */
  private async execLDConsole(command: string): Promise<string> {
    try {
      const fullCommand = `"${this.ldConsolePath}" ${command}`;
      logger.debug(`Executing: ${fullCommand}`);
      const result = await execAsync(fullCommand);
      return result.stdout;
    } catch (error: any) {
      // LDConsole sometimes returns exit code but still succeeds
      logger.debug(`LDConsole command warning:`, error.message);
      return error.stdout || '';
    }
  }

  /**
   * Execute ADB shell command
   */
  private async execADBShell(port: number, command: string): Promise<string> {
    try {
      const fullCommand = `"${this.adbPath}" -s 127.0.0.1:${port} shell ${command}`;
      logger.debug(`Executing: ${fullCommand}`);
      const result = await execAsync(fullCommand);
      return result.stdout.trim();
    } catch (error: any) {
      logger.error(`ADB shell command failed:`, error);
      throw error;
    }
  }

  /**
   * Read ADB property value
   */
  private async readADBProperty(port: number, property: string): Promise<string> {
    try {
      // Check if it's a settings command
      if (property.startsWith('settings ')) {
        return await this.execADBShell(port, property);
      }

      // Otherwise use getprop
      return await this.execADBShell(port, `getprop ${property}`);
    } catch (error) {
      logger.debug(`Failed to read property ${property}:`, error);
      return '';
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalCached: this.fingerprintCache.size,
      cachedInstances: Array.from(this.fingerprintCache.keys()),
      availableBrands: FingerprintGenerator.getAvailableBrands(),
      totalDeviceTemplates: FingerprintGenerator.getAllDeviceTemplates().length
    };
  }
}

export default FingerprintService;
