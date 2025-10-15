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
            throw new Error(`Instance ${name} not found`);
          }
          logger.info(`Instance ${name} discovered and registered`);
        }

        logger.info(`[STARTUP] Launching instance: ${name} (attempt ${attempt}/${retryCount})...`);

        // Step 1: Launch instance
        const launchPromise = execAsync(`"${this.ldConsolePath}" launch --name "${name}"`);

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

      // Check ADB connectivity
      const devicesResult = await execAsync(`"${this.adbPath}" devices`);
      const isAdbConnected = devicesResult.stdout.includes(`127.0.0.1:${instance.port}`) ||
                            devicesResult.stdout.includes(`emulator-${instance.port}`);

      // Update state
      const oldStatus = instance.status;
      instance.status = isActuallyRunning ? 'running' : 'stopped';

      if (oldStatus !== instance.status) {
        logger.info(`[SYNC] Instance ${name} state synced: ${oldStatus} -> ${instance.status}`);
      }

      // If running but ADB not connected, reconnect
      if (isActuallyRunning && !isAdbConnected) {
        logger.warn(`[SYNC] Instance ${name} is running but ADB not connected, reconnecting...`);
        try {
          await this.connectADB(instance.port);
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
    }

    skippedCount = instances.length - instancesToStop.length;

    logger.info(`[STOP ALL] Complete: ${successCount} stopped, ${failCount} failed, ${skippedCount} skipped`);

    return { successCount, failCount, skippedCount };
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
      const listResult = await execAsync(`"${this.ldConsolePath}" list2`);
      const lines = listResult.stdout.trim().split('\n');

      const instances: Array<{ name: string; index: number; port: number }> = [];

      // Get running instances and their actual ADB ports
      const runningListResult = await execAsync(`"${this.ldConsolePath}" runninglist`).catch(() => ({ stdout: '' }));
      const runningInstances = runningListResult.stdout.trim().split('\n').filter((line: string) => line.length > 0);

      // Get all connected ADB devices via LDPlayer's ADB (not system ADB!)
      // Use ldconsole adb command to get devices from LDPlayer's internal ADB server
      const devicesResult = await execAsync(`"${this.ldConsolePath}" adb --command "devices"`).catch(() => ({ stdout: '' }));
      const devicePorts = new Map<string, number>(); // instanceName -> port mapping

      // Parse devices output: "emulator-5572  device"
      for (const line of devicesResult.stdout.trim().split('\n')) {
        const emulatorMatch = line.match(/emulator-(\d+)\s+device/);
        if (emulatorMatch) {
          const port = parseInt(emulatorMatch[1], 10);
          devicePorts.set(`port_${devicePorts.size}`, port);
          logger.debug(`Found ADB device on port ${port}`);
        }
      }

      logger.info(`Found ${devicePorts.size} ADB devices via ldconsole`);

      // Convert devicePorts Map to Array of ports
      const adbPorts = Array.from(devicePorts.values());

      let runningIndex = 0;
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const index = parseInt(parts[0], 10);
          const name = parts[1];

          // Check if instance is running
          const isRunning = runningInstances.includes(name);

          // Use actual ADB port if running, otherwise use formula
          let port: number;
          if (isRunning && runningIndex < adbPorts.length) {
            port = adbPorts[runningIndex];
            logger.info(`Mapped running instance ${name} (index ${index}) to ADB port ${port}`);
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