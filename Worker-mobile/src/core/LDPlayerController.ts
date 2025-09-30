import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { logger } from '../utils/logger.js';

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
    this.ldConsolePath = process.env.LDCONSOLE_PATH || 'ldconsole.exe';
    this.adbPath = process.env.ADB_PATH || 'adb';
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
      await execAsync(`"${this.ldConsolePath}" add --name "${name}"`);

      // Configure instance
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
          await execAsync(`"${this.ldConsolePath}" modify --name "${name}" ${modifyCommands.join(' ')}`);
        }
      }

      const instance: LDPlayerInstance = {
        name,
        index: this.instances.size,
        port: 5555 + this.instances.size * 2,
        status: 'stopped'
      };

      this.instances.set(name, instance);
      logger.info(`Created LDPlayer instance: ${name}`);

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

  // ADB Operations
  async connectADB(port: number): Promise<void> {
    try {
      const result = await execAsync(`"${this.adbPath}" connect 127.0.0.1:${port}`);
      logger.info(`ADB connected to port ${port}: ${result.stdout}`);
    } catch (error) {
      logger.error(`Failed to connect ADB to port ${port}:`, error);
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

  private async waitForDevice(port: number, timeout: number = 30000): Promise<void> {
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
  async tap(port: number, x: number, y: number): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell input tap ${x} ${y}`);
      logger.debug(`Tapped at (${x}, ${y}) on port ${port}`);
    } catch (error) {
      logger.error(`Failed to tap on port ${port}:`, error);
      throw error;
    }
  }

  async swipe(port: number, x1: number, y1: number, x2: number, y2: number, duration: number = 500): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
      logger.debug(`Swiped from (${x1}, ${y1}) to (${x2}, ${y2}) on port ${port}`);
    } catch (error) {
      logger.error(`Failed to swipe on port ${port}:`, error);
      throw error;
    }
  }

  async inputText(port: number, text: string): Promise<void> {
    try {
      // Escape special characters for shell
      const escapedText = text.replace(/([\\'"` ])/g, '\\$1');
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell input text "${escapedText}"`);
      logger.debug(`Input text on port ${port}: ${text}`);
    } catch (error) {
      logger.error(`Failed to input text on port ${port}:`, error);
      throw error;
    }
  }

  async pressKey(port: number, keyCode: string): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell input keyevent ${keyCode}`);
      logger.debug(`Pressed key ${keyCode} on port ${port}`);
    } catch (error) {
      logger.error(`Failed to press key on port ${port}:`, error);
      throw error;
    }
  }

  async screenshot(port: number, savePath: string): Promise<void> {
    try {
      const tempPath = '/sdcard/screenshot.png';
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell screencap -p ${tempPath}`);
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} pull ${tempPath} "${savePath}"`);
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell rm ${tempPath}`);
      logger.debug(`Screenshot saved to ${savePath} from port ${port}`);
    } catch (error) {
      logger.error(`Failed to take screenshot on port ${port}:`, error);
      throw error;
    }
  }

  // App Management
  async installAPK(port: number, apkPath: string): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} install -r "${apkPath}"`);
      logger.info(`Installed APK ${apkPath} on port ${port}`);
    } catch (error) {
      logger.error(`Failed to install APK on port ${port}:`, error);
      throw error;
    }
  }

  async launchApp(port: number, packageName: string, activityName?: string): Promise<void> {
    try {
      const activity = activityName || '.MainActivity';
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell am start -n ${packageName}/${packageName}${activity}`);
      logger.info(`Launched app ${packageName} on port ${port}`);
    } catch (error) {
      logger.error(`Failed to launch app on port ${port}:`, error);
      throw error;
    }
  }

  async closeApp(port: number, packageName: string): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell am force-stop ${packageName}`);
      logger.info(`Closed app ${packageName} on port ${port}`);
    } catch (error) {
      logger.error(`Failed to close app on port ${port}:`, error);
      throw error;
    }
  }

  // Device Configuration
  async setProxy(port: number, proxyHost: string, proxyPort: number): Promise<void> {
    try {
      await execAsync(`"${this.adbPath}" -s 127.0.0.1:${port} shell settings put global http_proxy ${proxyHost}:${proxyPort}`);
      logger.info(`Set proxy ${proxyHost}:${proxyPort} on port ${port}`);
    } catch (error) {
      logger.error(`Failed to set proxy on port ${port}:`, error);
      throw error;
    }
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
    for (const instance of this.instances.values()) {
      if (instance.port === port) {
        return instance;
      }
    }
    return undefined;
  }

  getInstances(): LDPlayerInstance[] {
    return Array.from(this.instances.values());
  }

  getInstance(name: string): LDPlayerInstance | undefined {
    return this.instances.get(name);
  }

  // Batch Operations
  async launchAllInstances(): Promise<void> {
    const instances = Array.from(this.instances.keys());
    for (const name of instances) {
      await this.launchInstance(name);
      // Add delay between launches to avoid system overload
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  async stopAllInstances(): Promise<void> {
    const instances = Array.from(this.instances.keys());
    for (const name of instances) {
      await this.stopInstance(name);
    }
  }
}

export default LDPlayerController;