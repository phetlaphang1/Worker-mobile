import { logger } from '../utils/logger.js';

/**
 * Resource Manager - Quản lý phân bổ tài nguyên cho instances và scripts
 * Implement pooling, rate limiting, và queue management
 */
export class ResourceManager {
  private maxConcurrentLaunches: number;
  private maxConcurrentScripts: number;
  private launchDelay: number;
  private scriptDelay: number;

  // Tracking
  private activeLaunches: Set<string> = new Set();
  private activeScripts: Set<string> = new Set();

  // Queues
  private launchQueue: Array<{
    id: string;
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  private scriptQueue: Array<{
    id: string;
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    // Load config from environment
    this.maxConcurrentLaunches = parseInt(process.env.MAX_CONCURRENT_LAUNCHES || '3');
    this.maxConcurrentScripts = parseInt(process.env.MAX_CONCURRENT_SCRIPTS || '7');
    this.launchDelay = parseInt(process.env.INSTANCE_LAUNCH_DELAY || '500');
    this.scriptDelay = parseInt(process.env.SCRIPT_START_DELAY || '2000');

    logger.info(`ResourceManager initialized:`, {
      maxConcurrentLaunches: this.maxConcurrentLaunches,
      maxConcurrentScripts: this.maxConcurrentScripts,
      launchDelay: this.launchDelay,
      scriptDelay: this.scriptDelay
    });
  }

  /**
   * Execute instance launch với resource pooling
   */
  async executeLaunch<T>(
    id: string,
    launchFn: () => Promise<T>
  ): Promise<T> {
    logger.debug(`[ResourceManager] Launch request for ${id}, active: ${this.activeLaunches.size}/${this.maxConcurrentLaunches}`);

    // Check if we have capacity
    if (this.activeLaunches.size < this.maxConcurrentLaunches) {
      return this.doLaunch(id, launchFn);
    }

    // Queue if at capacity
    logger.info(`[ResourceManager] Launch queue full, queuing ${id} (queue size: ${this.launchQueue.length})`);
    return new Promise((resolve, reject) => {
      this.launchQueue.push({
        id,
        execute: launchFn,
        resolve,
        reject
      });
    });
  }

  /**
   * Execute script với concurrency control
   */
  async executeScript<T>(
    id: string,
    scriptFn: () => Promise<T>
  ): Promise<T> {
    logger.debug(`[ResourceManager] Script request for ${id}, active: ${this.activeScripts.size}/${this.maxConcurrentScripts}`);

    // Check if we have capacity
    if (this.activeScripts.size < this.maxConcurrentScripts) {
      return this.doExecuteScript(id, scriptFn);
    }

    // Queue if at capacity
    logger.info(`[ResourceManager] Script queue full, queuing ${id} (queue size: ${this.scriptQueue.length})`);
    return new Promise((resolve, reject) => {
      this.scriptQueue.push({
        id,
        execute: scriptFn,
        resolve,
        reject
      });
    });
  }

  /**
   * Batch launch instances với rate limiting
   */
  async batchLaunch<T>(
    items: Array<{ id: string; launchFn: () => Promise<T> }>
  ): Promise<Array<{ id: string; success: boolean; result?: T; error?: any }>> {
    logger.info(`[ResourceManager] Batch launching ${items.length} instances...`);

    const results: Array<{ id: string; success: boolean; result?: T; error?: any }> = [];

    // Process in batches of maxConcurrentLaunches
    for (let i = 0; i < items.length; i += this.maxConcurrentLaunches) {
      const batch = items.slice(i, i + this.maxConcurrentLaunches);
      logger.info(`[ResourceManager] Processing batch ${Math.floor(i / this.maxConcurrentLaunches) + 1}, size: ${batch.length}`);

      // Launch batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (item, index) => {
          // Staggered delay within batch
          if (index > 0) {
            await this.delay(this.launchDelay);
          }
          return this.executeLaunch(item.id, item.launchFn);
        })
      );

      // Collect results
      batchResults.forEach((result, index) => {
        const item = batch[index];
        if (result.status === 'fulfilled') {
          results.push({ id: item.id, success: true, result: result.value });
        } else {
          results.push({ id: item.id, success: false, error: result.reason });
        }
      });

      // Wait before next batch (if not last batch)
      if (i + this.maxConcurrentLaunches < items.length) {
        logger.info(`[ResourceManager] Waiting ${this.launchDelay}ms before next batch...`);
        await this.delay(this.launchDelay);
      }
    }

    logger.info(`[ResourceManager] Batch launch completed: ${results.filter(r => r.success).length}/${items.length} successful`);
    return results;
  }

  /**
   * Batch execute scripts với concurrency control
   */
  async batchExecuteScripts<T>(
    items: Array<{ id: string; scriptFn: () => Promise<T> }>
  ): Promise<Array<{ id: string; success: boolean; result?: T; error?: any }>> {
    logger.info(`[ResourceManager] Batch executing ${items.length} scripts...`);

    const results: Array<{ id: string; success: boolean; result?: T; error?: any }> = [];

    // Process in batches of maxConcurrentScripts
    for (let i = 0; i < items.length; i += this.maxConcurrentScripts) {
      const batch = items.slice(i, i + this.maxConcurrentScripts);
      logger.info(`[ResourceManager] Processing script batch ${Math.floor(i / this.maxConcurrentScripts) + 1}, size: ${batch.length}`);

      // Execute batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (item, index) => {
          // Staggered delay within batch
          if (index > 0) {
            await this.delay(200); // Smaller delay for scripts
          }
          return this.executeScript(item.id, item.scriptFn);
        })
      );

      // Collect results
      batchResults.forEach((result, index) => {
        const item = batch[index];
        if (result.status === 'fulfilled') {
          results.push({ id: item.id, success: true, result: result.value });
        } else {
          results.push({ id: item.id, success: false, error: result.reason });
        }
      });

      // Wait before next batch (if not last batch)
      if (i + this.maxConcurrentScripts < items.length) {
        logger.info(`[ResourceManager] Waiting 500ms before next script batch...`);
        await this.delay(500);
      }
    }

    logger.info(`[ResourceManager] Batch script execution completed: ${results.filter(r => r.success).length}/${items.length} successful`);
    return results;
  }

  /**
   * Internal: Actually launch instance
   */
  private async doLaunch<T>(id: string, launchFn: () => Promise<T>): Promise<T> {
    this.activeLaunches.add(id);
    logger.debug(`[ResourceManager] Starting launch ${id} (active: ${this.activeLaunches.size})`);

    try {
      const result = await launchFn();
      logger.debug(`[ResourceManager] Launch ${id} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`[ResourceManager] Launch ${id} failed:`, error);
      throw error;
    } finally {
      this.activeLaunches.delete(id);
      logger.debug(`[ResourceManager] Launch ${id} released (active: ${this.activeLaunches.size})`);

      // Process next in queue
      this.processLaunchQueue();
    }
  }

  /**
   * Internal: Actually execute script
   */
  private async doExecuteScript<T>(id: string, scriptFn: () => Promise<T>): Promise<T> {
    this.activeScripts.add(id);
    logger.debug(`[ResourceManager] Starting script ${id} (active: ${this.activeScripts.size})`);

    try {
      const result = await scriptFn();
      logger.debug(`[ResourceManager] Script ${id} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`[ResourceManager] Script ${id} failed:`, error);
      throw error;
    } finally {
      this.activeScripts.delete(id);
      logger.debug(`[ResourceManager] Script ${id} released (active: ${this.activeScripts.size})`);

      // Process next in queue
      this.processScriptQueue();
    }
  }

  /**
   * Process launch queue
   */
  private processLaunchQueue() {
    if (this.launchQueue.length === 0) return;
    if (this.activeLaunches.size >= this.maxConcurrentLaunches) return;

    const next = this.launchQueue.shift();
    if (!next) return;

    logger.debug(`[ResourceManager] Processing queued launch ${next.id}`);
    this.doLaunch(next.id, next.execute)
      .then(next.resolve)
      .catch(next.reject);
  }

  /**
   * Process script queue
   */
  private processScriptQueue() {
    if (this.scriptQueue.length === 0) return;
    if (this.activeScripts.size >= this.maxConcurrentScripts) return;

    const next = this.scriptQueue.shift();
    if (!next) return;

    logger.debug(`[ResourceManager] Processing queued script ${next.id}`);
    this.doExecuteScript(next.id, next.execute)
      .then(next.resolve)
      .catch(next.reject);
  }

  /**
   * Get current resource usage
   */
  getStatus() {
    return {
      launches: {
        active: this.activeLaunches.size,
        max: this.maxConcurrentLaunches,
        queued: this.launchQueue.length,
        available: this.maxConcurrentLaunches - this.activeLaunches.size
      },
      scripts: {
        active: this.activeScripts.size,
        max: this.maxConcurrentScripts,
        queued: this.scriptQueue.length,
        available: this.maxConcurrentScripts - this.activeScripts.size
      }
    };
  }

  /**
   * Wait for all active operations to complete
   */
  async waitForIdle(timeout = 60000): Promise<void> {
    const startTime = Date.now();

    while (this.activeLaunches.size > 0 || this.activeScripts.size > 0) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for resource manager to become idle');
      }

      logger.debug(`[ResourceManager] Waiting for idle... launches: ${this.activeLaunches.size}, scripts: ${this.activeScripts.size}`);
      await this.delay(500);
    }

    logger.info('[ResourceManager] All operations completed, resource manager is idle');
  }

  /**
   * Clear all queues (emergency stop)
   */
  clearQueues() {
    logger.warn(`[ResourceManager] Clearing queues: ${this.launchQueue.length} launches, ${this.scriptQueue.length} scripts`);

    // Reject all queued items
    this.launchQueue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.scriptQueue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });

    this.launchQueue = [];
    this.scriptQueue = [];
  }

  /**
   * Utility: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const resourceManager = new ResourceManager();
