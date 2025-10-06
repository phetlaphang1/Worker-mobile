// Instance configuration types for LDPlayer

export interface InstanceConfig {
  // Display & Resolution
  resolution?: string; // "720,1280" or "1080,1920"
  dpi?: number; // 240, 320, 480

  // Hardware
  cpu?: number; // Number of CPU cores
  memory?: number; // RAM in MB

  // Proxy Configuration
  useProxy?: boolean;
  proxyType?: 'http' | 'https' | 'socks5';
  proxyHost?: string;
  proxyPort?: string;
  proxyUsername?: string;
  proxyPassword?: string;

  // Device Info
  manufacturer?: string;
  model?: string;
  androidVersion?: string;

  // Network
  imei?: string;
  imsi?: string;
  simSerial?: string;
  phoneNumber?: string;

  // Custom Settings
  customField?: Record<string, any>;
}

export interface Instance {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  port?: number;
  instanceName?: string;
  apps?: string[];
  config?: InstanceConfig;
  settings?: InstanceConfig; // Alias for backwards compatibility
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateInstanceRequest {
  name: string;
  config?: InstanceConfig;
  selectedApps?: string[];
  autoRunScripts?: Array<{
    scriptName: string;
    scriptData: Record<string, any>;
  }>;
}
