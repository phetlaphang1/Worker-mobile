/**
 * PM2 Instance Worker - Simplified Version
 * Dedicated process for each LDPlayer instance
 * Handles task execution via TaskQueue
 */

import TaskQueue, { Task } from '../services/TaskQueue.js';
import { logger } from '../utils/logger.js';
import LDPlayerController from '../core/LDPlayerController.js';
import ProfileManager from '../services/ProfileManager.js';
import DirectMobileScriptService from '../services/DirectMobileScriptService.js';

interface WorkerConfig {
  profileId: number;
  instanceName: string;
  adbPort: number;
}

class InstanceWorker {
  private config: WorkerConfig;
  private taskQueue: TaskQueue;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private ldController: LDPlayerController;
  private profileManager: ProfileManager;
  private scriptService: DirectMobileScriptService;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.taskQueue = TaskQueue.getInstance();

    // Initialize services for this worker
    this.ldController = new LDPlayerController();
    this.profileManager = new ProfileManager(this.ldController);
    this.scriptService = new DirectMobileScriptService(this.ldController, this.profileManager);

    logger.info(`[Worker-${config.profileId}] Initialized for instance ${config.instanceName}`);
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    try {
      this.isRunning = true;
      logger.info(`[Worker-${this.config.profileId}] Starting worker...`);

      // Initialize ProfileManager (load profiles from disk)
      logger.info(`[Worker-${this.config.profileId}] Initializing ProfileManager...`);
      await this.profileManager.initialize();
      logger.info(`[Worker-${this.config.profileId}] ProfileManager initialized`);

      // Start health check interval (every 30 seconds)
      this.checkInterval = setInterval(() => {
        this.healthCheck();
      }, 30000);

      // Listen for tasks from queue
      this.listenForTasks();

      logger.info(`[Worker-${this.config.profileId}] Worker started successfully`);
    } catch (error) {
      logger.error(`[Worker-${this.config.profileId}] Failed to start:`, error);
      throw error;
    }
  }

  /**
   * Health check - log worker status
   */
  private healthCheck(): void {
    const queueSize = this.taskQueue.getQueueSize(this.config.profileId);
    logger.debug(`[Worker-${this.config.profileId}] Health check - Queue size: ${queueSize}`);
  }

  /**
   * Listen for tasks from TaskQueue
   */
  private listenForTasks(): void {
    logger.info(`[Worker-${this.config.profileId}] Listening for tasks from queue...`);

    // Poll the task queue every 2 seconds
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) {
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
        }
        return;
      }

      try {
        // Get next task from queue
        const task = this.taskQueue.getNextTask(this.config.profileId);

        if (task) {
          await this.processTask(task);
        }
      } catch (error) {
        logger.error(`[Worker-${this.config.profileId}] Error polling for tasks:`, error);
      }
    }, 2000);

    // Handle shutdown signals
    process.on('SIGTERM', () => {
      logger.info(`[Worker-${this.config.profileId}] Received SIGTERM, shutting down...`);
      this.stop();
    });

    process.on('SIGINT', () => {
      logger.info(`[Worker-${this.config.profileId}] Received SIGINT, shutting down...`);
      this.stop();
    });
  }

  /**
   * Process a task
   */
  private async processTask(task: Task): Promise<void> {
    logger.info(`[Worker-${this.config.profileId}] Processing task ${task.id} (type: ${task.type})`);

    try {
      if (task.type === 'script') {
        // Script execution task
        logger.info(`[Worker-${this.config.profileId}] Executing script...`);

        const scriptContent = task.payload.scriptContent;
        if (!scriptContent) {
          throw new Error('No script content provided in task payload');
        }

        logger.info(`[Worker-${this.config.profileId}] Script length: ${scriptContent.length} chars`);

        // Execute script using this worker's scriptService instance
        const scriptTask = await this.scriptService.queueScript(scriptContent, this.config.profileId);

        logger.info(`[Worker-${this.config.profileId}] DirectMobileScript task created: ${scriptTask.id}`);

        // Wait for script execution to complete (poll for status)
        const maxWaitTime = 300000; // 5 minutes max
        const startTime = Date.now();
        let scriptCompleted = false;

        while (Date.now() - startTime < maxWaitTime) {
          const currentTask = this.scriptService.getTask(scriptTask.id);

          if (currentTask?.status === 'completed') {
            scriptCompleted = true;
            this.taskQueue.completeTask(task.id, {
              success: true,
              message: 'Script executed successfully',
              logs: currentTask.logs,
              result: currentTask.result
            });
            logger.info(`[Worker-${this.config.profileId}] Script task ${task.id} completed successfully`);
            break;
          } else if (currentTask?.status === 'failed') {
            throw new Error(currentTask.error || 'Script execution failed');
          }

          // Wait 1 second before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!scriptCompleted) {
          throw new Error('Script execution timeout (5 minutes)');
        }

      } else if (task.type === 'command') {
        // Command execution task
        logger.info(`[Worker-${this.config.profileId}] Executing command: ${task.payload.command}`);

        this.taskQueue.completeTask(task.id, {
          success: true,
          message: 'Command executed successfully'
        });
      } else {
        throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error: any) {
      logger.error(`[Worker-${this.config.profileId}] Task ${task.id} failed:`, error);
      this.taskQueue.failTask(task.id, error.message || error);
    }
  }

  /**
   * Stop the worker
   */
  stop(): void {
    try {
      logger.info(`[Worker-${this.config.profileId}] Stopping worker...`);
      this.isRunning = false;

      // Clear intervals
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }

      logger.info(`[Worker-${this.config.profileId}] Worker stopped`);
      process.exit(0);
    } catch (error) {
      logger.error(`[Worker-${this.config.profileId}] Error stopping worker:`, error);
      process.exit(1);
    }
  }

  /**
   * Get worker status
   */
  getStatus(): any {
    return {
      profileId: this.config.profileId,
      instanceName: this.config.instanceName,
      adbPort: this.config.adbPort,
      isRunning: this.isRunning,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queueSize: this.taskQueue.getQueueSize(this.config.profileId),
    };
  }
}

// Main entry point
async function main() {
  try {
    // Get config from PM2 environment variables
    const profileId = parseInt(process.env.PROFILE_ID || '0');
    const instanceName = process.env.INSTANCE_NAME || '';
    const adbPort = parseInt(process.env.ADB_PORT || '0');

    if (!profileId || !instanceName) {
      throw new Error('Missing required environment variables: PROFILE_ID, INSTANCE_NAME');
    }

    logger.info('='.repeat(60));
    logger.info(`Starting PM2 Instance Worker`);
    logger.info(`Profile ID: ${profileId}`);
    logger.info(`Instance Name: ${instanceName}`);
    logger.info(`ADB Port: ${adbPort}`);
    logger.info('='.repeat(60));

    // Create and start worker
    const worker = new InstanceWorker({
      profileId,
      instanceName,
      adbPort,
    });

    await worker.start();

    // Log status every minute
    setInterval(() => {
      const status = worker.getStatus();
      logger.info(`[Worker-${profileId}] Status:`, {
        uptime: `${Math.round(status.uptime)}s`,
        memory: `${Math.round(status.memory.heapUsed / 1024 / 1024)}MB`,
        queueSize: status.queueSize,
      });
    }, 60000);

    // Keep process alive
    await new Promise(() => {}); // Never resolves
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in worker:', reason);
  process.exit(1);
});

// Start the worker
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

export default InstanceWorker;
