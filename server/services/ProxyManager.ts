/**
 * ProxyManager - Quản lý proxy pool và assignment cho instances
 *
 * Features:
 * - Load proxies từ file hoặc API
 * - Auto-assign proxy cho mỗi instance (1 instance = 1 IP riêng)
 * - Proxy rotation với nhiều strategies
 * - Health check proxies
 * - Sticky assignment (instance luôn dùng cùng 1 proxy)
 */

import fs from 'fs/promises';
import path from 'path';
import { ProxyPool, ProxyConfig, ProxyPoolConfig, loadProxiesFromStrings } from '../types/proxy.js';
import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProxyHealth {
  proxy: ProxyConfig;
  isHealthy: boolean;
  lastCheck: Date;
  failCount: number;
  avgResponseTime?: number;
}

export interface ProxyAssignment {
  instanceName: string;
  proxy: ProxyConfig;
  assignedAt: Date;
  sticky: boolean; // Nếu true, instance sẽ luôn dùng proxy này
}

export class ProxyManager {
  private pool: ProxyPool;
  private assignments: Map<string, ProxyAssignment> = new Map();
  private healthStatus: Map<string, ProxyHealth> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private proxyFilePath: string;

  constructor(config: ProxyPoolConfig, proxyFilePath?: string) {
    this.pool = new ProxyPool(config);
    this.proxyFilePath = proxyFilePath || path.join(process.cwd(), 'data', 'proxies.txt');
  }

  /**
   * Load proxies từ file
   * Format mỗi dòng: type://[username:password@]host:port
   * Example: http://user:pass@1.2.3.4:8080
   */
  async loadProxiesFromFile(filePath?: string): Promise<number> {
    try {
      const file = filePath || this.proxyFilePath;
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Ignore empty lines and comments

      const proxies = loadProxiesFromStrings(lines);

      // Add all proxies to pool
      proxies.forEach(proxy => this.pool.addProxy(proxy));

      logger.info(`Loaded ${proxies.length} proxies from ${file}`);
      return proxies.length;

    } catch (error) {
      logger.error('Failed to load proxies from file:', error);
      throw error;
    }
  }

  /**
   * Save proxies to file
   */
  async saveProxiesToFile(filePath?: string): Promise<void> {
    try {
      const file = filePath || this.proxyFilePath;
      const proxies = this.pool.getAllProxies();

      const lines = proxies.map(p => {
        const auth = p.username && p.password ? `${p.username}:${p.password}@` : '';
        return `${p.type}://${auth}${p.host}:${p.port}`;
      });

      await fs.writeFile(file, lines.join('\n'), 'utf-8');
      logger.info(`Saved ${proxies.length} proxies to ${file}`);

    } catch (error) {
      logger.error('Failed to save proxies to file:', error);
      throw error;
    }
  }

  /**
   * Assign proxy cho instance (sticky assignment)
   * Instance sẽ luôn dùng cùng 1 proxy
   */
  assignProxyToInstance(instanceName: string, sticky: boolean = true): ProxyConfig | null {
    // Nếu đã có assignment và sticky, return proxy cũ
    if (sticky && this.assignments.has(instanceName)) {
      const existing = this.assignments.get(instanceName)!;
      logger.info(`Instance ${instanceName} already has sticky proxy ${existing.proxy.host}:${existing.proxy.port}`);
      return existing.proxy;
    }

    // Get next proxy từ pool
    const proxy = this.pool.getNext();
    if (!proxy) {
      logger.warn(`No proxy available to assign to ${instanceName}`);
      return null;
    }

    // Create assignment
    const assignment: ProxyAssignment = {
      instanceName,
      proxy,
      assignedAt: new Date(),
      sticky
    };

    this.assignments.set(instanceName, assignment);
    logger.info(`Assigned proxy ${proxy.host}:${proxy.port} to instance ${instanceName} (sticky: ${sticky})`);

    return proxy;
  }

  /**
   * Assign proxy cụ thể cho instance (manual assignment)
   */
  assignSpecificProxy(instanceName: string, proxyIndex: number, sticky: boolean = true): ProxyConfig | null {
    const proxy = this.pool.getByIndex(proxyIndex);
    if (!proxy) {
      logger.warn(`Proxy at index ${proxyIndex} not found`);
      return null;
    }

    const assignment: ProxyAssignment = {
      instanceName,
      proxy,
      assignedAt: new Date(),
      sticky
    };

    this.assignments.set(instanceName, assignment);
    logger.info(`Manually assigned proxy ${proxy.host}:${proxy.port} to instance ${instanceName}`);

    return proxy;
  }

  /**
   * Get proxy được assign cho instance
   */
  getAssignedProxy(instanceName: string): ProxyConfig | null {
    const assignment = this.assignments.get(instanceName);
    return assignment ? assignment.proxy : null;
  }

  /**
   * Rotate proxy cho instance (force change)
   * Chỉ dùng khi cần đổi proxy khẩn cấp
   */
  rotateProxyForInstance(instanceName: string): ProxyConfig | null {
    // Remove old assignment
    this.assignments.delete(instanceName);

    // Get new proxy
    return this.assignProxyToInstance(instanceName, true);
  }

  /**
   * Remove proxy assignment
   */
  removeAssignment(instanceName: string): void {
    this.assignments.delete(instanceName);
    logger.info(`Removed proxy assignment for instance ${instanceName}`);
  }

  /**
   * Add proxy to pool
   */
  addProxy(proxy: ProxyConfig): void {
    this.pool.addProxy(proxy);
    logger.info(`Added proxy ${proxy.host}:${proxy.port} to pool`);
  }

  /**
   * Remove proxy from pool
   */
  removeProxy(host: string, port: number): void {
    this.pool.removeProxy(host, port);

    // Remove all assignments using this proxy
    for (const [instanceName, assignment] of this.assignments.entries()) {
      if (assignment.proxy.host === host && assignment.proxy.port === port) {
        this.assignments.delete(instanceName);
        logger.info(`Removed assignment for instance ${instanceName} due to proxy removal`);
      }
    }

    logger.info(`Removed proxy ${host}:${port} from pool`);
  }

  /**
   * Health check proxy bằng cách curl test
   */
  async checkProxyHealth(proxy: ProxyConfig): Promise<boolean> {
    try {
      const auth = proxy.username && proxy.password
        ? `-U ${proxy.username}:${proxy.password}`
        : '';

      const proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`;

      // Test với httpbin.org để check IP
      const command = `curl -x ${proxyUrl} ${auth} --max-time 10 -s https://httpbin.org/ip`;

      const startTime = Date.now();
      const result = await execAsync(command);
      const responseTime = Date.now() - startTime;

      // Parse response
      const json = JSON.parse(result.stdout);
      const proxyIP = json.origin;

      // Update health status
      const key = this.getProxyKey(proxy);
      const health: ProxyHealth = {
        proxy,
        isHealthy: true,
        lastCheck: new Date(),
        failCount: 0,
        avgResponseTime: responseTime
      };

      this.healthStatus.set(key, health);
      logger.info(`Proxy ${proxy.host}:${proxy.port} is healthy (IP: ${proxyIP}, ${responseTime}ms)`);

      return true;

    } catch (error) {
      // Mark as unhealthy
      const key = this.getProxyKey(proxy);
      const existing = this.healthStatus.get(key);

      const health: ProxyHealth = {
        proxy,
        isHealthy: false,
        lastCheck: new Date(),
        failCount: (existing?.failCount || 0) + 1
      };

      this.healthStatus.set(key, health);
      logger.warn(`Proxy ${proxy.host}:${proxy.port} health check failed (fails: ${health.failCount})`);

      return false;
    }
  }

  /**
   * Health check tất cả proxies
   */
  async checkAllProxiesHealth(): Promise<void> {
    logger.info('Starting health check for all proxies...');

    const proxies = this.pool.getAllProxies();
    const promises = proxies.map(proxy => this.checkProxyHealth(proxy));

    await Promise.allSettled(promises);

    const healthyCount = Array.from(this.healthStatus.values())
      .filter(h => h.isHealthy).length;

    logger.info(`Health check completed: ${healthyCount}/${proxies.length} proxies healthy`);
  }

  /**
   * Start auto health check
   */
  startHealthCheck(intervalMs: number = 300000): void {
    if (this.healthCheckInterval) {
      logger.warn('Health check already running');
      return;
    }

    logger.info(`Starting proxy health check every ${intervalMs}ms`);

    // Run immediately
    this.checkAllProxiesHealth();

    // Then run periodically
    this.healthCheckInterval = setInterval(() => {
      this.checkAllProxiesHealth();
    }, intervalMs);
  }

  /**
   * Stop health check
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.info('Stopped proxy health check');
    }
  }

  /**
   * Get proxy key for mapping
   */
  private getProxyKey(proxy: ProxyConfig): string {
    return `${proxy.type}://${proxy.host}:${proxy.port}`;
  }

  /**
   * Get all healthy proxies
   */
  getHealthyProxies(): ProxyConfig[] {
    return Array.from(this.healthStatus.values())
      .filter(h => h.isHealthy)
      .map(h => h.proxy);
  }

  /**
   * Get unhealthy proxies
   */
  getUnhealthyProxies(): ProxyConfig[] {
    return Array.from(this.healthStatus.values())
      .filter(h => !h.isHealthy)
      .map(h => h.proxy);
  }

  /**
   * Get statistics
   */
  getStats() {
    const proxies = this.pool.getAllProxies();
    const healthyProxies = this.getHealthyProxies();
    const unhealthyProxies = this.getUnhealthyProxies();
    const poolStats = this.pool.getStats();

    return {
      total: proxies.length,
      healthy: healthyProxies.length,
      unhealthy: unhealthyProxies.length,
      unchecked: proxies.length - healthyProxies.length - unhealthyProxies.length,
      assignmentsCount: this.assignments.size,
      stickyAssignments: Array.from(this.assignments.values()).filter(a => a.sticky).length,
      poolStats,
      healthStatus: Array.from(this.healthStatus.values()).map(h => ({
        proxy: `${h.proxy.type}://${h.proxy.host}:${h.proxy.port}`,
        isHealthy: h.isHealthy,
        lastCheck: h.lastCheck,
        failCount: h.failCount,
        avgResponseTime: h.avgResponseTime
      })),
      assignmentsList: Array.from(this.assignments.entries()).map(([name, assignment]) => ({
        instanceName: name,
        proxy: `${assignment.proxy.type}://${assignment.proxy.host}:${assignment.proxy.port}`,
        assignedAt: assignment.assignedAt,
        sticky: assignment.sticky
      }))
    };
  }

  /**
   * Get all proxies
   */
  getAllProxies(): ProxyConfig[] {
    return this.pool.getAllProxies();
  }

  /**
   * Get all assignments
   */
  getAllAssignments(): Map<string, ProxyAssignment> {
    return new Map(this.assignments);
  }

  /**
   * Clear all assignments
   */
  clearAllAssignments(): void {
    this.assignments.clear();
    logger.info('Cleared all proxy assignments');
  }
}

export default ProxyManager;
