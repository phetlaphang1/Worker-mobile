import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { ProxyConfig, formatProxyForLDPlayer } from '../types/proxy.js';
import { ADBConnectionPool } from './ADBConnectionPool.js';

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

  // ⚡ NEW: ADB Connection Pool for better performance
  private adbPool: ADBConnectionPool;

  constructor() {
    this.ldConsolePath = process.env.LDCONSOLE_PATH || 'D:\\LDPlayer\\LDPlayer9\\ldconsole.exe';
    this.adbPath = process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';

    // Initialize ADB connection pool
    this.adbPool = new ADBConnectionPool(this.adbPath);

    logger.info(`LDPlayerController initialized with:`);
    logger.info(`  ldconsole: ${this.ldConsolePath}`);
    logger.info(`  adb: ${this.adbPath}`);
    logger.info(`  ADB Connection Pool: ENABLED ⚡`);
  }

  /**
   * CRITICAL: Initialize ADB system on server startup
   * This ensures clean ADB state and proper port synchronization
   * Call this ONCE when server starts, before any other operations
   */
  async initializeADBSystem(): Promise<void> {
    try {
      logger.info('='.repeat(80));
      logger.info('[INIT] Starting ADB System Initialization...');
      logger.info('='.repeat(80));

      // Step 1: Kill any existing ADB daemon to ensure clean state
      logger.info('[INIT] Step 1/7: Killing existing ADB daemon...');
      try {
        await execAsync(`"${this.adbPath}" kill-server`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        logger.info('[INIT] ✅ ADB daemon killed');
      } catch (error) {
        logger.warn('[INIT] Failed to kill ADB daemon (may not be running):', error);
      }

      // Step 2: Start fresh ADB daemon
      logger.info('[INIT] Step 2/7: Starting ADB daemon...');
      try {
        const startResult = await execAsync(`"${this.adbPath}" start-server`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        logger.info('[INIT] ✅ ADB daemon started');
        if (startResult.stdout) logger.debug('[INIT] Output:', startResult.stdout);
      } catch (error: any) {
        logger.error('[INIT] ❌ Failed to start ADB daemon:', error);
        throw new Error(`ADB daemon failed to start: ${error.message}`);
      }

      // Step 3: Verify ADB daemon is running
      logger.info('[INIT] Step 3/7: Verifying ADB daemon...');
      try {
        const devicesResult = await execAsync(`"${this.adbPath}" devices`);
        if (devicesResult.stdout.includes('List of devices attached')) {
          logger.info('[INIT] ✅ ADB daemon is healthy');
        } else {
          throw new Error('Unexpected ADB devices output');
        }
      } catch (error: any) {
        logger.error('[INIT] ❌ ADB daemon verification failed:', error);
        throw new Error(`ADB daemon unhealthy: ${error.message}`);
      }

      // Step 4: Load all instances from LDPlayer
      logger.info('[INIT] Step 4/7: Loading instances from LDPlayer...');
      await this.getAllInstancesFromLDConsole();
      const instanceCount = this.instances.size;
      logger.info(`[INIT] ✅ Loaded ${instanceCount} instances`);

      // Step 5: Enable ADB debugging for all instances
      logger.info('[INIT] Step 5/7: Enabling ADB debugging for all instances...');
      await this.enableADBForAllInstances();
      logger.info('[INIT] ✅ ADB debugging enabled');

      // Step 6: Connect to all running instances
      logger.info('[INIT] Step 6/7: Connecting to running instances...');
      await this.connectAllRunningInstances();
      logger.info('[INIT] ✅ Running instances connected');

      // Step 7: Verify final state
      logger.info('[INIT] Step 7/7: Verifying system state...');
      const finalDevicesResult = await execAsync(`"${this.adbPath}" devices`);
      const connectedDevices = finalDevicesResult.stdout.trim().split('\n').slice(1).filter(line => line.includes('device'));
      logger.info(`[INIT] ✅ ${connectedDevices.length} devices connected to ADB`);

      logger.info('='.repeat(80));
      logger.info('[INIT] ✅ ADB System Initialization Complete!');
      logger.info(`[INIT]    Total Instances: ${instanceCount}`);
      logger.info(`[INIT]    ADB Devices: ${connectedDevices.length}`);
      logger.info('='.repeat(80));

    } catch (error) {
      logger.error('[INIT] ❌ ADB System Initialization FAILED:', error);
      throw error;
    }
  }

  /**
   * Enable ADB debugging for all LDPlayer instances
   * Uses modify command instead of setprop to avoid ADB dependency
   */
  private async enableADBForAllInstances(): Promise<void> {
    try {
      const listResult = await execAsync(`"${this.ldConsolePath}" list`);
      const lines = listResult.stdout.trim().split('\n');

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const index = parseInt(parts[0], 10);
          const name = parts[1];

          // Skip invalid instances
          if (isNaN(index) || !name || name === 'Instance_NaN' || name.trim() === '') {
            continue;
          }

          try {
            // Enable ADB debugging using modify command (doesn't require ADB connection)
            await execAsync(`"${this.ldConsolePath}" modify --index ${index} --imei auto`);
            logger.debug(`Ensured ADB configuration for instance: ${name} (index ${index})`);
          } catch (error) {
            logger.debug(`Failed to modify ${name}:`, error);
          }
        }
      }

      logger.info('ADB debugging configuration completed for all instances');

      // Auto-connect to all running instances
      await this.connectAllRunningInstances();
    } catch (error) {
      logger.error('Failed to enable ADB debugging for all instances:', error);
    }
  }

  /**
   * Reset all ADB connections and reconnect
   * Use this to fix port conflicts and offline devices
   */
  async resetAllADBConnections(): Promise<void> {
    try {
      logger.info('[ADB RESET] Starting full ADB reset...');

      // Step 1: Get list of running instances to restart them later
      const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`).catch(() => ({ stdout: '' }));
      const runningInstanceNames = runningListResult.stdout.trim().split('\n').filter((line: string) => line.length > 0);
      logger.info(`[ADB RESET] Found ${runningInstanceNames.length} running instance(s): ${runningInstanceNames.join(', ')}`);

      // Step 2: Stop all running instances (required to modify ADB settings)
      for (const name of runningInstanceNames) {
        try {
          await execAsync(`"${this.ldConsolePath}" quit --name "${name}"`);
          logger.info(`[ADB RESET] Stopped ${name}`);
        } catch (error) {
          logger.warn(`[ADB RESET] Failed to stop ${name}:`, error);
        }
      }

      // Wait for instances to stop completely
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 3: Disconnect all ADB devices
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const deviceLines = devicesResult.stdout.trim().split('\n').slice(1);

      for (const line of deviceLines) {
        const emulatorMatch = line.match(/emulator-(\d+)/);
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)/);

        if (emulatorMatch || ipMatch) {
          const port = parseInt((emulatorMatch || ipMatch)![1], 10);
          try {
            await execAsync(`"${this.adbPath}" disconnect 127.0.0.1:${port}`);
            logger.info(`[ADB RESET] Disconnected port ${port}`);
          } catch (error) {
            logger.debug(`[ADB RESET] Failed to disconnect ${port}:`, error);
          }
        }
      }

      // Step 4: Kill ADB server
      try {
        await execAsync(`"${this.adbPath}" kill-server`);
        logger.info('[ADB RESET] Killed ADB server');
      } catch (error) {
        logger.warn('[ADB RESET] Failed to kill ADB server:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 5: Start ADB server
      try {
        await execAsync(`"${this.adbPath}" start-server`);
        logger.info('[ADB RESET] Started ADB server');
      } catch (error) {
        logger.warn('[ADB RESET] Failed to start ADB server:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 6: Enable ADB for all instances (when stopped)
      await this.enableADBForAllInstances();

      // Step 7: Restart previously running instances
      for (const name of runningInstanceNames) {
        try {
          logger.info(`[ADB RESET] Restarting ${name}...`);
          await execAsync(`"${this.ldConsolePath}" launch --name "${name}"`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for boot
        } catch (error) {
          logger.warn(`[ADB RESET] Failed to restart ${name}:`, error);
        }
      }

      // Wait for all instances to boot
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Step 8: Reconnect to all running instances
      await this.connectAllRunningInstances();

      logger.info('[ADB RESET] ✅ ADB reset completed successfully');
    } catch (error) {
      logger.error('[ADB RESET] Failed to reset ADB connections:', error);
      throw error;
    }
  }

  /**
   * Connect ADB to all running instances
   * Uses ldconsole list2 to get accurate index-to-port mapping
   */
  async connectAllRunningInstances(): Promise<void> {
    try {
      logger.info('[ADB CONNECT] Starting ADB connection for all running instances...');

      // Step 1: Get current ADB device status
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const deviceLines = devicesResult.stdout.trim().split('\n').slice(1); // Skip header

      const connectedPorts = new Set<number>();
      const offlinePorts = new Set<number>();

      for (const line of deviceLines) {
        const emulatorMatch = line.match(/emulator-(\d+)\s+(\w+)/);
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+(\w+)/);

        if (emulatorMatch) {
          const port = parseInt(emulatorMatch[1], 10);
          const state = emulatorMatch[2];
          if (state === 'device') {
            connectedPorts.add(port);
          } else if (state === 'offline') {
            offlinePorts.add(port);
          }
        } else if (ipMatch) {
          const port = parseInt(ipMatch[1], 10);
          const state = ipMatch[2];
          if (state === 'device') {
            connectedPorts.add(port);
          } else if (state === 'offline') {
            offlinePorts.add(port);
          }
        }
      }

      logger.info(`[ADB CONNECT] Current status: ${connectedPorts.size} connected, ${offlinePorts.size} offline`);

      // Step 2: Disconnect all offline devices
      for (const port of offlinePorts) {
        try {
          await execAsync(`"${this.adbPath}" disconnect 127.0.0.1:${port}`);
          logger.info(`[ADB CONNECT] Disconnected offline device on port ${port}`);
        } catch (error) {
          logger.debug(`[ADB CONNECT] Failed to disconnect port ${port}:`, error);
        }
      }

      // Step 3: Get running instances with accurate index mapping
      const list2Result = await execAsync(`"${this.ldConsolePath}" list2`);
      const list2Lines = list2Result.stdout.trim().split('\n');

      const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`).catch(() => ({ stdout: '' }));
      const runningInstanceNames = runningListResult.stdout.trim().split('\n').filter((line: string) => line.length > 0);

      if (runningInstanceNames.length === 0) {
        logger.info('[ADB CONNECT] No running instances found');
        return;
      }

      // Step 4: Map running instances to their expected ports
      const portsToConnect: number[] = [];

      for (const line of list2Lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const index = parseInt(parts[0], 10);
          const name = parts[1];

          // Skip invalid instances
          if (isNaN(index) || index < 0 || !name || name === 'Instance_NaN') {
            continue;
          }

          // Check if this instance is running
          if (runningInstanceNames.includes(name)) {
            const expectedPort = 5555 + index * 2;

            // Only try to connect if not already connected
            if (!connectedPorts.has(expectedPort)) {
              portsToConnect.push(expectedPort);
              logger.info(`[ADB CONNECT] Will connect to ${name} (index ${index}) on port ${expectedPort}`);
            } else {
              logger.debug(`[ADB CONNECT] ${name} already connected on port ${expectedPort}`);
            }
          }
        }
      }

      // Step 5: Connect to all ports that need connection
      for (const port of portsToConnect) {
        try {
          await Promise.race([
            execAsync(`"${this.adbPath}" connect 127.0.0.1:${port}`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
          ]);

          // Verify connection
          const recheckResult = await execAsync(`"${this.adbPath}" devices`);
          if (recheckResult.stdout.includes(`127.0.0.1:${port}`) && recheckResult.stdout.includes('device')) {
            logger.info(`[ADB CONNECT] ✅ Successfully connected to port ${port}`);
          } else if (recheckResult.stdout.includes('offline')) {
            logger.warn(`[ADB CONNECT] ⚠️ Port ${port} connected but offline`);
          }
        } catch (error) {
          logger.warn(`[ADB CONNECT] Failed to connect to port ${port}:`, error);
        }
      }

      logger.info('[ADB CONNECT] ADB connection process completed');
    } catch (error) {
      logger.error('[ADB CONNECT] Failed to auto-connect to running instances:', error);
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

  /**
   * Gracefully launch instance với health check và recovery
   * 1. Launch instance
   * 2. Wait for boot complete
   * 3. Connect ADB with retry
   * 4. Verify device is healthy
   * 5. Re-enable ADB if needed
   */
  async launchInstance(name: string, options?: { retryCount?: number; verifyHealth?: boolean; timeout?: number }): Promise<void> {
    const { retryCount = 3, verifyHealth = true, timeout = 120000 } = options || {};

    let lastError: any;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        let instance = this.instances.get(name);

        // If instance not found in Map, try to discover it from LDPlayer
        if (!instance) {
          logger.warn(`Instance ${name} not found in cache, discovering from LDPlayer...`);
          await this.getAllInstancesFromLDConsole();
          instance = this.instances.get(name);

          if (!instance) {
            // List available instances for debugging
            const availableInstances = [...this.instances.keys()];
            logger.error(`Instance "${name}" not found in LDPlayer!`);
            logger.error(`Available instances (${availableInstances.length}):`);
            availableInstances.slice(0, 10).forEach(n => logger.error(`  - ${n}`));

            throw new Error(
              `Instance "${name}" not found in LDPlayer. ` +
              `This instance may have been deleted or renamed. ` +
              `Available instances: ${availableInstances.slice(0, 5).join(', ')}${availableInstances.length > 5 ? '...' : ''}`
            );
          }
          logger.info(`Instance ${name} discovered and registered`);
        }

        logger.info(`[STARTUP] Launching instance: ${name} (attempt ${attempt}/${retryCount})...`);

        // Step 1: Launch instance using --index instead of --name for better compatibility
        const launchPromise = execAsync(`"${this.ldConsolePath}" launch --index ${instance.index}`);

        await Promise.race([
          launchPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Launch timeout')), timeout)
          )
        ]);

        // Small delay to ensure process starts
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 2: Ensure ADB is enabled (in case it was disabled)
        try {
          logger.info(`[STARTUP] Ensuring ADB debugging is enabled...`);
          await execAsync(`"${this.ldConsolePath}" setprop --name "${name}" --key "adb.debug" --value "1"`);
        } catch (error) {
          logger.warn(`[STARTUP] Failed to enable ADB (may already be enabled):`, error);
        }

        // Update status early
        instance.status = 'running';

        // Step 3: Wait for device boot completion
        logger.info(`[STARTUP] Waiting for device to boot...`);
        await this.waitForDevice(instance.port, timeout);

        // Step 4: Connect ADB with retry logic
        logger.info(`[STARTUP] Connecting ADB...`);
        let adbConnected = false;
        for (let adbAttempt = 1; adbAttempt <= 3; adbAttempt++) {
          try {
            await this.connectADB(instance.port);

            // Verify connection
            const devicesResult = await execAsync(`"${this.adbPath}" devices`);
            if (devicesResult.stdout.includes(`127.0.0.1:${instance.port}`) ||
                devicesResult.stdout.includes(`emulator-${instance.port}`)) {
              adbConnected = true;
              break;
            }

            logger.warn(`[STARTUP] ADB connection verification failed, retrying... (${adbAttempt}/3)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            logger.warn(`[STARTUP] ADB connection attempt ${adbAttempt} failed:`, error);
            if (adbAttempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        if (!adbConnected) {
          throw new Error('Failed to establish ADB connection after multiple attempts');
        }

        // Step 5: Health verification (optional)
        if (verifyHealth) {
          logger.info(`[STARTUP] Verifying instance health...`);
          try {
            // Test basic ADB command
            await this.executeAdbCommand(instance.port, 'shell echo "health_check"');
            logger.info(`[STARTUP] Health check passed`);
          } catch (error) {
            logger.warn(`[STARTUP] Health check failed, but instance may still be usable:`, error);
          }
        }

        logger.info(`✅ [STARTUP] Instance ${name} launched successfully and ready`);
        return; // Success!

      } catch (error) {
        lastError = error;
        logger.error(`[STARTUP] Launch attempt ${attempt}/${retryCount} failed:`, error);

        // Cleanup before retry
        try {
          const instance = this.instances.get(name);
          if (instance) {
            instance.status = 'stopped';
          }
        } catch (cleanupError) {
          logger.warn(`[STARTUP] Cleanup after failed launch:`, cleanupError);
        }

        if (attempt < retryCount) {
          logger.info(`[STARTUP] Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    // All attempts failed
    logger.error(`[STARTUP] Failed to launch instance ${name} after ${retryCount} attempts`);
    throw new Error(`Failed to launch instance ${name}: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Gracefully stop instance với cleanup
   * 1. Disconnect ADB
   * 2. Force stop all apps (optional)
   * 3. Quit instance
   * 4. Verify shutdown
   */
  async stopInstance(name: string, options?: { forceCleanup?: boolean; timeout?: number }): Promise<void> {
    const { forceCleanup = true, timeout = 30000 } = options || {};

    try {
      let instance = this.instances.get(name);

      // If instance not found in Map, try to discover it from LDPlayer
      if (!instance) {
        logger.warn(`Instance ${name} not found in cache, discovering from LDPlayer...`);
        await this.getAllInstancesFromLDConsole();
        instance = this.instances.get(name);

        if (!instance) {
          throw new Error(`Instance ${name} not found`);
        }
        logger.info(`Instance ${name} discovered and registered`);
      }

      logger.info(`[SHUTDOWN] Starting graceful shutdown for instance: ${name}`);

      // Step 1: Disconnect ADB first (prevent connection issues)
      if (instance.status === 'running') {
        try {
          logger.info(`[SHUTDOWN] Disconnecting ADB from port ${instance.port}...`);
          await this.disconnectADB(instance.port);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.warn(`[SHUTDOWN] Failed to disconnect ADB (may already be disconnected):`, error);
        }

        // Step 2: Force stop all apps (optional cleanup)
        if (forceCleanup) {
          try {
            logger.info(`[SHUTDOWN] Cleaning up running apps...`);
            // Go to home screen first
            await execAsync(`"${this.adbPath}" -s 127.0.0.1:${instance.port} shell input keyevent KEYCODE_HOME`).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            logger.warn(`[SHUTDOWN] Failed to cleanup apps:`, error);
          }
        }
      }

      // Step 3: Quit instance
      logger.info(`[SHUTDOWN] Sending quit command to ${name}...`);
      const shutdownPromise = execAsync(`"${this.ldConsolePath}" quit --name "${name}"`);

      // Wait with timeout
      await Promise.race([
        shutdownPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), timeout)
        )
      ]);

      // Step 4: Verify shutdown (check if instance is actually stopped)
      logger.info(`[SHUTDOWN] Verifying shutdown...`);
      let verified = false;
      for (let i = 0; i < 10; i++) {
        try {
          const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`);
          if (!runningListResult.stdout.includes(name)) {
            verified = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          // runninglist might fail, assume stopped
          verified = true;
          break;
        }
      }

      if (!verified) {
        logger.warn(`[SHUTDOWN] Could not verify shutdown for ${name}, but continuing...`);
      }

      // Update status
      instance.status = 'stopped';

      logger.info(`✅ [SHUTDOWN] Instance ${name} stopped successfully`);
    } catch (error) {
      logger.error(`[SHUTDOWN] Failed to stop instance ${name}:`, error);
      throw error;
    }
  }

  /**
   * Gracefully restart instance
   * Safer than stop + launch because it maintains state consistency
   */
  async restartInstance(name: string, options?: { timeout?: number; verifyHealth?: boolean }): Promise<void> {
    const { timeout = 120000, verifyHealth = true } = options || {};

    try {
      logger.info(`[RESTART] Restarting instance: ${name}...`);

      // Stop gracefully
      await this.stopInstance(name, { forceCleanup: false, timeout: 30000 });

      // Wait a bit for complete shutdown
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Launch with health check
      await this.launchInstance(name, { retryCount: 2, verifyHealth, timeout: timeout - 33000 });

      logger.info(`✅ [RESTART] Instance ${name} restarted successfully`);
    } catch (error) {
      logger.error(`[RESTART] Failed to restart instance ${name}:`, error);
      throw error;
    }
  }

  /**
   * Sync instance state from LDPlayer
   * Call this after unexpected shutdowns to resync state
   */
  async syncInstanceState(name: string): Promise<void> {
    try {
      let instance = this.instances.get(name);

      // If instance not found in Map, try to discover it from LDPlayer
      if (!instance) {
        logger.warn(`Instance ${name} not found in cache, discovering from LDPlayer...`);
        await this.getAllInstancesFromLDConsole();
        instance = this.instances.get(name);

        if (!instance) {
          throw new Error(`Instance ${name} not found`);
        }
        logger.info(`Instance ${name} discovered and registered`);
      }

      // Check if instance is actually running
      const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`).catch(() => ({ stdout: '' }));
      const isActuallyRunning = runningListResult.stdout.includes(name);

      // Get ALL connected ADB devices to find actual port
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const deviceLines = devicesResult.stdout.trim().split('\n');

      // Parse all connected ports
      const connectedPorts: number[] = [];
      for (const line of deviceLines) {
        const emulatorMatch = line.match(/emulator-(\d+)\s+device/);
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
        if (emulatorMatch) {
          connectedPorts.push(parseInt(emulatorMatch[1], 10));
        } else if (ipMatch) {
          connectedPorts.push(parseInt(ipMatch[1], 10));
        }
      }

      // Check if instance port is connected (formula-based port)
      let isAdbConnected = connectedPorts.includes(instance.port);
      let actualPort = instance.port;

      // If formula port not connected but instance is running, find actual port
      if (isActuallyRunning && !isAdbConnected && connectedPorts.length > 0) {
        // Try to map to actual ADB port (only one running instance case)
        if (connectedPorts.length === 1) {
          actualPort = connectedPorts[0];
          instance.port = actualPort; // Update stored port
          isAdbConnected = true;
          logger.info(`[SYNC] Updated port for ${name}: formula=${5555 + instance.index * 2} -> actual=${actualPort}`);
        }
      }

      // Update state
      const oldStatus = instance.status;
      instance.status = isActuallyRunning ? 'running' : 'stopped';

      if (oldStatus !== instance.status) {
        logger.info(`[SYNC] Instance ${name} state synced: ${oldStatus} -> ${instance.status}`);
      }

      // If running but ADB not connected, try to reconnect
      if (isActuallyRunning && !isAdbConnected) {
        logger.warn(`[SYNC] Instance ${name} is running but ADB not connected, reconnecting...`);
        try {
          // Try to connect using actual port if we found one
          await this.connectADB(actualPort);

          // Verify connection
          const recheckResult = await execAsync(`"${this.adbPath}" devices`);
          if (recheckResult.stdout.includes(`127.0.0.1:${actualPort}`) ||
              recheckResult.stdout.includes(`emulator-${actualPort}`)) {
            isAdbConnected = true;
            logger.info(`✅ [SYNC] Successfully reconnected ADB for ${name} on port ${actualPort}`);
          }
        } catch (error) {
          logger.error(`[SYNC] Failed to reconnect ADB for ${name}:`, error);
        }
      }

      logger.info(`[SYNC] Instance ${name} state synchronized`);
    } catch (error) {
      logger.error(`[SYNC] Failed to sync state for ${name}:`, error);
      throw error;
    }
  }

  /**
   * Sync all instances state
   */
  async syncAllInstancesState(): Promise<void> {
    logger.info('[SYNC] Syncing all instances state...');
    const instances = [...this.instances.keys()];

    for (const name of instances) {
      try {
        await this.syncInstanceState(name);
      } catch (error) {
        logger.error(`[SYNC] Failed to sync ${name}:`, error);
      }
    }

    logger.info('[SYNC] All instances state synchronized');
  }

  async removeInstance(name: string): Promise<void> {
    try {
      // Check if instance exists in LDPlayer first
      const listResult = await execAsync(`"${this.ldConsolePath}" list2`);
      const exists = listResult.stdout.split('\n').some(line => {
        const parts = line.split(',');
        return parts.length >= 2 && parts[1] === name;
      });

      if (!exists) {
        logger.warn(`[REMOVE] Instance ${name} not found in LDPlayer, skipping physical removal`);
        this.instances.delete(name);
        return;
      }

      // Stop instance if it exists
      try {
        await this.stopInstance(name);
      } catch (stopError) {
        logger.warn(`[REMOVE] Failed to stop instance ${name}, continuing with removal:`, stopError);
      }

      // Remove from LDPlayer
      await execAsync(`"${this.ldConsolePath}" remove --name "${name}"`);
      this.instances.delete(name);
      logger.info(`✅ [REMOVE] Removed instance: ${name}`);
    } catch (error) {
      logger.error(`[REMOVE] Failed to remove instance ${name}:`, error);
      throw error;
    }
  }

  async cloneInstance(sourceName: string, targetName: string): Promise<LDPlayerInstance> {
    try {
      logger.info(`[CLONE] Starting clone process: ${sourceName} → ${targetName}`);

      // Check if target instance already exists
      const listResult = await execAsync(`"${this.ldConsolePath}" list2`);
      const existingInstances = listResult.stdout.trim().split('\n');
      const targetExists = existingInstances.some(line => {
        const parts = line.split(',');
        return parts.length >= 2 && parts[1] === targetName;
      });

      if (targetExists) {
        logger.warn(`[CLONE] Target instance ${targetName} already exists, removing it first...`);
        try {
          await this.removeInstance(targetName);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (removeErr) {
          logger.error(`[CLONE] Failed to remove existing instance ${targetName}:`, removeErr);
          throw new Error(`Instance name "${targetName}" already exists and could not be removed`);
        }
      }

      // Check if source instance is running
      let wasRunning = false;
      try {
        const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`);
        wasRunning = runningListResult.stdout.includes(sourceName);
      } catch (err) {
        logger.warn('[CLONE] Failed to check running instances, assuming instance is stopped');
      }

      // Stop source instance if it's running (ldconsole copy requires instance to be stopped)
      if (wasRunning) {
        logger.info(`[CLONE] Source instance ${sourceName} is running, stopping it temporarily...`);
        await this.stopInstance(sourceName);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Perform the clone using LDPlayer copy command
      // Syntax: ldconsole copy --name <new_name> --from <source_name>
      const copyCommand = `"${this.ldConsolePath}" copy --name "${targetName}" --from "${sourceName}"`;
      logger.info(`[CLONE] Executing: ${copyCommand}`);

      try {
        const copyResult = await execAsync(copyCommand, { timeout: 120000 }); // 2 minute timeout
        logger.info(`[CLONE] Copy command completed`);
        if (copyResult.stdout && copyResult.stdout.trim()) {
          logger.info(`[CLONE] Output: ${copyResult.stdout.trim()}`);
        }
      } catch (copyError: any) {
        logger.warn(`[CLONE] Copy command returned error code ${copyError.code || 'unknown'}`);
        if (copyError.stdout) logger.warn(`[CLONE] stdout: ${copyError.stdout}`);
        if (copyError.stderr) logger.warn(`[CLONE] stderr: ${copyError.stderr}`);
        logger.warn(`[CLONE] Checking if instance was created anyway...`);
      }

      // Restart source instance in background if it was running
      if (wasRunning) {
        logger.info(`[CLONE] Restarting source instance ${sourceName} in background...`);
        this.launchInstance(sourceName).catch(err => {
          logger.warn(`[CLONE] Failed to restart source instance ${sourceName}:`, err);
        });
      }

      // Wait for clone operation to complete and verify
      logger.info(`[CLONE] Waiting for clone to be registered...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get the cloned instance index
      const newListResult = await execAsync(`"${this.ldConsolePath}" list2`);
      const lines = newListResult.stdout.trim().split('\n');
      let instanceIndex = -1;

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2 && parts[1] === targetName) {
          instanceIndex = parseInt(parts[0], 10);
          logger.info(`[CLONE] Found cloned instance: ${targetName} at index ${instanceIndex}`);
          break;
        }
      }

      // Verify instance was created
      if (instanceIndex === -1) {
        logger.error(`[CLONE] Instance ${targetName} not found after copy operation`);
        logger.error(`[CLONE] Available instances:`);
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 2) {
            logger.error(`[CLONE]   - Index ${parts[0]}: ${parts[1]}`);
          }
        }
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

      logger.info(`✅ [CLONE] Successfully cloned ${sourceName} → ${targetName} (index: ${instanceIndex})`);
      logger.info(`[CLONE] The cloned instance includes ALL settings, configurations, and installed apps`);

      return clonedInstance;
    } catch (error) {
      logger.error(`[CLONE] Failed to clone instance from ${sourceName} to ${targetName}:`, error);
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

      // OPTIMIZATION: Check stored instance first (fastest path)
      const storedInstance = this.instances.get(instanceName);
      if (storedInstance) {
        logger.info(`Found stored instance ${instanceName} with port ${storedInstance.port}`);

        // Verify it's still connected
        const devicesResult = await execAsync(`"${this.adbPath}" devices`);
        if (devicesResult.stdout.includes(`127.0.0.1:${storedInstance.port}`) ||
            devicesResult.stdout.includes(`emulator-${storedInstance.port}`)) {
          logger.info(`✅ Using cached port ${storedInstance.port} for instance ${instanceName} (already connected)`);
          return storedInstance.port;
        }
        logger.warn(`Stored port ${storedInstance.port} not connected, will try to connect...`);
      }

      // Get list of ALL connected ADB devices ONCE
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const deviceLines = devicesResult.stdout.trim().split('\n');

      // Parse device ports (deduplicate: "127.0.0.1:5572" and "emulator-5572" are the same device!)
      const connectedPorts = new Set<number>();
      for (const line of deviceLines) {
        // Match both "127.0.0.1:5572" and "emulator-5572"
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
        const emulatorMatch = line.match(/emulator-(\d+)\s+device/);

        if (ipMatch) {
          connectedPorts.add(parseInt(ipMatch[1], 10));
        } else if (emulatorMatch) {
          // emulator-5572 uses port 5572 (same as 127.0.0.1:5572)
          connectedPorts.add(parseInt(emulatorMatch[1], 10));
        }
      }

      const uniquePorts = Array.from(connectedPorts).sort((a, b) => a - b);
      logger.info(`Found ${uniquePorts.length} unique connected ADB devices: ${uniquePorts.join(', ')}`);

      // If we have connected ports, use them immediately (no need to try connecting)
      if (uniquePorts.length > 0) {
        // If stored instance port is in connected ports, use it
        if (storedInstance && uniquePorts.includes(storedInstance.port)) {
          logger.info(`✅ Using stored port ${storedInstance.port} for instance ${instanceName}`);
          return storedInstance.port;
        }

        // If multiple devices, we need to query ldconsole to find the correct mapping
        if (uniquePorts.length > 1) {
          logger.warn(`Multiple devices connected (${uniquePorts.length}), querying ldconsole to match instance ${instanceName}...`);

          // Query ldconsole list2 to get running instances
          try {
            const list2Result = await execAsync(`"${this.ldConsolePath}" list2`);
            const lines = list2Result.stdout.trim().split('\n');

            // Find the instance by name
            let instanceIndex = -1;
            for (const line of lines) {
              const parts = line.split(',');
              if (parts.length >= 2 && parts[1] === instanceName) {
                instanceIndex = parseInt(parts[0], 10);
                break;
              }
            }

            if (instanceIndex !== -1) {
              // Calculate expected port from index
              const expectedPort = 5555 + instanceIndex * 2;

              // Check if expected port is in the list of connected ports
              if (uniquePorts.includes(expectedPort)) {
                logger.info(`✅ Matched instance ${instanceName} (index ${instanceIndex}) to port ${expectedPort}`);
                return expectedPort;
              }

              // If expected port not found, find the closest port
              logger.warn(`Expected port ${expectedPort} not found, trying closest available port...`);
              const closestPort = uniquePorts.reduce((prev, curr) =>
                Math.abs(curr - expectedPort) < Math.abs(prev - expectedPort) ? curr : prev
              );
              logger.info(`✅ Using closest port ${closestPort} for instance ${instanceName}`);
              return closestPort;
            } else {
              logger.warn(`Instance ${instanceName} not found in ldconsole list2, using first available port`);
            }
          } catch (ldError) {
            logger.warn(`Failed to query ldconsole, using first available port:`, ldError);
          }

          // Fallback: use first port if ldconsole query failed
          const port = uniquePorts[0];
          logger.info(`✅ Using first available port ${port} for instance ${instanceName}`);
          return port;
        }

        // Only one device connected
        const port = uniquePorts[0];
        logger.info(`✅ Using port ${port} (only device connected)`);
        return port;
      }

      // NO connected devices - try to connect to common ports (this is the slow path)
      logger.warn(`No ADB devices connected, trying to connect...`);

      // Try stored port first if available
      if (storedInstance) {
        try {
          await Promise.race([
            execAsync(`"${this.adbPath}" connect 127.0.0.1:${storedInstance.port}`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
          ]);

          // Verify connection
          const recheckResult = await execAsync(`"${this.adbPath}" devices`);
          if (recheckResult.stdout.includes(`127.0.0.1:${storedInstance.port}`) ||
              recheckResult.stdout.includes(`emulator-${storedInstance.port}`)) {
            logger.info(`✅ Connected to stored port ${storedInstance.port}`);
            return storedInstance.port;
          }
        } catch (error) {
          logger.debug(`Failed to connect to stored port ${storedInstance.port}, trying other ports...`);
        }
      }

      // Try common ports (last resort)
      const portsToTry = [5555, 5557, 5559, 5561, 5563, 5565, 5567, 5569, 5571, 5573, 5575, 5577, 5579, 5581];

      for (const port of portsToTry) {
        try {
          // Shorter timeout for faster parallel execution
          await Promise.race([
            execAsync(`"${this.adbPath}" connect 127.0.0.1:${port}`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
          ]);

          // Check if connected successfully
          const recheckResult = await execAsync(`"${this.adbPath}" devices`);
          if (recheckResult.stdout.includes(`127.0.0.1:${port}`) || recheckResult.stdout.includes(`emulator-${port}`)) {
            logger.info(`✅ Connected to port ${port}`);
            return port;
          }
        } catch (error) {
          // Port not available, continue to next
        }
      }

      throw new Error(`No ADB devices found. Please ensure instances are running and ADB debugging is enabled.`);

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
      const result = await execAsync(`"${this.adbPath}" disconnect 127.0.0.1:${port}`);
      logger.info(`ADB disconnected from port ${port}`);
    } catch (error: any) {
      // Only log error if it's not "no such device" (device already disconnected)
      if (!error.stderr?.includes('no such device')) {
        logger.error(`Failed to disconnect ADB from port ${port}:`, error);
      } else {
        logger.debug(`ADB device already disconnected from port ${port}`);
      }
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
  // ⚡ NOW USES CONNECTION POOL FOR BETTER PERFORMANCE!
  async executeAdbCommand(portOrSerial: number | string, command: string, options?: {
    timeout?: number;
    skipCache?: boolean;
  }): Promise<string> {
    try {
      // Use connection pool for much faster execution!
      const result = await this.adbPool.execute(portOrSerial, command, options);
      logger.debug(`Executed ADB command on ${portOrSerial}: ${command}`);
      return result;
    } catch (error: any) {
      logger.error(`Failed to execute ADB command on ${portOrSerial}:`, error);
      throw new Error(`ADB command failed: ${error.message || error.stderr || 'Unknown error'}`);
    }
  }

  /**
   * Execute multiple ADB commands in batch (MUCH FASTER!)
   * Use this when you need to run multiple commands sequentially
   */
  async executeBatchAdbCommands(portOrSerial: number | string, commands: string[]): Promise<string[]> {
    try {
      logger.info(`[BATCH] Executing ${commands.length} commands on ${portOrSerial}`);
      const results = await this.adbPool.executeBatch(portOrSerial, commands);
      logger.info(`[BATCH] ✅ Completed ${commands.length} commands`);
      return results;
    } catch (error: any) {
      logger.error(`[BATCH] Failed to execute batch commands on ${portOrSerial}:`, error);
      throw error;
    }
  }

  /**
   * Get ADB pool statistics (for monitoring)
   */
  getADBPoolStats() {
    return this.adbPool.getStats();
  }

  /**
   * Clear ADB cache (force fresh lookups)
   */
  clearADBCache() {
    this.adbPool.clearCache();
    logger.info('ADB cache cleared');
  }

  // ⚡ OPTIMIZED: Faster timeout for simple input commands
  async tap(portOrSerial: number | string, x: number, y: number): Promise<void> {
    await this.executeAdbCommand(portOrSerial, `shell input tap ${x} ${y}`, { timeout: 2000 }); // 2s timeout
    logger.debug(`Tapped at (${x}, ${y}) on ${portOrSerial}`);
  }

  async swipe(portOrSerial: number | string, x1: number, y1: number, x2: number, y2: number, duration: number = 500): Promise<void> {
    await this.executeAdbCommand(portOrSerial, `shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`, { timeout: 3000 }); // 3s timeout
    logger.debug(`Swiped from (${x1}, ${y1}) to (${x2}, ${y2}) on ${portOrSerial}`);
  }

  async inputText(portOrSerial: number | string, text: string): Promise<void> {
    // Escape special characters for shell
    const escapedText = text.replace(/([\\'"` ])/g, '\\$1');
    await this.executeAdbCommand(portOrSerial, `shell input text "${escapedText}"`, { timeout: 3000 }); // 3s timeout
    logger.debug(`Input text on ${portOrSerial}: ${text}`);
  }

  async pressKey(portOrSerial: number | string, keyCode: string): Promise<void> {
    await this.executeAdbCommand(portOrSerial, `shell input keyevent ${keyCode}`, { timeout: 2000 }); // 2s timeout
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

  /**
   * Clear app data (equivalent to pm clear)
   * This will reset the app to its initial state, removing all data, cache, and login sessions
   *
   * @param port - ADB port number
   * @param packageName - App package name (e.g., com.twitter.android)
   */
  async clearAppData(port: number, packageName: string): Promise<void> {
    try {
      await this.executeAdbCommand(port, `shell pm clear ${packageName}`);
      logger.info(`✅ Cleared all data for ${packageName} on port ${port}`);
    } catch (error) {
      logger.error(`Failed to clear app data for ${packageName}:`, error);
      throw error;
    }
  }

  /**
   * Clear app data by instance name and package name
   *
   * @param instanceName - Instance name
   * @param packageName - App package name
   */
  async clearAppDataByInstance(instanceName: string, packageName: string): Promise<void> {
    const instance = this.getInstance(instanceName);
    if (!instance) {
      throw new Error(`Instance ${instanceName} not found`);
    }
    return this.clearAppData(instance.port, packageName);
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
  /**
   * Launch all instances with proper sequencing and error handling
   * Returns detailed results for each instance
   */
  async launchAllInstances(options?: {
    onlyStopped?: boolean;
    delay?: number;
    maxConcurrent?: number; // Max instances to launch concurrently
  }): Promise<{
    successCount: number;
    failCount: number;
    skippedCount: number;
    results: Array<{ instanceName: string; success: boolean; error?: string; skipped?: boolean }>;
  }> {
    const { onlyStopped = true, delay = 3000, maxConcurrent = 3 } = options || {};

    const instances = [...this.instances.values()];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const results: Array<{ instanceName: string; success: boolean; error?: string; skipped?: boolean }> = [];

    // Filter: only launch stopped instances if onlyStopped = true
    const instancesToLaunch = onlyStopped
      ? instances.filter(i => i.status === 'stopped')
      : instances;

    if (instancesToLaunch.length === 0) {
      logger.info('[LAUNCH ALL] No stopped instances to launch');
      return { successCount: 0, failCount: 0, skippedCount: instances.length, results: [] };
    }

    logger.info(`[LAUNCH ALL] Launching ${instancesToLaunch.length} instance(s)...`);

    // Launch instances in batches to avoid system overload
    for (let i = 0; i < instancesToLaunch.length; i += maxConcurrent) {
      const batch = instancesToLaunch.slice(i, i + maxConcurrent);

      logger.info(`[LAUNCH ALL] Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(instancesToLaunch.length / maxConcurrent)} (${batch.length} instances)`);

      // Launch batch concurrently
      const batchPromises = batch.map(async (instance) => {
        try {
          logger.info(`[LAUNCH ALL] Launching ${instance.name}...`);

          await this.launchInstance(instance.name, {
            retryCount: 2,
            verifyHealth: true,
            timeout: 120000
          });

          successCount++;
          results.push({ instanceName: instance.name, success: true });
          logger.info(`[LAUNCH ALL] ✅ Successfully launched ${instance.name}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`[LAUNCH ALL] ❌ Failed to launch ${instance.name}:`, errorMsg);
          failCount++;
          results.push({ instanceName: instance.name, success: false, error: errorMsg });
        }
      });

      // Wait for current batch to complete
      await Promise.all(batchPromises);

      // ✅ CRITICAL: Sync state after each batch to ensure accuracy
      logger.info(`[LAUNCH ALL] Syncing instance states after batch...`);
      for (const instance of batch) {
        try {
          await this.syncInstanceState(instance.name);
        } catch (syncError) {
          logger.warn(`[LAUNCH ALL] Failed to sync state for ${instance.name}:`, syncError);
        }
      }

      // Add delay before next batch (except for the last batch)
      if (i + maxConcurrent < instancesToLaunch.length) {
        logger.info(`[LAUNCH ALL] Waiting ${delay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    skippedCount = instances.length - instancesToLaunch.length;

    // ✅ CRITICAL: Final sync of all instance states
    logger.info(`[LAUNCH ALL] Final sync of all instance states...`);
    await this.syncAllInstancesState();

    logger.info(`[LAUNCH ALL] Complete: ${successCount} launched, ${failCount} failed, ${skippedCount} skipped`);

    return { successCount, failCount, skippedCount, results };
  }

  /**
   * Stop all running instances gracefully with proper sequencing
   * Includes filtering, delays, and error handling
   */
  async stopAllInstances(options?: { onlyRunning?: boolean; delay?: number }): Promise<{
    successCount: number;
    failCount: number;
    skippedCount: number;
  }> {
    const { onlyRunning = true, delay = 3000 } = options || {};

    const instances = [...this.instances.values()];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    // Filter: only stop running instances
    const instancesToStop = onlyRunning
      ? instances.filter(i => i.status === 'running')
      : instances;

    if (instancesToStop.length === 0) {
      logger.info('[STOP ALL] No running instances to stop');
      return { successCount: 0, failCount: 0, skippedCount: instances.length };
    }

    logger.info(`[STOP ALL] Stopping ${instancesToStop.length} instance(s)...`);

    for (let i = 0; i < instancesToStop.length; i++) {
      const instance = instancesToStop[i];

      try {
        logger.info(`[STOP ALL] Stopping ${i + 1}/${instancesToStop.length}: ${instance.name}`);

        await this.stopInstance(instance.name, { forceCleanup: true, timeout: 30000 });
        successCount++;

        logger.info(`[STOP ALL] ✅ Successfully stopped ${instance.name}`);

        // Add delay between stops (except for the last one)
        if (i < instancesToStop.length - 1) {
          logger.info(`[STOP ALL] Waiting ${delay}ms before next stop...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        logger.error(`[STOP ALL] ❌ Failed to stop ${instance.name}:`, error);
        failCount++;

        // Continue with delay even on error to prevent race conditions
        if (i < instancesToStop.length - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.min(delay, 2000)));
        }
      }

      // ✅ CRITICAL: Sync state after each stop to ensure accuracy
      try {
        await this.syncInstanceState(instance.name);
      } catch (syncError) {
        logger.warn(`[STOP ALL] Failed to sync state for ${instance.name}:`, syncError);
      }
    }

    skippedCount = instances.length - instancesToStop.length;

    // ✅ CRITICAL: Final sync of all instance states
    logger.info(`[STOP ALL] Final sync of all instance states...`);
    await this.syncAllInstancesState();

    logger.info(`[STOP ALL] Complete: ${successCount} stopped, ${failCount} failed, ${skippedCount} skipped`);

    return { successCount, failCount, skippedCount };
  }

  // Install app using ldconsole (more reliable than ADB)
  async installAppViaLDConsole(instanceIndex: number, apkPath: string): Promise<void> {
    try {
      // Validate instanceIndex before using
      if (!Number.isInteger(instanceIndex) || instanceIndex < 0) {
        throw new Error(`Invalid instance index: ${instanceIndex}. Must be a non-negative integer.`);
      }

      logger.info(`Installing APK via ldconsole on instance index ${instanceIndex}...`);
      await execAsync(`"${this.ldConsolePath}" installapp --index ${instanceIndex} --filename "${apkPath}"`);
      logger.info(`✅ Installed APK via ldconsole on instance index ${instanceIndex}`);
    } catch (error) {
      logger.error(`❌ Failed to install APK via ldconsole on instance index ${instanceIndex}:`, error);
      throw error;
    }
  }

  // Launch app using ldconsole
  async launchAppViaLDConsole(instanceIndex: number, packageName: string): Promise<void> {
    try {
      // Validate instanceIndex before using
      if (!Number.isInteger(instanceIndex) || instanceIndex < 0) {
        throw new Error(`Invalid instance index: ${instanceIndex}. Must be a non-negative integer.`);
      }

      logger.info(`Launching app ${packageName} via ldconsole on instance index ${instanceIndex}...`);
      await execAsync(`"${this.ldConsolePath}" runapp --index ${instanceIndex} --packagename "${packageName}"`);
      logger.info(`✅ Launched app ${packageName} via ldconsole on instance index ${instanceIndex}`);
    } catch (error) {
      logger.error(`❌ Failed to launch app via ldconsole on instance index ${instanceIndex}:`, error);
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
      const listResult = await execAsync(`"${this.ldConsolePath}" list2`);
      const lines = listResult.stdout.trim().split('\n');

      const instances: Array<{ name: string; index: number; port: number }> = [];

      // Get running instances and their actual ADB ports
      const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`).catch(() => ({ stdout: '' }));
      const runningInstances = runningListResult.stdout.trim().split('\n').filter((line: string) => line.length > 0);

      // Get all connected ADB devices via LDPlayer's ADB (not system ADB!)
      // Use ldconsole adb command to get devices from LDPlayer's internal ADB server
      const devicesResult = await execAsync(`"${this.ldConsolePath}" adb --command "devices"`).catch(() => ({ stdout: '' }));
      const connectedAdbPorts = new Set<number>(); // Set of connected ports

      // Parse devices output: "emulator-5572  device"
      for (const line of devicesResult.stdout.trim().split('\n')) {
        const emulatorMatch = line.match(/emulator-(\d+)\s+device/);
        const ipMatch = line.match(/127\.0\.0\.1:(\d+)\s+device/);
        if (emulatorMatch) {
          const port = parseInt(emulatorMatch[1], 10);
          connectedAdbPorts.add(port);
          logger.debug(`Found ADB device on port ${port}`);
        } else if (ipMatch) {
          const port = parseInt(ipMatch[1], 10);
          connectedAdbPorts.add(port);
          logger.debug(`Found ADB device on port ${port}`);
        }
      }

      logger.info(`Found ${connectedAdbPorts.size} connected ADB devices via ldconsole`);

      // Process each instance
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const index = parseInt(parts[0], 10);
          const name = parts[1];

          // Validate index parsing
          if (isNaN(index) || index < 0) {
            logger.warn(`⚠️ Invalid index parsed for instance ${name}: "${parts[0]}" -> ${index}. Skipping...`);
            continue;
          }

          // Check if instance is running
          const isRunning = runningInstances.includes(name);

          // Calculate expected port based on index formula
          const calculatedPort = 5555 + index * 2;

          let port: number;
          if (isRunning) {
            // For running instances, check if calculated port is actually connected
            if (connectedAdbPorts.has(calculatedPort)) {
              port = calculatedPort;
              logger.info(`✅ Mapped running instance ${name} (index ${index}) to calculated port ${port}`);
            } else {
              // Port not connected - use formula but log warning
              port = calculatedPort;
              logger.warn(`⚠️ Instance ${name} (index ${index}) is running but port ${calculatedPort} not connected. Using formula anyway.`);
            }
          } else {
            // Stopped instance - use formula
            port = calculatedPort;
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

      // CLEANUP: Remove stale instances from cache (instances that no longer exist in LDPlayer)
      const ldPlayerInstanceNames = new Set(instances.map(i => i.name));
      const cachedInstanceNames = [...this.instances.keys()];

      for (const cachedName of cachedInstanceNames) {
        if (!ldPlayerInstanceNames.has(cachedName)) {
          logger.warn(`🗑️ Removing stale instance from cache: ${cachedName} (no longer exists in LDPlayer)`);
          this.instances.delete(cachedName);
        }
      }

      logger.info(`Found ${instances.length} LDPlayer instances (removed ${cachedInstanceNames.length - this.instances.size} stale instances from cache)`);
      return instances;
    } catch (error) {
      logger.error('Failed to get instances from ldconsole:', error);
      throw error;
    }
  }
}

export default LDPlayerController;