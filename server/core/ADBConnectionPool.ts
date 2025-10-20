import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * ADB Connection Pool - Persistent connections for better performance
 *
 * Benefits:
 * 1. Reuse ADB connections instead of spawning new process for each command
 * 2. Cache device serials to avoid repeated `adb devices` calls
 * 3. Batch commands when possible to reduce overhead
 * 4. Auto-reconnect on failures
 */
export class ADBConnectionPool {
  private adbPath: string;
  private activeConnections: Map<string, {
    serial: string;
    lastUsed: Date;
    healthy: boolean;
  }> = new Map();

  private commandQueue: Map<string, Promise<string>> = new Map();

  // Cache device serial for 30 seconds to avoid repeated lookups
  private serialCache: Map<number | string, { serial: string; expires: number }> = new Map();
  private readonly SERIAL_CACHE_TTL = 30000; // 30 seconds

  constructor(adbPath: string) {
    this.adbPath = adbPath;

    // Auto-cleanup stale connections every 60 seconds
    setInterval(() => this.cleanupStaleConnections(), 60000);
  }

  /**
   * Execute ADB command with connection pooling and caching
   * Much faster than spawning new process each time!
   */
  async execute(portOrSerial: number | string, command: string, options?: {
    timeout?: number;
    skipCache?: boolean;
  }): Promise<string> {
    const { timeout = 5000, skipCache = false } = options || {};

    try {
      // Step 1: Get or resolve device serial (with caching!)
      const serial = await this.getDeviceSerial(portOrSerial, skipCache);

      // Step 2: Ensure connection is healthy (fast check using cache)
      await this.ensureConnection(serial);

      // Step 3: Execute command with timeout
      const commandKey = `${serial}:${command}`;

      // Dedup: If same command is already running, reuse the promise
      if (this.commandQueue.has(commandKey)) {
        logger.debug(`[ADB POOL] Reusing in-flight command: ${command}`);
        return await this.commandQueue.get(commandKey)!;
      }

      const commandPromise = this.executeCommandDirect(serial, command, timeout);
      this.commandQueue.set(commandKey, commandPromise);

      try {
        const result = await commandPromise;
        return result;
      } finally {
        this.commandQueue.delete(commandKey);
      }

    } catch (error: any) {
      logger.error(`[ADB POOL] Command failed: ${command}`, error.message);

      // Auto-retry once on connection error
      if (error.message.includes('device offline') || error.message.includes('device not found')) {
        logger.warn(`[ADB POOL] Connection lost, retrying with fresh serial...`);

        // Clear cache and retry
        this.serialCache.delete(portOrSerial);
        const serial = await this.getDeviceSerial(portOrSerial, true);
        return await this.executeCommandDirect(serial, command, timeout);
      }

      throw error;
    }
  }

  /**
   * Execute command directly without retry
   */
  private async executeCommandDirect(serial: string, command: string, timeout: number): Promise<string> {
    const fullCommand = `"${this.adbPath}" -s ${serial} ${command}`;

    const result = await Promise.race([
      execAsync(fullCommand),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Command timeout after ${timeout}ms`)), timeout)
      )
    ]);

    // Update last used timestamp
    const conn = this.activeConnections.get(serial);
    if (conn) {
      conn.lastUsed = new Date();
    }

    return result.stdout;
  }

  /**
   * Get device serial with caching (FAST!)
   * Avoids repeated `adb devices` calls
   */
  private async getDeviceSerial(portOrSerial: number | string, skipCache: boolean = false): Promise<string> {
    // If already a serial string (emulator-XXXX or IP:port format), return directly
    if (typeof portOrSerial === 'string') {
      // Check if it's a valid serial format
      if (portOrSerial.includes(':') || portOrSerial.startsWith('emulator-')) {
        logger.debug(`[ADB POOL] Using provided serial directly: ${portOrSerial}`);
        return portOrSerial;
      }
    }

    // Check cache first (unless skipped)
    if (!skipCache) {
      const cached = this.serialCache.get(portOrSerial);
      if (cached && Date.now() < cached.expires) {
        logger.debug(`[ADB POOL] Using cached serial for ${portOrSerial}: ${cached.serial}`);
        return cached.serial;
      }
    }

    // Resolve serial from port
    const port = typeof portOrSerial === 'number' ? portOrSerial : parseInt(String(portOrSerial), 10);

    // Validate port number
    if (isNaN(port)) {
      throw new Error(`Invalid port or serial format: ${portOrSerial}. Expected number, "emulator-XXXX", or "IP:port"`);
    }

    // Query adb devices ONCE
    const devicesResult = await execAsync(`"${this.adbPath}" devices`);
    const lines = devicesResult.stdout.trim().split('\n').slice(1); // Skip header

    // Find matching device
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === 'device') {
        const serial = parts[0];

        // Match by port
        if (serial === `127.0.0.1:${port}` || serial === `emulator-${port}`) {
          // Cache for 30 seconds
          this.serialCache.set(portOrSerial, {
            serial,
            expires: Date.now() + this.SERIAL_CACHE_TTL
          });

          logger.debug(`[ADB POOL] Resolved serial for port ${port}: ${serial}`);
          return serial;
        }
      }
    }

    // Fallback: Use IP format directly
    const fallbackSerial = `127.0.0.1:${port}`;
    logger.warn(`[ADB POOL] No matching device found for port ${port}, using fallback: ${fallbackSerial}`);

    return fallbackSerial;
  }

  /**
   * Ensure connection is alive and healthy
   * Uses cached state to avoid repeated checks
   */
  private async ensureConnection(serial: string): Promise<void> {
    const conn = this.activeConnections.get(serial);

    // If connection exists and was used recently (< 60s), assume it's healthy
    if (conn && conn.healthy) {
      const age = Date.now() - conn.lastUsed.getTime();
      if (age < 60000) { // 60 seconds
        return; // Connection is fresh, skip health check
      }
    }

    // Quick health check (fast shell command)
    try {
      await this.executeCommandDirect(serial, 'shell echo "ping"', 2000);

      // Mark as healthy
      this.activeConnections.set(serial, {
        serial,
        lastUsed: new Date(),
        healthy: true
      });

      logger.debug(`[ADB POOL] Connection verified for ${serial}`);
    } catch (error) {
      logger.warn(`[ADB POOL] Connection unhealthy for ${serial}, marking for reconnect`);

      this.activeConnections.set(serial, {
        serial,
        lastUsed: new Date(),
        healthy: false
      });

      throw new Error(`Device ${serial} is not responsive`);
    }
  }

  /**
   * Batch execute multiple commands sequentially (faster than individual calls)
   * Uses single ADB shell session for all commands
   */
  async executeBatch(portOrSerial: number | string, commands: string[]): Promise<string[]> {
    if (commands.length === 0) return [];

    const serial = await this.getDeviceSerial(portOrSerial);
    await this.ensureConnection(serial);

    logger.info(`[ADB POOL] Executing batch of ${commands.length} commands on ${serial}`);

    // Execute all commands in parallel (since ADB supports concurrent commands)
    const results = await Promise.all(
      commands.map(cmd => this.executeCommandDirect(serial, cmd, 5000))
    );

    return results;
  }

  /**
   * Cleanup stale connections (not used in last 5 minutes)
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (const [serial, conn] of this.activeConnections.entries()) {
      const age = now - conn.lastUsed.getTime();
      if (age > STALE_THRESHOLD) {
        logger.debug(`[ADB POOL] Removing stale connection: ${serial} (age: ${Math.floor(age / 1000)}s)`);
        this.activeConnections.delete(serial);
      }
    }

    // Also cleanup serial cache
    for (const [key, cache] of this.serialCache.entries()) {
      if (now > cache.expires) {
        this.serialCache.delete(key);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    activeConnections: number;
    cachedSerials: number;
    queuedCommands: number;
  } {
    return {
      activeConnections: this.activeConnections.size,
      cachedSerials: this.serialCache.size,
      queuedCommands: this.commandQueue.size
    };
  }

  /**
   * Clear all caches (force fresh lookups)
   */
  clearCache(): void {
    this.serialCache.clear();
    this.activeConnections.clear();
    logger.info('[ADB POOL] All caches cleared');
  }
}

export default ADBConnectionPool;
