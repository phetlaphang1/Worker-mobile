import LDPlayerController, { LDPlayerInstance } from '../core/LDPlayerController.js';
import ProfileManager from './ProfileManager.js';
import { ProxyPool, ProxyConfig } from '../types/proxy.js';
import { logger } from '../utils/logger.js';

export interface PoolConfig {
  minInstances?: number;
  maxInstances?: number;
  targetInstances?: number;
  instanceTemplate?: string; // Tên instance để clone
  autoScale?: boolean;
  healthCheckInterval?: number; // ms
  instanceConfig?: {
    resolution?: string;
    dpi?: number;
    cpu?: number;
    memory?: number;
  };
  proxyPool?: ProxyPool; // Optional proxy pool
  assignProxyPerInstance?: boolean; // Tự động assign proxy cho mỗi instance
}

export interface InstanceHealth {
  instanceName: string;
  isHealthy: boolean;
  lastCheck: Date;
  uptime?: number;
  errorCount: number;
  status: 'running' | 'stopped' | 'unhealthy' | 'unknown';
}

/**
 * Instance Pool Manager - Quản lý pool instances tự động
 * Auto-scale, health check, recovery
 */
export class InstancePoolManager {
  private controller: LDPlayerController;
  private profileManager: ProfileManager;
  private config: PoolConfig;
  private healthChecks: Map<string, InstanceHealth> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private proxyAssignments: Map<string, ProxyConfig> = new Map(); // instanceName -> proxy

  constructor(
    controller: LDPlayerController,
    profileManager: ProfileManager,
    config: PoolConfig
  ) {
    this.controller = controller;
    this.profileManager = profileManager;
    this.config = {
      minInstances: 1,
      maxInstances: 10,
      targetInstances: 3,
      autoScale: true,
      healthCheckInterval: 60000, // 1 minute
      assignProxyPerInstance: false,
      ...config
    };
  }

  /**
   * Start pool manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('InstancePoolManager is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting InstancePoolManager...');

    // Initialize: scan existing instances
    await this.scanExistingInstances();

    // Auto-scale to target
    if (this.config.autoScale) {
      await this.scaleToTarget();
    }

    // Start health check loop
    this.startHealthCheck();

    logger.info(`InstancePoolManager started. Target: ${this.config.targetInstances} instances`);
  }

  /**
   * Stop pool manager
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    logger.info('InstancePoolManager stopped');
  }

  /**
   * Scan và register existing instances from LDPlayer
   */
  private async scanExistingInstances(): Promise<void> {
    try {
      const instances = await this.controller.getAllInstancesFromLDConsole();
      logger.info(`Scanned ${instances.length} existing LDPlayer instances`);

      // Initialize health checks
      for (const instance of instances) {
        this.healthChecks.set(instance.name, {
          instanceName: instance.name,
          isHealthy: true,
          lastCheck: new Date(),
          errorCount: 0,
          status: 'stopped'
        });
      }
    } catch (error) {
      logger.error('Failed to scan existing instances:', error);
    }
  }

  /**
   * Scale to target number of instances
   */
  async scaleToTarget(): Promise<void> {
    const currentInstances = this.controller.getInstances();
    const currentCount = currentInstances.length;
    const target = this.config.targetInstances!;

    if (currentCount < target) {
      const needed = target - currentCount;
      logger.info(`Scaling up: creating ${needed} new instances...`);
      await this.scaleUp(needed);
    } else if (currentCount > target) {
      const excess = currentCount - target;
      logger.info(`Scaling down: removing ${excess} instances...`);
      await this.scaleDown(excess);
    } else {
      logger.info(`Already at target instance count: ${target}`);
    }
  }

  /**
   * Scale up - Tạo thêm instances
   */
  async scaleUp(count: number): Promise<LDPlayerInstance[]> {
    const currentCount = this.controller.getInstances().length;
    const maxCount = this.config.maxInstances!;

    // Respect max limit
    const actualCount = Math.min(count, maxCount - currentCount);

    if (actualCount <= 0) {
      logger.warn(`Cannot scale up: already at max instances (${maxCount})`);
      return [];
    }

    const newInstances: LDPlayerInstance[] = [];

    for (let i = 0; i < actualCount; i++) {
      try {
        let instance: LDPlayerInstance;

        // Clone từ template nếu có
        if (this.config.instanceTemplate) {
          const targetName = `${this.config.instanceTemplate}_clone_${Date.now()}_${i}`;
          logger.info(`Cloning instance from ${this.config.instanceTemplate} to ${targetName}...`);
          instance = await this.controller.cloneInstance(this.config.instanceTemplate, targetName);
        } else {
          // Tạo mới
          const instanceName = `Worker_${Date.now()}_${i}`;
          logger.info(`Creating new instance: ${instanceName}...`);
          instance = await this.controller.createInstance(instanceName, this.config.instanceConfig);
        }

        // Assign proxy nếu có config
        if (this.config.assignProxyPerInstance && this.config.proxyPool) {
          await this.assignProxyToInstance(instance.name);
        }

        // Initialize health check
        this.healthChecks.set(instance.name, {
          instanceName: instance.name,
          isHealthy: true,
          lastCheck: new Date(),
          errorCount: 0,
          status: 'stopped'
        });

        newInstances.push(instance);

        // Delay between creations để tránh overload
        if (i < actualCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        logger.error(`Failed to create instance ${i + 1}/${actualCount}:`, error);
      }
    }

    logger.info(`Scaled up: created ${newInstances.length} instances`);
    return newInstances;
  }

  /**
   * Scale down - Xóa instances
   */
  async scaleDown(count: number): Promise<void> {
    const instances = this.controller.getInstances();
    const currentCount = instances.length;
    const minCount = this.config.minInstances!;

    // Respect min limit
    const actualCount = Math.min(count, currentCount - minCount);

    if (actualCount <= 0) {
      logger.warn(`Cannot scale down: already at min instances (${minCount})`);
      return;
    }

    // Sort instances by health (remove unhealthy first)
    const sortedInstances = instances.sort((a, b) => {
      const healthA = this.healthChecks.get(a.name);
      const healthB = this.healthChecks.get(b.name);

      if (!healthA || !healthB) return 0;

      // Unhealthy first
      if (healthA.isHealthy !== healthB.isHealthy) {
        return healthA.isHealthy ? 1 : -1;
      }

      // Then by error count
      return healthB.errorCount - healthA.errorCount;
    });

    // Remove instances
    for (let i = 0; i < actualCount; i++) {
      const instance = sortedInstances[i];
      try {
        logger.info(`Removing instance: ${instance.name}...`);
        await this.controller.removeInstance(instance.name);

        // Clean up
        this.healthChecks.delete(instance.name);
        this.proxyAssignments.delete(instance.name);

      } catch (error) {
        logger.error(`Failed to remove instance ${instance.name}:`, error);
      }
    }

    logger.info(`Scaled down: removed ${actualCount} instances`);
  }

  /**
   * Assign proxy cho instance
   */
  async assignProxyToInstance(instanceName: string): Promise<void> {
    if (!this.config.proxyPool) {
      logger.warn('No proxy pool configured');
      return;
    }

    try {
      const proxy = this.config.proxyPool.getNext();
      if (!proxy) {
        logger.warn('No proxy available in pool');
        return;
      }

      await this.controller.setProxyAdvanced(instanceName, proxy);
      this.proxyAssignments.set(instanceName, proxy);

      logger.info(`Assigned proxy ${proxy.host}:${proxy.port} to instance ${instanceName}`);
    } catch (error) {
      logger.error(`Failed to assign proxy to ${instanceName}:`, error);
    }
  }

  /**
   * Health check cho tất cả instances
   */
  private async performHealthCheck(): Promise<void> {
    const instances = this.controller.getInstances();

    for (const instance of instances) {
      try {
        // Check if instance is running
        const isRunning = instance.status === 'running';

        // Get current health
        let health = this.healthChecks.get(instance.name);
        if (!health) {
          health = {
            instanceName: instance.name,
            isHealthy: true,
            lastCheck: new Date(),
            errorCount: 0,
            status: 'unknown'
          };
          this.healthChecks.set(instance.name, health);
        }

        // Update status
        health.lastCheck = new Date();
        health.status = instance.status;

        // Additional health checks (ADB connectivity, etc.)
        if (isRunning) {
          try {
            // Try a simple ADB command
            await this.controller.executeAdbCommand(instance.port, 'shell echo "ping"');
            health.isHealthy = true;
            health.errorCount = 0;
          } catch (error) {
            health.errorCount++;
            if (health.errorCount >= 3) {
              health.isHealthy = false;
              logger.warn(`Instance ${instance.name} is unhealthy (${health.errorCount} errors)`);
            }
          }
        }

      } catch (error) {
        logger.error(`Health check failed for ${instance.name}:`, error);
      }
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.performHealthCheck();
        await this.autoRecover();
      } catch (error) {
        logger.error('Health check interval error:', error);
      }
    }, this.config.healthCheckInterval);

    // Initial health check
    this.performHealthCheck();
  }

  /**
   * Auto-recover unhealthy instances
   */
  private async autoRecover(): Promise<void> {
    const unhealthyInstances = Array.from(this.healthChecks.values())
      .filter(h => !h.isHealthy);

    for (const health of unhealthyInstances) {
      try {
        logger.info(`Attempting to recover unhealthy instance: ${health.instanceName}`);

        // Try to restart
        await this.controller.stopInstance(health.instanceName);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.controller.launchInstance(health.instanceName);

        // Reset health
        health.errorCount = 0;
        health.isHealthy = true;

        logger.info(`Successfully recovered instance: ${health.instanceName}`);

      } catch (error) {
        logger.error(`Failed to recover instance ${health.instanceName}:`, error);

        // If recovery fails too many times, remove and create new
        if (health.errorCount >= 5) {
          logger.warn(`Instance ${health.instanceName} failed recovery too many times, replacing...`);
          await this.replaceInstance(health.instanceName);
        }
      }
    }
  }

  /**
   * Replace a failed instance
   */
  private async replaceInstance(instanceName: string): Promise<void> {
    try {
      // Remove old instance
      await this.controller.removeInstance(instanceName);
      this.healthChecks.delete(instanceName);
      this.proxyAssignments.delete(instanceName);

      // Create new instance
      await this.scaleUp(1);

      logger.info(`Replaced instance: ${instanceName}`);
    } catch (error) {
      logger.error(`Failed to replace instance ${instanceName}:`, error);
    }
  }

  /**
   * Launch all instances trong pool
   */
  async launchAll(): Promise<void> {
    const instances = this.controller.getInstances();

    for (const instance of instances) {
      try {
        if (instance.status !== 'running') {
          logger.info(`Launching instance: ${instance.name}...`);
          await this.controller.launchInstance(instance.name);

          // Delay between launches
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        logger.error(`Failed to launch instance ${instance.name}:`, error);
      }
    }

    logger.info('All instances launched');
  }

  /**
   * Stop all instances trong pool
   */
  async stopAll(): Promise<void> {
    const instances = this.controller.getInstances();

    for (const instance of instances) {
      try {
        if (instance.status === 'running') {
          logger.info(`Stopping instance: ${instance.name}...`);
          await this.controller.stopInstance(instance.name);
        }
      } catch (error) {
        logger.error(`Failed to stop instance ${instance.name}:`, error);
      }
    }

    logger.info('All instances stopped');
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const instances = this.controller.getInstances();
    const healthyCount = Array.from(this.healthChecks.values()).filter(h => h.isHealthy).length;
    const runningCount = instances.filter(i => i.status === 'running').length;
    const proxyAssignedCount = this.proxyAssignments.size;

    return {
      total: instances.length,
      running: runningCount,
      healthy: healthyCount,
      unhealthy: instances.length - healthyCount,
      target: this.config.targetInstances,
      min: this.config.minInstances,
      max: this.config.maxInstances,
      proxiesAssigned: proxyAssignedCount,
      instances: instances.map(i => ({
        name: i.name,
        index: i.index,
        port: i.port,
        status: i.status,
        health: this.healthChecks.get(i.name),
        proxy: this.proxyAssignments.get(i.name)
      }))
    };
  }

  /**
   * Get health status của instance
   */
  getInstanceHealth(instanceName: string): InstanceHealth | undefined {
    return this.healthChecks.get(instanceName);
  }

  /**
   * Get all health checks
   */
  getAllHealthChecks(): InstanceHealth[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Update pool config
   */
  updateConfig(newConfig: Partial<PoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Pool config updated', this.config);
  }
}

export default InstancePoolManager;
