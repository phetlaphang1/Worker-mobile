// Profiles (Mobile Worker)
export interface Profile {
  id: number;
  name: string;
  isHeadless?: boolean;
  isIncognito?: boolean;
  description?: string;
  browser: string; // android emulator type
  userAgent?: string;
  customUserAgent?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  timezone?: string;
  language?: string;
  useProxy?: boolean;
  proxyType?: string; // http, https, socks5
  proxyHost?: string;
  proxyPort?: string;
  proxyUsername?: string;
  proxyPassword?: string;
  customField?: any;
  localWorkerId?: number; // Worker ID from Task Center
  localProfileId?: number; // Profile ID from Task Center
  status: string; // READY, RUNNING, COMPLETED, FAILED
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export type InsertProfile = Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>;

export type ProfileStatus = "READY" | "RUNNING" | "COMPLETED" | "FAILED";

// Tasks from Task Center API
export interface Task {
  id: number;
  name?: string;
  profileId?: number;
  scriptId?: number;
  subWorkerId?: number;
  description?: string;
  status: string;
  profile?: any;
  script?: any;
  request?: any;
  response?: any;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export type InsertTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

// Task Center API response types
export interface TaskCenterTask {
  id: number;
  name?: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  request?: any;
  response?: any; // Adding new response field
  profile?: {
    id: number;
    description: string;
    userId: number;
    isHeadless: boolean;
    isIncognito: boolean;
    name: string;
    browser: string;
    userAgent: string;
    customUserAgent: string;
    proxy: any;
    customField?: any;
    localWorerkId: number;
    localProfileId: number;
    createdAt: string;
    updatedAt: string;
  };
  script?: {
    id: number;
    name: string;
    content: string;
    description: string;
    size: number;
    createdAt: string;
    updatedAt: string;
  };
}
