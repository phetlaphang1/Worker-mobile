/**
 * Proxy Configuration Types
 * Hỗ trợ config proxy từ bên ngoài cho từng instance
 */

export type ProxyType = 'http' | 'https' | 'socks4' | 'socks5';

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: ProxyType;
}

export interface ProxyPoolConfig {
  proxies: ProxyConfig[];
  rotationStrategy: 'round-robin' | 'random' | 'least-used';
  maxUsagePerProxy?: number; // Số lần sử dụng tối đa trước khi rotate
  healthCheckInterval?: number; // ms
}

/**
 * Proxy Pool Manager - Quản lý pool proxies
 */
export class ProxyPool {
  private proxies: ProxyConfig[];
  private currentIndex: number = 0;
  private usageCount: Map<string, number> = new Map();
  private config: ProxyPoolConfig;

  constructor(config: ProxyPoolConfig) {
    this.config = config;
    this.proxies = config.proxies;
  }

  /**
   * Lấy proxy theo strategy
   */
  getNext(): ProxyConfig | null {
    if (this.proxies.length === 0) {
      return null;
    }

    let proxy: ProxyConfig;

    switch (this.config.rotationStrategy) {
      case 'round-robin':
        proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        break;

      case 'random':
        const randomIndex = Math.floor(Math.random() * this.proxies.length);
        proxy = this.proxies[randomIndex];
        break;

      case 'least-used':
        // Tìm proxy ít được dùng nhất
        proxy = this.proxies.reduce((least, current) => {
          const leastCount = this.getUsageCount(least);
          const currentCount = this.getUsageCount(current);
          return currentCount < leastCount ? current : least;
        });
        break;

      default:
        proxy = this.proxies[0];
    }

    // Track usage
    const key = this.getProxyKey(proxy);
    this.usageCount.set(key, this.getUsageCount(proxy) + 1);

    // Check if need to rotate based on max usage
    if (this.config.maxUsagePerProxy) {
      const usage = this.usageCount.get(key) || 0;
      if (usage >= this.config.maxUsagePerProxy) {
        this.usageCount.set(key, 0); // Reset count
      }
    }

    return proxy;
  }

  /**
   * Get proxy by index (for specific assignment)
   */
  getByIndex(index: number): ProxyConfig | null {
    if (index < 0 || index >= this.proxies.length) {
      return null;
    }
    return this.proxies[index];
  }

  /**
   * Lấy số lần proxy đã được sử dụng
   */
  private getUsageCount(proxy: ProxyConfig): number {
    const key = this.getProxyKey(proxy);
    return this.usageCount.get(key) || 0;
  }

  /**
   * Generate unique key cho proxy
   */
  private getProxyKey(proxy: ProxyConfig): string {
    return `${proxy.type}://${proxy.host}:${proxy.port}`;
  }

  /**
   * Thêm proxy vào pool
   */
  addProxy(proxy: ProxyConfig): void {
    this.proxies.push(proxy);
  }

  /**
   * Xóa proxy khỏi pool
   */
  removeProxy(host: string, port: number): void {
    this.proxies = this.proxies.filter(
      p => !(p.host === host && p.port === port)
    );
  }

  /**
   * Get all proxies
   */
  getAllProxies(): ProxyConfig[] {
    return [...this.proxies];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalProxies: this.proxies.length,
      usageStats: Array.from(this.usageCount.entries()).map(([key, count]) => ({
        proxy: key,
        usageCount: count
      }))
    };
  }

  /**
   * Reset usage counts
   */
  resetUsageCounts(): void {
    this.usageCount.clear();
  }
}

/**
 * Format proxy string for LDPlayer console command
 */
export function formatProxyForLDPlayer(proxy: ProxyConfig): string {
  let proxyString = '';

  // LDPlayer proxy format: type://[username:password@]host:port
  if (proxy.username && proxy.password) {
    proxyString = `${proxy.type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  } else {
    proxyString = `${proxy.type}://${proxy.host}:${proxy.port}`;
  }

  return proxyString;
}

/**
 * Parse proxy string từ config file
 * Format: type://[username:password@]host:port
 * Example: http://user:pass@1.2.3.4:8080
 */
export function parseProxyString(proxyString: string): ProxyConfig | null {
  try {
    const regex = /^(https?|socks[45]):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/;
    const match = proxyString.match(regex);

    if (!match) {
      return null;
    }

    const [, type, username, password, host, port] = match;

    return {
      type: type as ProxyType,
      host,
      port: parseInt(port),
      username: username || undefined,
      password: password || undefined
    };
  } catch (error) {
    return null;
  }
}

/**
 * Load proxies từ array of strings
 */
export function loadProxiesFromStrings(proxyStrings: string[]): ProxyConfig[] {
  return proxyStrings
    .map(parseProxyString)
    .filter((p): p is ProxyConfig => p !== null);
}
