/**
 * PM2 Service
 * Manages PM2 process control for LDPlayer instances
 * Uses PM2 CLI commands instead of library to avoid Windows compatibility issues
 */

import { logger } from '../utils/logger.js';
import path from 'path';

export interface PM2InstanceStatus {
  profileId: number;
  processName: string;
  status: string; // PM2 status can be various values
  pid?: number;
  memory?: number; // in MB
  cpu?: number; // percentage
  uptime?: number; // in milliseconds
  restarts?: number;
}

export class PM2Service {
  private static LOGS_PATH = path.join(process.cwd(), 'logs', 'pm2', 'instances');

  /**
   * Get status of a specific instance
   */
  static async getInstanceStatus(profileId: number): Promise<PM2InstanceStatus | null> {
    try {
      const { execSync } = await import('child_process');
      const processName = `instance-${profileId}`;

      // Use PM2 CLI to avoid Windows library bugs
      const output = execSync('pm2 jlist', { encoding: 'utf-8' });
      const processList = JSON.parse(output);

      // Find the specific instance
      const proc = processList.find((p: any) => p.name === processName);

      if (!proc) {
        return null; // Instance not found
      }

      const pm2Env = proc.pm2_env;
      const monit = proc.monit;

      return {
        profileId,
        processName,
        status: pm2Env?.status || 'stopped',
        pid: proc.pid,
        memory: monit?.memory ? Math.round(monit.memory / 1024 / 1024) : undefined,
        cpu: monit?.cpu,
        uptime: pm2Env?.pm_uptime ? Date.now() - pm2Env.pm_uptime : undefined,
        restarts: pm2Env?.restart_time || 0,
      };
    } catch (error) {
      logger.warn(`[PM2Service] Failed to get status for profile ${profileId}:`, error);
      return null;
    }
  }

  /**
   * Get status of all instances
   */
  static async getAllInstancesStatus(): Promise<PM2InstanceStatus[]> {
    try {
      const { execSync } = await import('child_process');

      // Use PM2 CLI to avoid Windows library bugs
      const output = execSync('pm2 jlist', { encoding: 'utf-8' });
      const processList = JSON.parse(output);

      // Filter only instance processes
      const instances = processList
        .filter((proc: any) => proc.name?.startsWith('instance-'))
        .map((proc: any) => {
          const profileId = parseInt(proc.name!.replace('instance-', ''));
          const pm2Env = proc.pm2_env;
          const monit = proc.monit;

          return {
            profileId,
            processName: proc.name!,
            status: pm2Env?.status || 'stopped',
            pid: proc.pid,
            memory: monit?.memory ? Math.round(monit.memory / 1024 / 1024) : undefined,
            cpu: monit?.cpu,
            uptime: pm2Env?.pm_uptime ? Date.now() - pm2Env.pm_uptime : undefined,
            restarts: pm2Env?.restart_time || 0,
          };
        });

      return instances;
    } catch (error) {
      logger.warn('[PM2Service] Failed to get all instances status:', error);
      return [];
    }
  }

  /**
   * Start an instance via PM2
   * NOTE: This creates a PM2 process but doesn't actually start LDPlayer
   * For now, we'll just return success - actual instance management handled by ProfileManager
   */
  static async startInstance(
    profileId: number,
    instanceName: string,
    port: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { execSync } = await import('child_process');
      const processName = `instance-${profileId}`;

      // Check if already running using CLI
      const existingStatus = await this.getInstanceStatus(profileId);
      if (existingStatus && existingStatus.status === 'online') {
        return {
          success: true,
          message: `Instance ${profileId} is already running`
        };
      }

      // Check if worker script exists
      const workerScript = path.join(process.cwd(), 'dist', 'workers', 'instance-worker.js');
      const fs = await import('fs');
      if (!fs.existsSync(workerScript)) {
        return {
          success: false,
          message: 'Worker script not found. Please build the project first.'
        };
      }

      // Start using PM2 CLI
      const logPath = path.join(this.LOGS_PATH, `instance-${profileId}`);

      // Create logs directory if it doesn't exist
      if (!fs.existsSync(path.dirname(logPath))) {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
      }

      // Use PM2's env flag to ensure environment variables are persisted
      execSync(
        `pm2 start "${workerScript}" --name "${processName}" ` +
        `--output "${logPath}-out.log" ` +
        `--error "${logPath}-error.log" ` +
        `--merge-logs ` +
        `--max-memory-restart 300M ` +
        `--update-env ` +
        `-e PROFILE_ID=${profileId} ` +
        `-e INSTANCE_NAME=${instanceName} ` +
        `-e ADB_PORT=${port}`,
        {
          encoding: 'utf-8',
        }
      );

      logger.info(`[PM2Service] Started PM2 process for instance ${profileId}`);
      return {
        success: true,
        message: `Instance ${profileId} started and managed by PM2`
      };
    } catch (error: any) {
      logger.error(`[PM2Service] Error starting instance ${profileId}:`, error);
      return {
        success: false,
        message: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Stop an instance
   */
  static async stopInstance(profileId: number): Promise<{ success: boolean; message: string }> {
    try {
      const { execSync } = await import('child_process');
      const processName = `instance-${profileId}`;

      // Check if process exists
      const status = await this.getInstanceStatus(profileId);
      if (!status) {
        return {
          success: true,
          message: `Instance ${profileId} is not running`
        };
      }

      // Stop and delete using PM2 CLI
      execSync(`pm2 delete "${processName}"`, { encoding: 'utf-8' });

      logger.info(`[PM2Service] Stopped PM2 process for instance ${profileId}`);
      return {
        success: true,
        message: `Instance ${profileId} stopped`
      };
    } catch (error: any) {
      logger.error(`[PM2Service] Error stopping instance ${profileId}:`, error);
      return {
        success: false,
        message: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Restart an instance
   */
  static async restartInstance(profileId: number): Promise<{ success: boolean; message: string }> {
    try {
      const { execSync } = await import('child_process');
      const processName = `instance-${profileId}`;

      // Check if process exists
      const status = await this.getInstanceStatus(profileId);
      if (!status) {
        return {
          success: false,
          message: `Instance ${profileId} is not running`
        };
      }

      // Restart using PM2 CLI
      execSync(`pm2 restart "${processName}"`, { encoding: 'utf-8' });

      logger.info(`[PM2Service] Restarted PM2 process for instance ${profileId}`);
      return {
        success: true,
        message: `Instance ${profileId} restarted`
      };
    } catch (error: any) {
      logger.error(`[PM2Service] Error restarting instance ${profileId}:`, error);
      return {
        success: false,
        message: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Stop all instances
   */
  static async stopAllInstances(): Promise<{ success: boolean; stopped: number; message: string }> {
    try {
      const allInstances = await this.getAllInstancesStatus();
      let stopped = 0;

      for (const instance of allInstances) {
        const result = await this.stopInstance(instance.profileId);
        if (result.success) {
          stopped++;
        }
      }

      return {
        success: true,
        stopped,
        message: `Stopped ${stopped}/${allInstances.length} instances`
      };
    } catch (error: any) {
      return {
        success: false,
        stopped: 0,
        message: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Get PM2 system info
   */
  static async getSystemInfo(): Promise<{
    totalProcesses: number;
    onlineProcesses: number;
    totalMemory: number; // MB
    totalCpu: number; // percentage
  }> {
    try {
      const instances = await this.getAllInstancesStatus();

      const onlineProcesses = instances.filter(i => i.status === 'online').length;
      const totalMemory = instances.reduce((sum, i) => sum + (i.memory || 0), 0);
      const totalCpu = instances.reduce((sum, i) => sum + (i.cpu || 0), 0);

      return {
        totalProcesses: instances.length,
        onlineProcesses,
        totalMemory,
        totalCpu,
      };
    } catch (error) {
      logger.error('[PM2Service] Failed to get system info:', error);
      return {
        totalProcesses: 0,
        onlineProcesses: 0,
        totalMemory: 0,
        totalCpu: 0,
      };
    }
  }

  /**
   * Spawn PM2 workers for all profiles
   * This creates a dedicated PM2 process for each profile to handle script execution
   */
  static async spawnAllWorkers(profiles: Array<{
    id: number;
    instanceName: string;
    port: number;
  }>): Promise<{
    success: boolean;
    spawned: number;
    failed: number;
    skipped: number;
    results: Array<{
      profileId: number;
      status: 'spawned' | 'failed' | 'skipped';
      message: string;
    }>;
  }> {
    logger.info(`[PM2Service] Starting to spawn workers for ${profiles.length} profiles...`);

    let spawned = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<{
      profileId: number;
      status: 'spawned' | 'failed' | 'skipped';
      message: string;
    }> = [];

    for (const profile of profiles) {
      try {
        // Check if worker already running
        const existingStatus = await this.getInstanceStatus(profile.id);
        if (existingStatus && existingStatus.status === 'online') {
          logger.info(`[PM2Service] Worker for profile ${profile.id} already running, skipping...`);
          skipped++;
          results.push({
            profileId: profile.id,
            status: 'skipped',
            message: 'Worker already running'
          });
          continue;
        }

        // Spawn new worker
        const result = await this.startInstance(
          profile.id,
          profile.instanceName,
          profile.port
        );

        if (result.success) {
          spawned++;
          results.push({
            profileId: profile.id,
            status: 'spawned',
            message: result.message
          });
          logger.info(`[PM2Service] Successfully spawned worker for profile ${profile.id}`);
        } else {
          failed++;
          results.push({
            profileId: profile.id,
            status: 'failed',
            message: result.message
          });
          logger.error(`[PM2Service] Failed to spawn worker for profile ${profile.id}: ${result.message}`);
        }
      } catch (error: any) {
        failed++;
        results.push({
          profileId: profile.id,
          status: 'failed',
          message: error.message || 'Unknown error'
        });
        logger.error(`[PM2Service] Error spawning worker for profile ${profile.id}:`, error);
      }
    }

    const summary = {
      success: failed === 0,
      spawned,
      failed,
      skipped,
      results
    };

    logger.info(`[PM2Service] Spawn workers completed: ${spawned} spawned, ${failed} failed, ${skipped} skipped`);
    return summary;
  }
}

export default PM2Service;
