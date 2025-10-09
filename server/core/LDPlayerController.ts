import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { ProxyConfig, formatProxyForLDPlayer } from '../types/proxy.js';

const execAsync = promisify(exec);

export interface LDPlayerInstance {
  name: string;
  index: number;
  port: number;
  status: 'running' | 'stopped' | 'unknown';
  pid?: number;
}

export interface DeviceInfo {
  imei: string;
  androidId: string;
  model: string;
  manufacturer: string;
  brand: string;
}

export class LDPlayerController {
  private ldConsolePath: string;
  private adbPath: string;
  private instances: Map<string, LDPlayerInstance> = new Map();

  constructor() {
    this.ldConsolePath = process.env.LDCONSOLE_PATH || 'D:\\LDPlayer\\LDPlayer9\\ldconsole.exe';
    this.adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';

    logger.info(`LDPlayerController initialized with:`);
    logger.info(`  ldconsole: ${this.ldConsolePath}`);
    logger.info(`  adb: ${this.adbPath}`);

    // Auto-enable ADB debugging for all instances on startup
    this.enableADBForAllInstances().catch(err => {
      logger.warn('Failed to auto-enable ADB debugging:', err);
    });
  }

  /**
   * Enable ADB debugging for all LDPlayer instances
   */
  private async enableADBForAllInstances(): Promise<void> {
    try {
      const listResult = await execAsync(`"${this.ldConsolePath}" list`);
      const lines = listResult.stdout.trim().split('\n');

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const name = parts[1];

          // Skip invalid instances
          if (!name || name === 'Instance_NaN' || name.trim() === '') {
            continue;
          }

          try {
            // Enable ADB debugging
            await execAsync(`"${this.ldConsolePath}" setprop --name "${name}" --key "adb.debug" --value "1"`);
            logger.debug(`Enabled ADB debugging for instance: ${name}`);
          } catch (error) {
            logger.debug(`Failed to enable ADB for ${name}:`, error);
          }
        }
      }

      logger.info('ADB debugging enabled for all instances');

      // Auto-connect to all running instances
      await this.connectAllRunningInstances();
    } catch (error) {
      logger.error('Failed to enable ADB debugging for all instances:', error);
    }
  }

  /**
   * Connect ADB to all running instances
   */
  async connectAllRunningInstances(): Promise<void> {
    try {
      // Get list of ADB devices
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const lines = devicesResult.stdout.trim().split('\n');

      const connectedPorts = new Set<number>();
      for (const line of lines) {
        const emulatorMatch = line.match(/emulator-(\d+)\s+device/);
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
        if (emulatorMatch || ipMatch) {
          const port = parseInt((emulatorMatch || ipMatch)![1], 10);
          connectedPorts.add(port);
        }
      }

      // Get running instances from ldconsole
      const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`).catch(() => ({ stdout: '' }));
      const runningInstances = runningListResult.stdout.trim().split('\n').filter((line: string) => line.length > 0);

      // Try common ports for running instances
      const portsToTry = [5555, 5557, 5559, 5561, 5563, 5565, 5567, 5569, 5571, 5573, 5575, 5577, 5579, 5581];

      for (const port of portsToTry) {
        if (!connectedPorts.has(port) && runningInstances.length > 0) {
          try {
            await Promise.race([
              execAsync(`"${this.adbPath}" connect 127.0.0.1:${port}`),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            logger.debug(`Connected ADB to port ${port}`);
          } catch (error) {
            // Port not available, skip
          }
        }
      }

      logger.info('Auto-connected to all running instances');
    } catch (error) {
      logger.debug('Failed to auto-connect to running instances:', error);
    }
  }

  // Instance Management
  async createInstance(name: string, config?: {
    resolution?: string;
    dpi?: number;
    cpu?: number;
    memory?: number;
  }): Promise<LDPlayerInstance> {
    try {
      // Create new instance
      try {
        await execAsync(`"${this.ldConsolePath}" add --name "${name}"`);
      } catch (createError: any) {
        // Instance creation might fail with exit code 6 but still create the instance
        // Check if instance exists
        const listResult = await execAsync(`"${this.ldConsolePath}" list`);
        if (!listResult.stdout.includes(name)) {
          throw createError;
        }
        logger.warn(`Instance ${name} created with warning (exit code: ${createError.code})`);
      }

      // Configure instance - always try to modify even if create had warnings
      if (config) {
        const modifyCommands = [];
        if (config.resolution) {
          modifyCommands.push(`--resolution ${config.resolution}`);
        }
        if (config.dpi) {
          modifyCommands.push(`--dpi ${config.dpi}`);
        }
        if (config.cpu) {
          modifyCommands.push(`--cpu ${config.cpu}`);
        }
        if (config.memory) {
          modifyCommands.push(`--memory ${config.memory}`);
        }

        if (modifyCommands.length > 0) {
          try {
            await execAsync(`"${this.ldConsolePath}" modify --name "${name}" ${modifyCommands.join(' ')}`);
          } catch (modifyError) {
            logger.warn(`Failed to modify instance settings, using defaults`);
          }
        }
      }

      // Get instance index from ldconsole list
      const listResult = await execAsync(`"${this.ldConsolePath}" list`);
      const lines = listResult.stdout.trim().split('\n');
      let instanceIndex = 0;

      for (const line of lines) {
        const parts = line.split(',');
        if (parts[1] === name) {
          instanceIndex = parseInt(parts[0], 10);
          break;
        }
      }

      const instance: LDPlayerInstance = {
        name,
        index: instanceIndex,
        port: 5555 + instanceIndex * 2,
        status: 'stopped'
      };

      this.instances.set(name, instance);
      logger.info(`Created LDPlayer instance: ${name} (index: ${instanceIndex}, port: ${instance.port})`);

      return instance;
    } catch (error) {
      logger.error(`Failed to create instance ${name}:`, error);
      throw error;
    }
  }

  async launchInstance(name: string): Promise<void> {
    try {
      await execAsync(`"${this.ldConsolePath}" launch --name "${name}"`);

      const instance = this.instances.get(name);
      if (instance) {
        instance.status = 'running';

        // Wait for instance to be ready
        await this.waitForDevice(instance.port);

        // Connect ADB
        await this.connectADB(instance.port);
      }

      logger.info(`Launched instance: ${name}`);
    } catch (error) {
      logger.error(`Failed to launch instance ${name}:`, error);
      throw error;
    }
  }

  async stopInstance(name: string): Promise<void> {
    try {
      await execAsync(`"${this.ldConsolePath}" quit --name "${name}"`);

      const instance = this.instances.get(name);
      if (instance) {
        instance.status = 'stopped';
      }

      logger.info(`Stopped instance: ${name}`);
    } catch (error) {
      logger.error(`Failed to stop instance ${name}:`, error);
      throw error;
    }
  }

  async removeInstance(name: string): Promise<void> {
    try {
      await this.stopInstance(name);
      await execAsync(`"${this.ldConsolePath}" remove --name "${name}"`);

      this.instances.delete(name);
      logger.info(`Removed instance: ${name}`);
    } catch (error) {
      logger.error(`Failed to remove instance ${name}:`, error);
      throw error;
    }
  }

  async cloneInstance(sourceName: string, targetName: string): Promise<LDPlayerInstance> {
    try {
      // Check if target instance already exists (error code 19 = instance name exists)
      const listResult = await execAsync(`"${this.ldConsolePath}" list`);
      const existingInstances = listResult.stdout.trim().split('\n');
      const targetExists = existingInstances.some(line => {
        const parts = line.split(',');
        return parts[1] === targetName;
      });

      if (targetExists) {
        logger.warn(`Target instance ${targetName} already exists, removing it first...`);
        try {
          await this.removeInstance(targetName);
          // Wait for removal to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (removeErr) {
          logger.error(`Failed to remove existing instance ${targetName}:`, removeErr);
          throw new Error(`Instance name "${targetName}" already exists and could not be removed`);
        }
      }

      // Check if source instance is running
      let wasRunning = false;
      try {
        const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`);
        wasRunning = runningListResult.stdout.includes(sourceName);
      } catch (err) {
        logger.warn('Failed to check running instances, assuming instance is stopped');
      }

      // Stop source instance if it's running (ldconsole copy requires instance to be stopped)
      if (wasRunning) {
        logger.info(`Source instance ${sourceName} is running, stopping it temporarily for cloning...`);
        await this.stopInstance(sourceName);
        // Wait a bit for instance to fully stop
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Perform the clone
      // Note: ldconsole copy may return non-zero exit code even when successful
      try {
        await execAsync(`"${this.ldConsolePath}" copy --name "${targetName}" --from "${sourceName}"`);
      } catch (copyError: any) {
        // Check if instance was actually created despite error code
        logger.warn(`Copy command returned error code ${copyError.code}, checking if instance was created...`);
      }

      // Restart source instance if it was running
      if (wasRunning) {
        logger.info(`Restarting source instance ${sourceName}...`);
        await this.launchInstance(sourceName);
      }

      // Get the actual index from ldconsole list and verify clone succeeded
      const newListResult = await execAsync(`"${this.ldConsolePath}" list`);
      const lines = newListResult.stdout.trim().split('\n');
      let instanceIndex = -1;

      for (const line of lines) {
        const parts = line.split(',');
        if (parts[1] === targetName) {
          instanceIndex = parseInt(parts[0], 10);
          break;
        }
      }

      // Verify instance was created
      if (instanceIndex === -1) {
        throw new Error(`Failed to clone instance: ${targetName} not found in instance list after copy operation`);
      }

      // Register the cloned instance
      const clonedInstance: LDPlayerInstance = {
        name: targetName,
        index: instanceIndex,
        port: 5555 + instanceIndex * 2,
        status: 'stopped'
      };
      this.instances.set(targetName, clonedInstance);

      logger.info(`Successfully cloned instance ${sourceName} to ${targetName} (index: ${instanceIndex})`);
      return clonedInstance;
    } catch (error) {
      logger.error(`Failed to clone instance from ${sourceName} to ${targetName}:`, error);
      throw error;
    }
  }

  /**
   * Get ADB port for instance by name
   * ALWAYS call this before ADB operations to get fresh port!
   *
   * Strategy:
   * 1. Check if instance is running
   * 2. Enable ADB if not enabled
   * 3. Try to find port from adb devices
   * 4. If not found, try common ports and test connection
   */
  async getAdbPortForInstance(instanceName: string): Promise<number> {
    try {
      logger.info(`Getting ADB port for instance: ${instanceName}`);

      // Check if instance is running
      const runningResult = await execAsync(`"${this.ldConsolePath}" runninglist`);
      const runningInstances = runningResult.stdout.trim().split('\n');
      const isRunning = runningInstances.includes(instanceName);

      if (!isRunning) {
        throw new Error(`Instance ${instanceName} is not running. Please start it first.`);
      }

      // Ensure ADB is enabled
      logger.info(`Ensuring ADB is enabled for ${instanceName}...`);
      try {
        await execAsync(
          `"${this.ldConsolePath}" setprop --name "${instanceName}" --key "adb.debug" --value "1"`
        );
        logger.info(`✅ ADB enabled for ${instanceName}`);
      } catch (enableError) {
        logger.warn(`Warning: Could not enable ADB: ${enableError}`);
      }

      // Get list of connected ADB devices
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const deviceLines = devicesResult.stdout.trim().split('\n');

      // Parse device ports
      const connectedPorts: number[] = [];
      for (const line of deviceLines) {
        // Match both "127.0.0.1:5572" and "emulator-5572"
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)/);
        const emulatorMatch = line.match(/emulator-(\d+)/);

        if (ipMatch) {
          connectedPorts.push(parseInt(ipMatch[1], 10));
        } else if (emulatorMatch) {
          connectedPorts.push(parseInt(emulatorMatch[1], 10));
        }
      }

      logger.info(`Found ${connectedPorts.length} connected ADB devices: ${connectedPorts.join(', ')}`);

      // If we have connected ports, try to identify which one belongs to our instance
      if (connectedPorts.length === 1) {
        // Only one device, it must be ours
        const port = connectedPorts[0];
        logger.info(`✅ Using port ${port} (only device connected)`);
        return port;
      }

      // Try to connect to common ports and test
      const portsToTry = [5555, 5557, 5559, 5561, 5563, 5565, 5567, 5569, 5571, 5573, 5575];

      for (const port of portsToTry) {
        try {
          // Try to connect
          await execAsync(`"${this.adbPath}" connect 127.0.0.1:${port}`);

          // Test connection by running a simple command
          const testResult = await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell getprop ro.product.model`);

          if (testResult.stdout.trim()) {
            logger.info(`✅ Successfully connected to port ${port}`);
            return port;
          }
        } catch (error) {
          // Port not available, try next
          continue;
        }
      }

      // If all fails, return the first connected port
      if (connectedPorts.length > 0) {
        const port = connectedPorts[0];
        logger.warn(`Using first available port ${port} as fallback`);
        return port;
      }

      throw new Error(`Could not determine ADB port for ${instanceName}. No devices found.`);

    } catch (error: any) {
      logger.error(`Failed to get ADB port for ${instanceName}:`, error.message);
      throw new Error(`Cannot get ADB port for ${instanceName}: ${error.message}`);
    }
  }

  // ADB Operations
  async connectADB(port: number): Promise<void> {
    try {
      logger.info(`Connecting ADB to 127.0.0.1:${port} using ${this.adbPath}`);
      const result = await execAsync(`"${this.adbPath}" connect 127.0.0.1:${port}`);
      logger.info(`✅ ADB connected to port ${port}: ${result.stdout.trim()}`);
    } catch (error) {
      logger.error(`Failed to connect ADB to port ${port}:`, error);
      throw error;
    }
  }

  /**
   * Resolve actual ADB serial after connecting
   * Priority: 127.0.0.1:port with "device" status, then emulator-* with "device" status
   *
   * @param port - The port that was connected
   * @returns The actual serial to use for ADB commands
   */
  async resolveAdbSerial(port: number): Promise<string> {
    try {
      logger.info(`Resolving ADB serial for port ${port}...`);

      // Read adb devices after connection
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const deviceLines = devicesResult.stdout.trim().split('\n').slice(1); // Skip header

      const devices: Array<{ serial: string; state: string }> = [];

      for (const line of deviceLines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          devices.push({
            serial: parts[0],
            state: parts[1]
          });
        }
      }

      logger.info(`Found ${devices.length} ADB devices: ${JSON.stringify(devices)}`);

      // Priority 1: Find 127.0.0.1:port with state "device"
      const ipSerial = devices.find(d =>
        d.serial === `127.0.0.1:${port}` && d.state === 'device'
      );

      if (ipSerial) {
        logger.info(`✅ Using serial: ${ipSerial.serial} (IP format)`);
        return ipSerial.serial;
      }

      // Priority 2: Find emulator-{port} with state "device"
      const emulatorSerial = devices.find(d =>
        d.serial === `emulator-${port}` && d.state === 'device'
      );

      if (emulatorSerial) {
        logger.info(`✅ Using serial: ${emulatorSerial.serial} (emulator format)`);
        return emulatorSerial.serial;
      }

      // Priority 3: Any device with matching port
      const anyMatchingSerial = devices.find(d =>
        (d.serial.includes(`:${port}`) || d.serial.includes(`-${port}`)) &&
        d.state === 'device'
      );

      if (anyMatchingSerial) {
        logger.info(`✅ Using serial: ${anyMatchingSerial.serial} (matched port)`);
        return anyMatchingSerial.serial;
      }

      // Fallback: Use the first available device
      if (devices.length > 0 && devices[0].state === 'device') {
        logger.warn(`⚠️ No exact match, using first device: ${devices[0].serial}`);
        return devices[0].serial;
      }

      throw new Error(`No device found in "device" state for port ${port}`);

    } catch (error: any) {
      logger.error(`Failed to resolve ADB serial for port ${port}:`, error.message);
      throw error;
    }
  }

  /**
   * Wait for device to be fully ready
   * 1. wait-for-device
   * 2. Poll sys.boot_completed == 1
   * 3. (Optional) Test with pm list packages
   *
   * @param serial - ADB device serial
   * @param timeoutMs - Maximum wait time in milliseconds (default: 60000)
   */
  async waitForDeviceReady(serial: string, timeoutMs: number = 60000): Promise<void> {
    try {
      logger.info(`⏳ Waiting for device ${serial} to be ready...`);
      const startTime = Date.now();

      // Step 1: wait-for-device
      logger.info(`Step 1: Running wait-for-device...`);
      try {
        await Promise.race([
          execAsync(`"${this.adbPath}" -s ${serial} wait-for-device`),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('wait-for-device timeout')), 30000)
          )
        ]);
        logger.info(`✅ wait-for-device completed`);
      } catch (error) {
        logger.warn(`⚠️ wait-for-device timeout, continuing anyway...`);
      }

      // Step 2: Poll sys.boot_completed
      logger.info(`Step 2: Polling sys.boot_completed...`);
      let bootCompleted = false;
      let pollAttempts = 0;
      const maxPollAttempts = 60; // 60 attempts * 1s = 60s max

      while (!bootCompleted && pollAttempts < maxPollAttempts) {
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) {
          throw new Error(`Device not ready after ${timeoutMs}ms`);
        }

        try {
          const result = await execAsync(
            `"${this.adbPath}" -s ${serial} shell getprop sys.boot_completed`
          );
          const value = result.stdout.trim();

          if (value === '1') {
            bootCompleted = true;
            logger.info(`✅ sys.boot_completed = 1`);
            break;
          }

          logger.debug(`sys.boot_completed = "${value}", waiting... (attempt ${pollAttempts + 1})`);
        } catch (error) {
          logger.debug(`Failed to get boot_completed, retrying... (attempt ${pollAttempts + 1})`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between polls
        pollAttempts++;
      }

      if (!bootCompleted) {
        logger.warn(`⚠️ sys.boot_completed never reached 1, but continuing...`);
      }

      // Step 3: Test with pm list packages (optional)
      logger.info(`Step 3: Testing with pm list packages...`);
      try {
        const pmResult = await Promise.race([
          execAsync(`"${this.adbPath}" -s ${serial} shell pm list packages -3 | head -n 5`),
          new Promise<{ stdout: string; stderr: string }>((_, reject) =>
            setTimeout(() => reject(new Error('pm timeout')), 5000)
          )
        ]);

        if (pmResult.stdout.trim().length > 0) {
          logger.info(`✅ pm list packages is working`);
        } else {
          logger.warn(`⚠️ pm list packages returned empty, but device might be ready`);
        }
      } catch (error) {
        logger.warn(`⚠️ pm list packages test failed, but device might be ready`);
      }

      const totalTime = Date.now() - startTime;
      logger.info(`✅ Device ${serial} is ready! (took ${totalTime}ms)`);

    } catch (error: any) {
      logger.error(`Failed to wait for device ${serial}:`, error.message);
      throw error;
    }
  }

  async disconnectADB(port: number): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" disconnect 127.0.0.1:${port}`);
      logger.info(`ADB disconnected from port ${port}`);
    } catch (error) {
      logger.error(`Failed to disconnect ADB from port ${port}:`, error);
    }
  }

  private async waitForDevice(port: number, timeout: number = 90000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell getprop sys.boot_completed`);
        if (result.stdout.trim() === '1') {
          logger.info(`Device on port ${port} is ready`);
          return;
        }
      } catch (error) {
        // Device not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Device on port ${port} did not become ready within ${timeout}ms`);
  }

  // Device Actions
  // Generic ADB command executor for custom commands
  async executeAdbCommand(portOrSerial: number | string, command: string): Promise<string> {
    try {
      // First check if device is connected
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      let deviceId: string;

      // Support both port (number) and serial (string)
      if (typeof portOrSerial === 'number') {
        deviceId = `127.0.0.1:${portOrSerial}`;
      } else {
        deviceId = portOrSerial;
      }

      // If device not found, try to find any connected device
      if (!devicesResult.stdout.includes(deviceId)) {
        // Parse all connected devices
        const lines = devicesResult.stdout.trim().split('\n');
        for (const line of lines) {
          const emulatorMatch = line.match(/emulator-(\d+)\s+device/);
          const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
          if (emulatorMatch) {
            deviceId = emulatorMatch[0].split(/\s+/)[0];
            logger.info(`Using connected device ${deviceId} instead of ${portOrSerial}`);
            break;
          } else if (ipMatch) {
            deviceId = ipMatch[0].split(/\s+/)[0];
            logger.info(`Using connected device ${deviceId} instead of ${portOrSerial}`);
            break;
          }
        }

        // If still not found, try to connect (only for IP format)
        if (!devicesResult.stdout.includes(deviceId) && typeof portOrSerial === 'number') {
          logger.info(`Device ${deviceId} not connected, attempting to connect...`);
          try {
            await execAsync(`"${this.adbPath}" connect ${deviceId}`);
            // Wait a bit for connection
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (connectError) {
            logger.error(`Failed to connect to ${deviceId}:`, connectError);
            throw new Error(`ADB device ${deviceId} not available. Make sure the instance is running and ADB debugging is enabled.`);
          }
        }
      }

      const result = await execAsync(`"${this.adbPath}" -s ${deviceId} ${command}`);
      logger.debug(`Executed ADB command on ${deviceId}: ${command}`);
      return result.stdout;
    } catch (error: any) {
      logger.error(`Failed to execute ADB command on ${portOrSerial}:`, error);
      throw new Error(`ADB command failed: ${error.message || error.stderr || 'Unknown error'}`);
    }
  }

  async tap(portOrSerial: number | string, x: number, y: number): Promise<void> {
    await this.executeAdbCommand(portOrSerial, `shell input tap ${x} ${y}`);
    logger.debug(`Tapped at (${x}, ${y}) on ${portOrSerial}`);
  }

  async swipe(portOrSerial: number | string, x1: number, y1: number, x2: number, y2: number, duration: number = 500): Promise<void> {
    await this.executeAdbCommand(portOrSerial, `shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
    logger.debug(`Swiped from (${x1}, ${y1}) to (${x2}, ${y2}) on ${portOrSerial}`);
  }

  async inputText(portOrSerial: number | string, text: string): Promise<void> {
    // Escape special characters for shell
    const escapedText = text.replace(/([\\'"` ])/g, '\\$1');
    await this.executeAdbCommand(portOrSerial, `shell input text "${escapedText}"`);
    logger.debug(`Input text on ${portOrSerial}: ${text}`);
  }

  async pressKey(portOrSerial: number | string, keyCode: string): Promise<void> {
    await this.executeAdbCommand(portOrSerial, `shell input keyevent ${keyCode}`);
    logger.debug(`Pressed key ${keyCode} on ${portOrSerial}`);
  }

  async screenshot(portOrSerial: number | string, savePath: string): Promise<void> {
    const tempPath = '/sdcard/screenshot.png';
    await this.executeAdbCommand(portOrSerial, `shell screencap -p ${tempPath}`);
    await this.executeAdbCommand(portOrSerial, `pull ${tempPath} "${savePath}"`);
    await this.executeAdbCommand(portOrSerial, `shell rm ${tempPath}`);
    logger.debug(`Screenshot saved to ${savePath} from ${portOrSerial}`);
  }

  // App Management
  async installAPK(port: number, apkPath: string): Promise<void> {
    await this.executeAdbCommand(port, `install -r "${apkPath}"`);
    logger.info(`Installed APK ${apkPath} on port ${port}`);
  }

  async launchApp(port: number, packageName: string, activityName?: string): Promise<void> {
    const activity = activityName || '.MainActivity';
    await this.executeAdbCommand(port, `shell am start -n ${packageName}/${packageName}${activity}`);
    logger.info(`Launched app ${packageName} on port ${port}`);
  }

  async closeApp(port: number, packageName: string): Promise<void> {
    await this.executeAdbCommand(port, `shell am force-stop ${packageName}`);
    logger.info(`Closed app ${packageName} on port ${port}`);
  }

  async isAppInstalled(port: number, packageName: string): Promise<boolean> {
    try {
      const result = await this.executeAdbCommand(port, `shell pm list packages ${packageName}`);
      return result.includes(packageName);
    } catch (error) {
      logger.debug(`Error checking if app ${packageName} is installed:`, error);
      return false;
    }
  }

  /**
   * Get all installed apps (third-party only, exclude system apps)
   */
  async getInstalledApps(port: number): Promise<{ packageName: string; appName: string }[]> {
    try {
      // List all third-party packages (exclude system apps)
      const result = await this.executeAdbCommand(port, `shell pm list packages -3`);

      const packages = result
        .split('\n')
        .filter((line: string) => line.startsWith('package:'))
        .map((line: string) => line.replace('package:', '').trim())
        .filter((pkg: string) => pkg.length > 0);

      // Get app names for each package
      const apps = [];

      // Common app name mappings
      const appMappings: Record<string, string> = {
        'com.twitter.android': 'X (Twitter)',
        'com.instagram.android': 'Instagram',
        'com.facebook.katana': 'Facebook',
        'com.zhiliaoapp.musically': 'TikTok',
        'org.telegram.messenger': 'Telegram',
        'com.whatsapp': 'WhatsApp',
        'com.snapchat.android': 'Snapchat',
        'com.linkedin.android': 'LinkedIn',
        'com.reddit.frontpage': 'Reddit',
        'com.discord': 'Discord',
        'com.google.android.youtube': 'YouTube',
        'com.spotify.music': 'Spotify'
      };

      for (const packageName of packages) {
        let appName = packageName;

        if (appMappings[packageName]) {
          appName = appMappings[packageName];
        } else {
          // Extract readable name from package
          const parts = packageName.split('.');
          appName = parts[parts.length - 1]
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        }

        apps.push({
          packageName,
          appName
        });
      }

      logger.info(`Found ${apps.length} installed apps on port ${port}`);
      return apps;

    } catch (error) {
      logger.error(`Failed to get installed apps on port ${port}:`, error);
      return [];
    }
  }

  /**
   * Get all installed apps by instance name
   */
  async getInstalledAppsByInstance(instanceName: string): Promise<{ packageName: string; appName: string }[]> {
    const instance = this.getInstance(instanceName);
    if (!instance) {
      throw new Error(`Instance ${instanceName} not found`);
    }
    return this.getInstalledApps(instance.port);
  }

  /**
   * Check multiple apps installation status
   */
  async checkAppsInstalled(port: number, packageNames: string[]): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};

    for (const packageName of packageNames) {
      result[packageName] = await this.isAppInstalled(port, packageName);
    }

    return result;
  }

  // Device Configuration
  /**
   * Set proxy cho instance (simple mode - chỉ HTTP, không auth)
   * @deprecated Use setProxyAdvanced() for full proxy support with auth
   */
  async setProxy(port: number, proxyHost: string, proxyPort: number): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell settings put global http_proxy ${proxyHost}:${proxyPort}`);
      logger.info(`Set proxy ${proxyHost}:${proxyPort} on port ${port}`);
    } catch (error) {
      logger.error(`Failed to set proxy on port ${port}:`, error);
      throw error;
    }
  }

  /**
   * Set proxy với full config (HTTP/SOCKS, với authentication)
   * Sử dụng ldconsole để config proxy với auth support
   */
  async setProxyAdvanced(instanceName: string, proxy: ProxyConfig): Promise<void> {
    try {
      const instance = this.getInstance(instanceName);
      if (!instance) {
        throw new Error(`Instance ${instanceName} not found`);
      }

      // LDConsole proxy command format:
      // ldconsole setprop --name <name> --key net.proxy --value "type://[user:pass@]host:port"
      const proxyString = formatProxyForLDPlayer(proxy);

      // Method 1: Try ldconsole setprop (if supported by LDPlayer version)
      try {
        await execAsync(`"${this.ldConsolePath}" setprop --name "${instanceName}" --key "net.proxy" --value "${proxyString}"`);
        logger.info(`Set advanced proxy via ldconsole for ${instanceName}: ${proxy.type}://${proxy.host}:${proxy.port}`);
        return;
      } catch (ldError) {
        logger.warn(`ldconsole setprop not supported, trying ADB method...`);
      }

      // Method 2: Fallback to ADB (only works for HTTP without auth)
      if (proxy.type === 'http' || proxy.type === 'https') {
        const port = instance.port;

        if (proxy.username && proxy.password) {
          // ADB doesn't support proxy auth directly - need to use proxy bypass methods
          logger.warn(`ADB method doesn't support proxy authentication. Consider using VPN or transparent proxy.`);
        }

        await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell settings put global http_proxy ${proxy.host}:${proxy.port}`);
        logger.info(`Set HTTP proxy via ADB for ${instanceName}: ${proxy.host}:${proxy.port}`);
      } else {
        throw new Error(`SOCKS proxy requires ldconsole setprop support. Current LDPlayer version may not support this.`);
      }

    } catch (error) {
      logger.error(`Failed to set advanced proxy for ${instanceName}:`, error);
      throw error;
    }
  }

  /**
   * Set proxy cho instance bằng index (for bulk operations)
   */
  async setProxyByIndex(instanceIndex: number, proxy: ProxyConfig): Promise<void> {
    const instance = [...this.instances.values()].find(i => i.index === instanceIndex);
    if (!instance) {
      throw new Error(`Instance with index ${instanceIndex} not found`);
    }
    return this.setProxyAdvanced(instance.name, proxy);
  }

  async clearProxy(port: number): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell settings put global http_proxy :0`);
      logger.info(`Cleared proxy on port ${port}`);
    } catch (error) {
      logger.error(`Failed to clear proxy on port ${port}:`, error);
      throw error;
    }
  }

  /**
   * Clear proxy cho instance by name
   */
  async clearProxyByName(instanceName: string): Promise<void> {
    const instance = this.getInstance(instanceName);
    if (!instance) {
      throw new Error(`Instance ${instanceName} not found`);
    }

    try {
      // Try ldconsole first
      try {
        await execAsync(`"${this.ldConsolePath}" setprop --name "${instanceName}" --key "net.proxy" --value ""`);
        logger.info(`Cleared proxy via ldconsole for ${instanceName}`);
        return;
      } catch (ldError) {
        // Fallback to ADB
        await this.clearProxy(instance.port);
      }
    } catch (error) {
      logger.error(`Failed to clear proxy for ${instanceName}:`, error);
      throw error;
    }
  }

  async setDeviceInfo(port: number, deviceInfo: Partial<DeviceInfo>): Promise<void> {
    try {
      // This requires root access and special modifications to LDPlayer
      // Implementation depends on LDPlayer version and capabilities

      if (deviceInfo.imei) {
        await execAsync(`"${this.ldConsolePath}" modify --name "${this.getInstanceByPort(port)?.name}" --imei ${deviceInfo.imei}`);
      }

      if (deviceInfo.androidId) {
        await execAsync(`"${this.ldConsolePath}" modify --name "${this.getInstanceByPort(port)?.name}" --androidid ${deviceInfo.androidId}`);
      }

      if (deviceInfo.model) {
        await execAsync(`"${this.ldConsolePath}" modify --name "${this.getInstanceByPort(port)?.name}" --model "${deviceInfo.model}"`);
      }

      logger.info(`Updated device info on port ${port}`);
    } catch (error) {
      logger.error(`Failed to set device info on port ${port}:`, error);
      throw error;
    }
  }

  // GPS Operations
  async setLocation(port: number, latitude: number, longitude: number): Promise<void> {
    try {
      await execAsync(`"${this.ldConsolePath}" locate --name "${this.getInstanceByPort(port)?.name}" --lng ${longitude} --lat ${latitude}`);
      logger.info(`Set location to (${latitude}, ${longitude}) on port ${port}`);
    } catch (error) {
      logger.error(`Failed to set location on port ${port}:`, error);
      throw error;
    }
  }

  // Helper Methods
  private getInstanceByPort(port: number): LDPlayerInstance | undefined {
    const instances = [...this.instances.values()];
    for (const instance of instances) {
      if (instance.port === port) {
        return instance;
      }
    }
    return undefined;
  }

  getInstances(): LDPlayerInstance[] {
    return [...this.instances.values()];
  }

  getInstance(name: string): LDPlayerInstance | undefined {
    return this.instances.get(name);
  }

  // Batch Operations
  async launchAllInstances(): Promise<void> {
    const instances = [...this.instances.keys()];
    for (const name of instances) {
      await this.launchInstance(name);
      // Add delay between launches to avoid system overload
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  async stopAllInstances(): Promise<void> {
    const instances = [...this.instances.keys()];
    for (const name of instances) {
      await this.stopInstance(name);
    }
  }

  // Install app using ldconsole (more reliable than ADB)
  async installAppViaLDConsole(instanceIndex: number, apkPath: string): Promise<void> {
    try {
      await execAsync(`"${this.ldConsolePath}" installapp --index ${instanceIndex} --filename "${apkPath}"`);
      logger.info(`Installed APK via ldconsole on instance index ${instanceIndex}`);
    } catch (error) {
      logger.error(`Failed to install APK via ldconsole on instance index ${instanceIndex}:`, error);
      throw error;
    }
  }

  // Launch app using ldconsole
  async launchAppViaLDConsole(instanceIndex: number, packageName: string): Promise<void> {
    try {
      await execAsync(`"${this.ldConsolePath}" runapp --index ${instanceIndex} --packagename "${packageName}"`);
      logger.info(`Launched app ${packageName} via ldconsole on instance index ${instanceIndex}`);
    } catch (error) {
      logger.error(`Failed to launch app via ldconsole on instance index ${instanceIndex}:`, error);
      throw error;
    }
  }

  // Get instance index by name
  getInstanceIndex(instanceName: string): number | undefined {
    const instance = this.instances.get(instanceName);
    return instance?.index;
  }

  // Get actual ADB port from device list
  private async getActualADBPort(instanceIndex: number): Promise<number | null> {
    try {
      // Get list of connected ADB devices
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const lines = devicesResult.stdout.trim().split('\n');

      // Parse emulator ports (format: emulator-5572 device)
      const ports: number[] = [];
      for (const line of lines) {
        const match = line.match(/emulator-(\d+)\s+device/);
        if (match) {
          ports.push(parseInt(match[1], 10));
        }
        // Also check for direct IP connections (format: 127.0.0.1:5572 device)
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
        if (ipMatch) {
          ports.push(parseInt(ipMatch[1], 10));
        }
      }

      // Return first available port (for running instance)
      // Note: This assumes only one instance is running
      // For multiple instances, we need more sophisticated matching
      if (ports.length > 0) {
        return ports[0];
      }

      // Fallback to formula if no device connected
      return 5555 + instanceIndex * 2;
    } catch (error) {
      logger.debug('Failed to get actual ADB port, using formula fallback:', error);
      return 5555 + instanceIndex * 2;
    }
  }

  // Get all instances from ldconsole (scan existing instances)
  async getAllInstancesFromLDConsole(): Promise<Array<{ name: string; index: number; port: number }>> {
    try {
      const listResult = await execAsync(`"${this.ldConsolePath}" list`);
      const lines = listResult.stdout.trim().split('\n');

      const instances: Array<{ name: string; index: number; port: number }> = [];

      // Get running instances and their actual ADB ports
      const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`).catch(() => ({ stdout: '' }));
      const runningInstances = runningListResult.stdout.trim().split('\n').filter((line: string) => line.length > 0);

      // Get all connected ADB devices and their ports
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const devicePorts = new Map<number, number>(); // index -> port mapping

      for (const line of devicesResult.stdout.trim().split('\n')) {
        const emulatorMatch = line.match(/emulator-(\d+)\s+device/);
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
        if (emulatorMatch || ipMatch) {
          const port = parseInt((emulatorMatch || ipMatch)![1], 10);
          // Try to match port to instance by checking running list order
          devicePorts.set(devicePorts.size, port);
        }
      }

      let runningIndex = 0;
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const index = parseInt(parts[0], 10);
          const name = parts[1];

          // Check if instance is running
          const isRunning = runningInstances.some(runningLine => {
            const runningParts = runningLine.split(',');
            return runningParts.length >= 2 && runningParts[1] === name;
          });

          // Use actual ADB port if running, otherwise use formula
          let port: number;
          if (isRunning && devicePorts.has(runningIndex)) {
            port = devicePorts.get(runningIndex)!;
            runningIndex++;
          } else {
            port = 5555 + index * 2;
          }

          instances.push({ name, index, port });

          // Also register in internal map if not already
          if (!this.instances.has(name)) {
            const instance: LDPlayerInstance = {
              name,
              index,
              port,
              status: isRunning ? 'running' : 'stopped'
            };
            this.instances.set(name, instance);
          } else {
            // Update existing instance with actual port
            const existingInstance = this.instances.get(name)!;
            existingInstance.port = port;
            existingInstance.status = isRunning ? 'running' : 'stopped';
          }
        }
      }

      logger.info(`Found ${instances.length} LDPlayer instances`);
      return instances;
    } catch (error) {
      logger.error('Failed to get instances from ldconsole:', error);
      throw error;
    }
  }
}

export default LDPlayerController;