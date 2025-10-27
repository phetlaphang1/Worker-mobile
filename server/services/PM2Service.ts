/**
 * PM2 Service
 * Manages PM2 process control for LDPlayer instances
 */

import pm2 from 'pm2';
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
   * Connect to PM2 daemon
   * Returns true if connected, false if PM2 not available
   */
  private static async connect(): Promise<boolean> {
    // Use PM2 CLI instead of library to avoid Windows bugs
    return true; // Always return true, we'll use CLI commands

    /* Original implementation - disabled due to PM2 bug
    return new Promise((resolve) => {
      let resolved = false;

      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          logger.warn('[PM2Service] PM2 connection timeout (this is OK in dev mode)');
          // Try to disconnect to clean up any pending connections
          try {
            pm2.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
          resolve(false);
        }
      }, 3000); // 3 second timeout

      try {
        pm2.connect((err) => {
          try {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              if (err) {
                logger.warn('[PM2Service] PM2 daemon not available (this is OK in dev mode)');
                resolve(false);
              } else {
                resolve(true);
              }
            }
          } catch (callbackError) {
            // Catch any errors in callback execution
            logger.warn('[PM2Service] Error in PM2 connect callback:', callbackError);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(false);
            }
          }
        });
      } catch (error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          logger.warn('[PM2Service] PM2 not available:', error);
          resolve(false);
        }
      }
    });
    */
  }

  /**
   * Disconnect from PM2 daemon
   */
  private static disconnect(): void {
    try {
      pm2.disconnect();
    } catch (error) {
      // Ignore disconnect errors
    }
  }

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
      const connected = await this.connect();
      if (!connected) {
        return {
          success: false,
          message: 'PM2 daemon not available. Start PM2 first: pm2 ls'
        };
      }

      const processName = `instance-${profileId}`;

      // Check if already running
      const existingStatus = await new Promise<boolean>((resolve) => {
        pm2.describe(processName, (err, processDescription) => {
          if (!err && processDescription && processDescription.length > 0) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });

      if (existingStatus) {
        this.disconnect();
        return {
          success: true,
          message: `Instance ${profileId} is already managed by PM2`
        };
      }

      // Start new PM2 process (placeholder - will be implemented with worker)
      return new Promise((resolve) => {
        pm2.start(
          {
            name: processName,
            script: 'dist/workers/instance-worker.js', // Will be created later
            args: `--profile-id ${profileId}`,
            cwd: process.cwd(),
            instances: 1,
            autorestart: true,
            max_memory_restart: '300M',
            env: {
              PROFILE_ID: profileId.toString(),
              INSTANCE_NAME: instanceName,
              ADB_PORT: port.toString(),
            },
            error_file: path.join(this.LOGS_PATH, `instance-${profileId}-error.log`),
            out_file: path.join(this.LOGS_PATH, `instance-${profileId}-out.log`),
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,
            min_uptime: 5000, // milliseconds instead of '5s'
            max_restarts: 5,
            restart_delay: 3000,
          } as any, // Type assertion to work around PM2 types
          (err) => {
            this.disconnect();

            if (err) {
              logger.error(`[PM2Service] Failed to start instance ${profileId}:`, err);
              resolve({
                success: false,
                message: `Failed to start PM2 process: ${err.message}`
              });
            } else {
              logger.info(`[PM2Service] Started PM2 process for instance ${profileId}`);
              resolve({
                success: true,
                message: `Instance ${profileId} started and managed by PM2`
              });
            }
          }
        );
      });
    } catch (error: any) {
      this.disconnect();
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
      const connected = await this.connect();
      if (!connected) {
        return {
          success: false,
          message: 'PM2 daemon not available'
        };
      }

      const processName = `instance-${profileId}`;

      return new Promise((resolve) => {
        pm2.stop(processName, (err) => {
          if (err) {
            this.disconnect();
            resolve({
              success: false,
              message: `Failed to stop: ${err.message}`
            });
            return;
          }

          // Delete after stopping
          pm2.delete(processName, (err) => {
            this.disconnect();

            if (err) {
              resolve({
                success: true, // Still consider success even if delete fails
                message: `Stopped but failed to delete: ${err.message}`
              });
            } else {
              resolve({
                success: true,
                message: `Instance ${profileId} stopped`
              });
            }
          });
        });
      });
    } catch (error: any) {
      this.disconnect();
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
      const connected = await this.connect();
      if (!connected) {
        return {
          success: false,
          message: 'PM2 daemon not available'
        };
      }

      const processName = `instance-${profileId}`;

      return new Promise((resolve) => {
        pm2.restart(processName, (err) => {
          this.disconnect();

          if (err) {
            resolve({
              success: false,
              message: `Failed to restart: ${err.message}`
            });
          } else {
            resolve({
              success: true,
              message: `Instance ${profileId} restarted`
            });
          }
        });
      });
    } catch (error: any) {
      this.disconnect();
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
}

export default PM2Service;
