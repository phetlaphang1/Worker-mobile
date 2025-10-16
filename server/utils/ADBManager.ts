import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

/**
 * ADB Manager - Centralized ADB command execution with connection pooling
 *
 * Features:
 * - Command queuing with rate limiting
 * - Result caching to reduce duplicate queries
 * - Connection reuse to prevent daemon overload
 * - Automatic retry with exponential backoff
 */
export class ADBManager {
  private adbPath: string;
  private commandQueue: Array<{
    command: string;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];
  private isProcessing: boolean = false;
  private lastDevicesResult: { stdout: string; timestamp: number } | null = null;
  private devicesCacheDuration: number = 3000; // Cache for 3 seconds
  private commandDelay: number = 100; // 100ms delay between commands
  private maxRetries: number = 3;
  private isHealthy: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // Check health every 30s

  constructor(adbPath?: string) {
    this.adbPath = adbPath || process.env.ADB_PATH || 'D:\\LDPlayer\\LDPlayer9\\adb.exe';
    logger.info(`[ADB Manager] Initialized with ADB path: ${this.adbPath}`);
  }

  /**
   * Execute ADB command with queueing and rate limiting
   */
  async execute(command: string, options?: {
    timeout?: number;
    skipCache?: boolean;
    retries?: number;
  }): Promise<{ stdout: string; stderr: string }> {
    const { timeout = 10000, skipCache = false, retries = this.maxRetries } = options || {};

    // Special handling for 'devices' command - use cache
    if (command.trim() === 'devices' && !skipCache) {
      const cached = this.getCachedDevices();
      if (cached) {
        return cached;
      }
    }

    // Check ADB health before executing
    await this.ensureHealthy();

    // Queue the command
    return new Promise((resolve, reject) => {
      this.commandQueue.push({
        command,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Get cached devices result if available and fresh
   */
  private getCachedDevices(): { stdout: string; stderr: string } | null {
    if (!this.lastDevicesResult) {
      return null;
    }

    const age = Date.now() - this.lastDevicesResult.timestamp;
    if (age > this.devicesCacheDuration) {
      return null;
    }

    logger.debug(`[ADB Manager] Using cached devices result (age: ${age}ms)`);
    return { stdout: this.lastDevicesResult.stdout, stderr: '' };
  }

  /**
   * Process command queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.commandQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const item = this.commandQueue.shift()!;

    try {
      const fullCommand = `"${this.adbPath}" ${item.command}`;
      logger.debug(`[ADB Manager] Executing: ${fullCommand}`);

      const result = await this.executeWithRetry(fullCommand, 10000);

      // Cache devices result
      if (item.command.trim() === 'devices') {
        this.lastDevicesResult = {
          stdout: result.stdout,
          timestamp: Date.now(),
        };
      }

      item.resolve(result);

    } catch (error: any) {
      logger.error(`[ADB Manager] Command failed: ${item.command}`, error);
      item.reject(error);

      // Mark as unhealthy if ADB daemon errors occur
      if (error.message?.includes('cannot connect to daemon') ||
          error.message?.includes('daemon not running')) {
        this.isHealthy = false;
        logger.warn('[ADB Manager] ADB daemon appears unhealthy');
      }
    }

    // Rate limiting - wait before processing next command
    if (this.commandQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, this.commandDelay));
    }

    // Process next command
    this.processQueue();
  }

  /**
   * Execute command with retry logic
   */
  private async executeWithRetry(
    command: string,
    timeout: number,
    attempt: number = 1
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await Promise.race([
        execAsync(command),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Command timeout')), timeout)
        ),
      ]);

      return result;

    } catch (error: any) {
      // Check if it's a daemon error that needs recovery
      if (error.message?.includes('cannot connect to daemon') ||
          error.message?.includes('daemon not running')) {

        if (attempt < this.maxRetries) {
          logger.warn(`[ADB Manager] Daemon error, attempting recovery (${attempt}/${this.maxRetries})...`);

          // Try to restart ADB daemon
          await this.restartDaemon();

          // Wait with exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));

          // Retry
          return this.executeWithRetry(command, timeout, attempt + 1);
        }
      }

      throw error;
    }
  }

  /**
   * Restart ADB daemon
   */
  private async restartDaemon(): Promise<void> {
    try {
      logger.info('[ADB Manager] Killing existing ADB daemon...');

      // Kill all ADB processes
      try {
        await execAsync('powershell -Command "Get-Process adb -ErrorAction SilentlyContinue | Stop-Process -Force"');
      } catch (killError) {
        logger.debug('[ADB Manager] No ADB processes to kill or kill failed');
      }

      // Wait for processes to terminate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start fresh daemon
      logger.info('[ADB Manager] Starting fresh ADB daemon...');
      await execAsync(`"${this.adbPath}" start-server`);

      // Wait for daemon to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      logger.info('[ADB Manager] ADB daemon restarted successfully');

    } catch (error) {
      logger.error('[ADB Manager] Failed to restart ADB daemon:', error);
      throw error;
    }
  }

  /**
   * Ensure ADB is healthy before executing commands
   */
  private async ensureHealthy(): Promise<void> {
    // Skip if recently checked
    const timeSinceCheck = Date.now() - this.lastHealthCheck;
    if (this.isHealthy && timeSinceCheck < this.healthCheckInterval) {
      return;
    }

    logger.debug('[ADB Manager] Performing health check...');

    try {
      // Quick health check - get server version
      const result = await Promise.race([
        execAsync(`"${this.adbPath}" version`),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        ),
      ]);

      if (result.stdout.includes('Android Debug Bridge')) {
        this.isHealthy = true;
        this.lastHealthCheck = Date.now();
        logger.debug('[ADB Manager] Health check passed');
      } else {
        throw new Error('Unexpected version output');
      }

    } catch (error) {
      logger.warn('[ADB Manager] Health check failed, attempting recovery...');
      this.isHealthy = false;
      await this.restartDaemon();
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number;
    isProcessing: boolean;
    isHealthy: boolean;
    lastHealthCheck: Date | null;
    cacheAge: number | null;
  } {
    return {
      queueLength: this.commandQueue.length,
      isProcessing: this.isProcessing,
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck > 0 ? new Date(this.lastHealthCheck) : null,
      cacheAge: this.lastDevicesResult
        ? Date.now() - this.lastDevicesResult.timestamp
        : null,
    };
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.lastDevicesResult = null;
    logger.debug('[ADB Manager] Cache cleared');
  }

  /**
   * Get current command delay setting
   */
  getCommandDelay(): number {
    return this.commandDelay;
  }

  /**
   * Set command delay (ms between commands)
   */
  setCommandDelay(delay: number): void {
    if (delay < 0 || delay > 5000) {
      throw new Error('Command delay must be between 0 and 5000ms');
    }
    this.commandDelay = delay;
    logger.info(`[ADB Manager] Command delay set to ${delay}ms`);
  }

  /**
   * Set devices cache duration
   */
  setDevicesCacheDuration(duration: number): void {
    if (duration < 0 || duration > 60000) {
      throw new Error('Cache duration must be between 0 and 60000ms');
    }
    this.devicesCacheDuration = duration;
    logger.info(`[ADB Manager] Devices cache duration set to ${duration}ms`);
  }
}

// Singleton instance
let adbManagerInstance: ADBManager | null = null;

/**
 * Get or create the global ADB Manager instance
 */
export function getADBManager(): ADBManager {
  if (!adbManagerInstance) {
    adbManagerInstance = new ADBManager();
  }
  return adbManagerInstance;
}

export default ADBManager;
