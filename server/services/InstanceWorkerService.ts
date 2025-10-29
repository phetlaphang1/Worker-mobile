/**
 * Instance Worker Service
 * Manages instance workers directly using Node.js child processes
 * Replaces PM2 which has issues with environment variables on Windows
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger.js';
import fs from 'fs';

interface WorkerInfo {
  profileId: number;
  instanceName: string;
  adbPort: number;
  process: ChildProcess;
  pid?: number;
  startTime: number;
  restarts: number;
}

export interface InstanceWorkerStatus {
  profileId: number;
  instanceName: string;
  status: 'running' | 'stopped' | 'crashed';
  pid?: number;
  uptime?: number; // milliseconds
  restarts: number;
  memory?: number; // MB
  cpu?: number; // percentage
}

export class InstanceWorkerService {
  private static workers = new Map<number, WorkerInfo>();
  private static LOGS_PATH = path.join(process.cwd(), 'logs', 'workers');
  private static WORKER_SCRIPT = path.join(process.cwd(), 'dist', 'workers', 'instance-worker.js');

  /**
   * Initialize the service and ensure logs directory exists
   */
  static initialize(): void {
    if (!fs.existsSync(this.LOGS_PATH)) {
      fs.mkdirSync(this.LOGS_PATH, { recursive: true });
      logger.info(`[InstanceWorkerService] Created logs directory: ${this.LOGS_PATH}`);
    }

    if (!fs.existsSync(this.WORKER_SCRIPT)) {
      logger.error(`[InstanceWorkerService] Worker script not found: ${this.WORKER_SCRIPT}`);
      logger.error('[InstanceWorkerService] Please run "npm run build" first');
    }
  }

  /**
   * Start a worker for a specific profile
   */
  static startWorker(
    profileId: number,
    instanceName: string,
    adbPort: number
  ): { success: boolean; message: string } {
    try {
      // Check if worker already running
      const existing = this.workers.get(profileId);
      if (existing && existing.process.exitCode === null) {
        return {
          success: true,
          message: `Worker for profile ${profileId} is already running (PID: ${existing.pid})`
        };
      }

      // Check if worker script exists
      if (!fs.existsSync(this.WORKER_SCRIPT)) {
        return {
          success: false,
          message: 'Worker script not found. Please run "npm run build" first.'
        };
      }

      // Create log streams
      const outLogPath = path.join(this.LOGS_PATH, `instance-${profileId}-out.log`);
      const errLogPath = path.join(this.LOGS_PATH, `instance-${profileId}-error.log`);

      const outLog = fs.createWriteStream(outLogPath, { flags: 'a' });
      const errLog = fs.createWriteStream(errLogPath, { flags: 'a' });

      // Spawn worker process with environment variables
      const childProcess = spawn('node', [this.WORKER_SCRIPT], {
        env: {
          ...process.env,
          PROFILE_ID: profileId.toString(),
          INSTANCE_NAME: instanceName,
          ADB_PORT: adbPort.toString(),
          NODE_ENV: process.env.NODE_ENV || 'development'
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false, // Keep attached to parent for proper cleanup
        windowsHide: true
      });

      // Pipe output to log files
      childProcess.stdout?.pipe(outLog);
      childProcess.stderr?.pipe(errLog);

      // Also log to console for debugging
      childProcess.stdout?.on('data', (data) => {
        logger.debug(`[Worker ${profileId}] ${data.toString().trim()}`);
      });

      childProcess.stderr?.on('data', (data) => {
        logger.error(`[Worker ${profileId}] ${data.toString().trim()}`);
      });

      // Handle process exit
      childProcess.on('exit', (code, signal) => {
        const worker = this.workers.get(profileId);
        if (worker) {
          logger.warn(
            `[InstanceWorkerService] Worker ${profileId} exited with code ${code} signal ${signal} (restarts: ${worker.restarts})`
          );

          // Auto-restart if crashed (not manually stopped)
          if (code !== 0 && worker.restarts < 10) {
            logger.info(`[InstanceWorkerService] Auto-restarting worker ${profileId}...`);
            setTimeout(() => {
              const restartResult = this.startWorker(profileId, instanceName, adbPort);
              if (restartResult.success && worker) {
                worker.restarts++;
              }
            }, 5000); // Wait 5 seconds before restart
          } else if (worker.restarts >= 10) {
            logger.error(`[InstanceWorkerService] Worker ${profileId} exceeded max restarts (10), giving up`);
            this.workers.delete(profileId);
          }
        }

        outLog.close();
        errLog.close();
      });

      // Handle process errors
      childProcess.on('error', (error) => {
        logger.error(`[InstanceWorkerService] Worker ${profileId} error:`, error);
      });

      // Store worker info
      const workerInfo: WorkerInfo = {
        profileId,
        instanceName,
        adbPort,
        process: childProcess,
        pid: childProcess.pid,
        startTime: Date.now(),
        restarts: existing ? existing.restarts : 0
      };

      this.workers.set(profileId, workerInfo);

      logger.info(
        `[InstanceWorkerService] Started worker for profile ${profileId} (${instanceName}) on port ${adbPort}, PID: ${childProcess.pid}`
      );

      return {
        success: true,
        message: `Worker started successfully (PID: ${childProcess.pid})`
      };
    } catch (error: any) {
      logger.error(`[InstanceWorkerService] Failed to start worker for profile ${profileId}:`, error);
      return {
        success: false,
        message: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Stop a worker
   */
  static stopWorker(profileId: number): { success: boolean; message: string } {
    try {
      const worker = this.workers.get(profileId);
      if (!worker) {
        return {
          success: true,
          message: `Worker for profile ${profileId} is not running`
        };
      }

      // Kill the process
      if (worker.process.exitCode === null) {
        worker.process.kill('SIGTERM');
        logger.info(`[InstanceWorkerService] Stopped worker ${profileId} (PID: ${worker.pid})`);
      }

      this.workers.delete(profileId);

      return {
        success: true,
        message: `Worker stopped successfully`
      };
    } catch (error: any) {
      logger.error(`[InstanceWorkerService] Failed to stop worker ${profileId}:`, error);
      return {
        success: false,
        message: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Restart a worker
   */
  static restartWorker(
    profileId: number,
    instanceName: string,
    adbPort: number
  ): { success: boolean; message: string } {
    logger.info(`[InstanceWorkerService] Restarting worker ${profileId}...`);

    this.stopWorker(profileId);

    // Wait a bit for clean shutdown
    setTimeout(() => {
      this.startWorker(profileId, instanceName, adbPort);
    }, 1000);

    return {
      success: true,
      message: 'Worker restart initiated'
    };
  }

  /**
   * Get status of a specific worker
   */
  static getWorkerStatus(profileId: number): InstanceWorkerStatus | null {
    const worker = this.workers.get(profileId);
    if (!worker) {
      return null;
    }

    const isRunning = worker.process.exitCode === null;
    const uptime = isRunning ? Date.now() - worker.startTime : undefined;

    return {
      profileId,
      instanceName: worker.instanceName,
      status: isRunning ? 'running' : 'crashed',
      pid: worker.pid,
      uptime,
      restarts: worker.restarts,
      // Memory and CPU would require additional monitoring
      memory: undefined,
      cpu: undefined
    };
  }

  /**
   * Get status of all workers
   */
  static getAllWorkersStatus(): InstanceWorkerStatus[] {
    const statuses: InstanceWorkerStatus[] = [];

    for (const [profileId] of this.workers) {
      const status = this.getWorkerStatus(profileId);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * Stop all workers
   */
  static stopAllWorkers(): { success: boolean; stopped: number; message: string } {
    let stopped = 0;

    for (const [profileId] of this.workers) {
      const result = this.stopWorker(profileId);
      if (result.success) {
        stopped++;
      }
    }

    return {
      success: true,
      stopped,
      message: `Stopped ${stopped} worker(s)`
    };
  }

  /**
   * Start workers for multiple profiles
   */
  static startAllWorkers(
    profiles: Array<{
      id: number;
      instanceName: string;
      port: number;
    }>
  ): {
    success: boolean;
    started: number;
    failed: number;
    skipped: number;
    results: Array<{
      profileId: number;
      status: 'started' | 'failed' | 'skipped';
      message: string;
    }>;
  } {
    logger.info(`[InstanceWorkerService] Starting workers for ${profiles.length} profiles...`);

    let started = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<{
      profileId: number;
      status: 'started' | 'failed' | 'skipped';
      message: string;
    }> = [];

    for (const profile of profiles) {
      const result = this.startWorker(profile.id, profile.instanceName, profile.port);

      if (result.success) {
        if (result.message.includes('already running')) {
          skipped++;
          results.push({
            profileId: profile.id,
            status: 'skipped',
            message: result.message
          });
        } else {
          started++;
          results.push({
            profileId: profile.id,
            status: 'started',
            message: result.message
          });
        }
      } else {
        failed++;
        results.push({
          profileId: profile.id,
          status: 'failed',
          message: result.message
        });
      }
    }

    logger.info(
      `[InstanceWorkerService] Workers started: ${started} started, ${failed} failed, ${skipped} skipped`
    );

    return {
      success: failed === 0,
      started,
      failed,
      skipped,
      results
    };
  }

  /**
   * Get system info for all workers
   */
  static getSystemInfo(): {
    totalWorkers: number;
    runningWorkers: number;
    crashedWorkers: number;
  } {
    const statuses = this.getAllWorkersStatus();
    const running = statuses.filter(s => s.status === 'running').length;
    const crashed = statuses.filter(s => s.status === 'crashed').length;

    return {
      totalWorkers: statuses.length,
      runningWorkers: running,
      crashedWorkers: crashed
    };
  }
}

export default InstanceWorkerService;
