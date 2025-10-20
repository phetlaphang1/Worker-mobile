import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { LDPlayerController, LDPlayerInstance } from '../core/LDPlayerController.js';
import { getADBManager } from '../utils/ADBManager.js';
import ProfileManager from './ProfileManager.js';

const execAsync = promisify(exec);

export interface DeviceStatus {
  instanceName: string;
  index: number;
  port: number;
  isRunning: boolean;
  isAdbConnected: boolean;
  lastChecked: Date;
  health?: {
    cpuUsage?: number;
    memoryUsage?: number;
    batteryLevel?: number;
    temperature?: number;
  };
}

export interface MonitoringConfig {
  checkInterval: number; // milliseconds
  enableLogcat: boolean;
  logcatDir: string;
  logcatMaxSize: number; // MB
  enableHealthCheck: boolean;
}

/**
 * DeviceMonitor - Service theo dõi real-time trạng thái LDPlayer instances
 *
 * Features:
 * - Real-time status monitoring
 * - ADB logcat streaming to files
 * - Device health metrics (CPU, RAM, Battery)
 * - Auto-reconnect when instances crash
 */
export class DeviceMonitor {
  private ldController: LDPlayerController;
  private profileManager: ProfileManager | null = null;
  private config: MonitoringConfig;
  private monitorInterval: NodeJS.Timeout | null = null;
  private logcatProcesses: Map<string, ChildProcess> = new Map();
  private deviceStatuses: Map<string, DeviceStatus> = new Map();
  private isMonitoring: boolean = false;

  constructor(ldController: LDPlayerController, config?: Partial<MonitoringConfig>) {
    this.ldController = ldController;
    this.config = {
      checkInterval: config?.checkInterval || 10000, // 10 seconds (reduced from 5s to prevent ADB overload)
      enableLogcat: config?.enableLogcat ?? true,
      logcatDir: config?.logcatDir || path.join(process.cwd(), 'logs', 'devices'),
      logcatMaxSize: config?.logcatMaxSize || 50, // 50 MB
      enableHealthCheck: config?.enableHealthCheck ?? true,
    };

    logger.info('[DeviceMonitor] Initialized with config:', this.config);
  }

  /**
   * Set ProfileManager for database updates (optional)
   */
  setProfileManager(profileManager: ProfileManager): void {
    this.profileManager = profileManager;
    logger.info('[DeviceMonitor] ProfileManager attached for DB sync');
  }

  /**
   * Start monitoring all instances
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('[DeviceMonitor] Already monitoring');
      return;
    }

    logger.info('[DeviceMonitor] Starting device monitoring...');
    this.isMonitoring = true;

    // Ensure log directory exists
    if (this.config.enableLogcat) {
      await fs.mkdir(this.config.logcatDir, { recursive: true });
    }

    // Initial scan
    await this.scanDevices();

    // Start periodic monitoring
    this.monitorInterval = setInterval(async () => {
      try {
        await this.scanDevices();
      } catch (error) {
        logger.error('[DeviceMonitor] Error during scan:', error);
      }
    }, this.config.checkInterval);

    logger.info('[DeviceMonitor] Monitoring started');
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('[DeviceMonitor] Stopping device monitoring...');
    this.isMonitoring = false;

    // Clear interval
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    // Stop all logcat processes
    await this.stopAllLogcat();

    logger.info('[DeviceMonitor] Monitoring stopped');
  }

  /**
   * Scan all devices and update statuses
   */
  private async scanDevices(): Promise<void> {
    try {
      // IMPORTANT: Always sync state from ldconsole before scanning
      await this.ldController.syncAllInstancesState();

      // Get all instances from LDPlayer (now up-to-date)
      const ldInstances = this.ldController.getInstances();

      // Get running instances from ADB using ADB Manager (with caching)
      const adbManager = getADBManager();
      const devicesResult = await adbManager.execute('devices');
      const connectedPorts = this.parseAdbDevices(devicesResult.stdout);

      logger.debug(`[DeviceMonitor] Scan: ${ldInstances.length} instances, ${connectedPorts.size} ADB devices`);

      // Update status for each instance
      for (const instance of ldInstances) {
        const isAdbConnected = connectedPorts.has(instance.port);
        const isRunning = instance.status === 'running';

        const status: DeviceStatus = {
          instanceName: instance.name,
          index: instance.index,
          port: instance.port,
          isRunning,
          isAdbConnected,
          lastChecked: new Date(),
        };

        // AUTO-RECONNECT: If instance is running but ADB not connected, try to reconnect
        if (isRunning && !isAdbConnected) {
          logger.warn(`[SYNC] Instance ${instance.name} is running but ADB not connected, initiating auto-reconnect...`);
          try {
            // IMPORTANT: Always resolve actual port from ldconsole before reconnecting
            let actualPort = instance.port;
            try {
              actualPort = await this.ldController.getAdbPortForInstance(instance.name);
              logger.info(`[SYNC] Resolved actual ADB port for ${instance.name}: ${actualPort} (cached was: ${instance.port})`);

              // Update port in status if changed
              if (actualPort !== instance.port) {
                logger.warn(`[SYNC] ⚠️ Port changed for ${instance.name}: ${instance.port} → ${actualPort}`);
                status.port = actualPort;
                instance.port = actualPort; // Update in-memory cache

                // Persist port change to database if ProfileManager is available
                if (this.profileManager) {
                  try {
                    const profile = this.profileManager.getAllProfiles().find(p => p.instanceName === instance.name);
                    if (profile) {
                      await this.profileManager.updateProfile(profile.id, { port: actualPort });
                      logger.info(`[SYNC] ✅ Updated port in database for profile ${profile.id} (${instance.name}): ${actualPort}`);
                    } else {
                      logger.warn(`[SYNC] No profile found for instance ${instance.name}, cannot update DB`);
                    }
                  } catch (dbError) {
                    logger.error(`[SYNC] Failed to update port in database for ${instance.name}:`, dbError);
                  }
                } else {
                  logger.debug(`[SYNC] ProfileManager not available, port ${actualPort} not persisted to DB`);
                }
              }
            } catch (portError) {
              logger.warn(`[SYNC] Failed to resolve port for ${instance.name}, using cached port ${instance.port}:`, portError);
            }

            // Disconnect any stale/offline connections first
            try {
              const adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';
              await execAsync(`"${adbPath}" disconnect 127.0.0.1:${actualPort}`);
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (disconnectError) {
              // Ignore disconnect errors
            }

            // Try to connect with resolved port (with timeout)
            try {
              await Promise.race([
                this.ldController.connectADB(actualPort),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
              ]);
            } catch (connectError) {
              logger.warn(`[SYNC] First connection attempt failed, retrying once more...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              await this.ldController.connectADB(actualPort);
            }

            // Wait a bit for connection to stabilize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify connection after reconnect
            const recheckResult = await adbManager.execute('devices');
            const recheckPorts = this.parseAdbDevices(recheckResult.stdout);

            if (recheckPorts.has(actualPort)) {
              logger.info(`✅ [SYNC] Successfully reconnected ADB for ${instance.name} on port ${actualPort}`);
              status.isAdbConnected = true;
            } else {
              logger.error(`❌ [SYNC] Failed to reconnect ADB for ${instance.name} on port ${actualPort} - device not found after connection attempt`);
            }
          } catch (error) {
            logger.error(`[SYNC] Error during auto-reconnect for ${instance.name}:`, error);
          }
        }

        // Get health metrics if enabled and device is connected
        if (this.config.enableHealthCheck && status.isAdbConnected) {
          status.health = await this.getDeviceHealth(instance.port);
        }

        this.deviceStatuses.set(instance.name, status);

        // Start/stop logcat based on connection status
        if (this.config.enableLogcat) {
          if (status.isAdbConnected && !this.logcatProcesses.has(instance.name)) {
            await this.startLogcat(instance);
          } else if (!status.isAdbConnected && this.logcatProcesses.has(instance.name)) {
            await this.stopLogcat(instance.name);
          }
        }
      }

      // Clean up logcat processes for removed instances
      const currentInstanceNames = new Set(ldInstances.map(i => i.name));
      for (const instanceName of this.logcatProcesses.keys()) {
        if (!currentInstanceNames.has(instanceName)) {
          await this.stopLogcat(instanceName);
        }
      }

    } catch (error) {
      logger.error('[DeviceMonitor] Failed to scan devices:', error);
    }
  }

  /**
   * Parse ADB devices output
   */
  private parseAdbDevices(output: string): Set<number> {
    const ports = new Set<number>();
    const lines = output.trim().split('\n');

    for (const line of lines) {
      // Match: "127.0.0.1:5572  device"
      const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
      if (ipMatch) {
        ports.add(parseInt(ipMatch[1], 10));
      }

      // Match: "emulator-5572  device"
      const emulatorMatch = line.match(/emulator-(\d+)\s+device/);
      if (emulatorMatch) {
        ports.add(parseInt(emulatorMatch[1], 10));
      }
    }

    return ports;
  }

  /**
   * Start logcat streaming for an instance
   */
  private async startLogcat(instance: LDPlayerInstance): Promise<void> {
    try {
      const logFile = path.join(this.config.logcatDir, `${instance.name}.log`);
      const adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';

      // Check if log file is too large
      try {
        const stats = await fs.stat(logFile);
        const sizeMB = stats.size / (1024 * 1024);
        if (sizeMB > this.config.logcatMaxSize) {
          logger.info(`[DeviceMonitor] Log file ${logFile} too large (${sizeMB.toFixed(2)} MB), rotating...`);
          const backupFile = `${logFile}.${Date.now()}.old`;
          await fs.rename(logFile, backupFile);
        }
      } catch (error) {
        // File doesn't exist, ignore
      }

      // Open log file for appending
      const logStream = await fs.open(logFile, 'a');

      // Start logcat process
      // Filter: only show app logs, errors, and warnings
      const logcatProcess = spawn(
        adbPath,
        [
          '-s',
          `127.0.0.1:${instance.port}`,
          'logcat',
          '-v',
          'time',
          '*:W', // Warnings and above
        ],
        {
          stdio: ['ignore', logStream.fd, logStream.fd],
          detached: false,
        }
      );

      logcatProcess.on('error', (error) => {
        logger.error(`[DeviceMonitor] Logcat error for ${instance.name}:`, error);
      });

      logcatProcess.on('exit', (code) => {
        logger.debug(`[DeviceMonitor] Logcat exited for ${instance.name} with code ${code}`);
        this.logcatProcesses.delete(instance.name);
        logStream.close();
      });

      this.logcatProcesses.set(instance.name, logcatProcess);
      logger.info(`[DeviceMonitor] Started logcat for ${instance.name} -> ${logFile}`);

    } catch (error) {
      logger.error(`[DeviceMonitor] Failed to start logcat for ${instance.name}:`, error);
    }
  }

  /**
   * Stop logcat for an instance
   */
  private async stopLogcat(instanceName: string): Promise<void> {
    const process = this.logcatProcesses.get(instanceName);
    if (process) {
      try {
        process.kill('SIGTERM');
        this.logcatProcesses.delete(instanceName);
        logger.info(`[DeviceMonitor] Stopped logcat for ${instanceName}`);
      } catch (error) {
        logger.error(`[DeviceMonitor] Failed to stop logcat for ${instanceName}:`, error);
      }
    }
  }

  /**
   * Stop all logcat processes
   */
  private async stopAllLogcat(): Promise<void> {
    const instances = [...this.logcatProcesses.keys()];
    for (const instanceName of instances) {
      await this.stopLogcat(instanceName);
    }
  }

  /**
   * Get device health metrics
   */
  private async getDeviceHealth(port: number): Promise<DeviceStatus['health']> {
    try {
      const adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';
      const serial = `127.0.0.1:${port}`;

      const health: DeviceStatus['health'] = {};

      // Get CPU usage (top command)
      try {
        const cpuResult = await Promise.race([
          execAsync(`"${adbPath}" -s ${serial} shell top -n 1 | head -n 5`),
          new Promise<{ stdout: string }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          ),
        ]);

        // Parse CPU from "top" output (example: "User 25%, System 10%")
        const cpuMatch = cpuResult.stdout.match(/(\d+)%\s*cpu/i);
        if (cpuMatch) {
          health.cpuUsage = parseInt(cpuMatch[1], 10);
        }
      } catch (error) {
        logger.debug(`[DeviceMonitor] Failed to get CPU for port ${port}`);
      }

      // Get memory usage
      try {
        const memResult = await Promise.race([
          execAsync(`"${adbPath}" -s ${serial} shell dumpsys meminfo | grep "Total RAM"`),
          new Promise<{ stdout: string }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          ),
        ]);

        // Parse memory (example: "Total RAM: 2048 MB (Used: 1024 MB)")
        const memMatch = memResult.stdout.match(/(\d+)\s*MB/);
        if (memMatch) {
          health.memoryUsage = parseInt(memMatch[1], 10);
        }
      } catch (error) {
        logger.debug(`[DeviceMonitor] Failed to get memory for port ${port}`);
      }

      // Get battery level
      try {
        const batteryResult = await Promise.race([
          execAsync(`"${adbPath}" -s ${serial} shell dumpsys battery | grep level`),
          new Promise<{ stdout: string }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          ),
        ]);

        const batteryMatch = batteryResult.stdout.match(/level:\s*(\d+)/);
        if (batteryMatch) {
          health.batteryLevel = parseInt(batteryMatch[1], 10);
        }
      } catch (error) {
        logger.debug(`[DeviceMonitor] Failed to get battery for port ${port}`);
      }

      return health;
    } catch (error) {
      logger.debug(`[DeviceMonitor] Failed to get health for port ${port}:`, error);
      return {};
    }
  }

  /**
   * Get current status of all devices
   */
  getDeviceStatuses(): DeviceStatus[] {
    return [...this.deviceStatuses.values()];
  }

  /**
   * Get status of a specific device
   */
  getDeviceStatus(instanceName: string): DeviceStatus | undefined {
    return this.deviceStatuses.get(instanceName);
  }

  /**
   * Get logcat file path for an instance
   */
  getLogcatPath(instanceName: string): string {
    return path.join(this.config.logcatDir, `${instanceName}.log`);
  }

  /**
   * Read logcat file content
   */
  async readLogcat(instanceName: string, lines: number = 100): Promise<string> {
    try {
      const logFile = this.getLogcatPath(instanceName);
      const content = await fs.readFile(logFile, 'utf-8');

      // Return last N lines
      const allLines = content.split('\n');
      const lastLines = allLines.slice(-lines);
      return lastLines.join('\n');
    } catch (error) {
      logger.error(`[DeviceMonitor] Failed to read logcat for ${instanceName}:`, error);
      throw new Error(`Failed to read logcat: ${error}`);
    }
  }

  /**
   * Clear logcat file
   */
  async clearLogcat(instanceName: string): Promise<void> {
    try {
      const logFile = this.getLogcatPath(instanceName);
      await fs.writeFile(logFile, '');
      logger.info(`[DeviceMonitor] Cleared logcat for ${instanceName}`);
    } catch (error) {
      logger.error(`[DeviceMonitor] Failed to clear logcat for ${instanceName}:`, error);
      throw error;
    }
  }

  /**
   * Get monitoring status
   */
  isRunning(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get monitoring statistics
   */
  getStatistics(): {
    totalInstances: number;
    runningInstances: number;
    connectedInstances: number;
    logcatProcesses: number;
    uptime: number;
  } {
    const statuses = [...this.deviceStatuses.values()];
    return {
      totalInstances: statuses.length,
      runningInstances: statuses.filter(s => s.isRunning).length,
      connectedInstances: statuses.filter(s => s.isAdbConnected).length,
      logcatProcesses: this.logcatProcesses.size,
      uptime: this.monitorInterval ? this.config.checkInterval : 0,
    };
  }
}

export default DeviceMonitor;
