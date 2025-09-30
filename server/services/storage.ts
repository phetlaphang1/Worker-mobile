import { integer } from "drizzle-orm/sqlite-core";
import { tasks, profiles, type Task, type InsertTask, type Profile, type InsertProfile } from "../../shared/schema";

export interface IStorage {
  // Task operations
  getTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: Partial<InsertTask> & { request?: any; response?: any }): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  clearAllTasks(): Promise<void>;
  
  // Profile operations
  getProfiles(): Promise<Profile[]>;
  getProfile(id: number): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: number, updates: Partial<InsertProfile> & { updatedAt?: Date }): Promise<Profile | undefined>;
  deleteProfile(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private tasks: Map<number, Task>;
  private profiles: Map<number, Profile>;
  private currentProfileId: number;
  private currentTaskId: number;

  constructor() {
    this.tasks = new Map();
    this.profiles = new Map();
    this.currentProfileId = 1;
    this.currentTaskId = 1;
    
    // Initialize profile ID counter based on existing profiles
    this.initializeProfileCounter();
    // Initialize task ID counter
    this.initializeTaskCounter();
  }

  private async initializeProfileCounter() {
    // Profile loading is now handled by the profiles route
    // The counter starts at 1 and will be incremented when profiles are created
    console.log(`Profile counter initialized, starting ID: ${this.currentProfileId}`);
  }

  private async initializeTaskCounter() {
    // Task loading is now handled by the tasks route
    // The counter starts at 1 and will be incremented when tasks are created
    console.log(`Task counter initialized, starting ID: ${this.currentTaskId}`);
  }

  // Task operations
  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const task: Task = { 
      id: insertTask.id,
      name: insertTask.name || 'Untitled Task',
      description: insertTask.description || '',
      profileId: insertTask.profileId || 0,
      scriptId: insertTask.scriptId || 0,      
      subWorkerId: insertTask.subWorkerId || 0,
      status: insertTask.status || 'NEW',
      profile: typeof insertTask.profile === 'string' ? JSON.parse(insertTask.profile) : insertTask.profile || null,
      script: typeof insertTask.script === 'string' ? JSON.parse(insertTask.script) : insertTask.script || null,
      request: typeof insertTask.request === 'string' ? JSON.parse(insertTask.request) : insertTask.request || null,
      response: typeof insertTask.response === 'string' ? JSON.parse(insertTask.response) : insertTask.response || null,
      createdAt: insertTask.createdAt || new Date(),
      updatedAt: insertTask.updatedAt || null,
    };
    
    this.tasks.set(task.id, task);
    return task;
  }

  async updateTask(id: number, updates: Partial<InsertTask> & { request?: any; response?: any }): Promise<Task | undefined> {
    const task = this.tasks.get(id);    
    if (!task) return undefined;
    
    // Handle JSON string fields
    if (updates.profile && typeof updates.profile === 'string') {
      updates.profile = JSON.parse(updates.profile);
    }
    if (updates.script && typeof updates.script === 'string') {
      updates.script = JSON.parse(updates.script);
    }
    if (updates.request && typeof updates.request === 'string') {
      updates.request = JSON.parse(updates.request);
    }
    if (updates.response && typeof updates.response === 'string') {
      updates.response = JSON.parse(updates.response);
    }
    
    const updatedTask = { ...task, ...updates };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: number): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async clearAllTasks(): Promise<void> {
    this.tasks.clear();
  }

  // Profile operations
  async getProfiles(): Promise<Profile[]> {
    return Array.from(this.profiles.values());
  }

  async getProfileIds(): Promise<number[]> {
    return Array.from(this.profiles.keys()).sort((a, b) => a - b);
  }


  async getProfile(id: number): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    if(!insertProfile.id){
      insertProfile.id = this.currentProfileId++
    }else{
      if(this.currentProfileId <= insertProfile.id){
        this.currentProfileId = insertProfile.id + 1;
      }   
    }
    const profile: Profile = {
      id: parseInt(insertProfile.id!.toString()),        
      name: insertProfile.name,      
      description: insertProfile.description || null,      
      isHeadless: insertProfile.isHeadless || false,
      isIncognito: insertProfile.isIncognito || false,      
      browser: insertProfile.browser || 'chrome-windows',
      userAgent: insertProfile.userAgent || null,
      customUserAgent: insertProfile.customUserAgent || null,
      viewportWidth: insertProfile.viewportWidth || null,
      viewportHeight: insertProfile.viewportHeight || null,
      timezone: insertProfile.timezone || 'UTC',
      language: insertProfile.language || 'en-US',
      useProxy: insertProfile.useProxy || false,
      proxyType: insertProfile.proxyType || 'http',
      proxyHost: insertProfile.proxyHost || null,
      proxyPort: insertProfile.proxyPort || null,
      proxyUsername: insertProfile.proxyUsername || null,
      proxyPassword: insertProfile.proxyPassword || null,
      customField: typeof insertProfile.customField === 'string' ? 
        JSON.parse(insertProfile.customField) : 
        insertProfile.customField || {},
      localWorkerId: insertProfile.localWorkerId || null,
      localProfileId: insertProfile.localProfileId || null,
      status: insertProfile.status || 'NEW',
      createdAt: insertProfile.createdAt || new Date(),
      updatedAt: insertProfile.updatedAt || null,
    };
    
    this.profiles.set(profile.id, profile);
    return profile;
  }

  async updateProfile(id: number, updates: Partial<InsertProfile> & { updatedAt?: Date }): Promise<Profile | undefined> {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;
    
    // Handle JSON string customField
    if (updates.customField && typeof updates.customField === 'string') {
      updates.customField = JSON.parse(updates.customField);
    }
    
    const updatedProfile = { 
      ...profile, 
      ...updates,
      updatedAt: updates.updatedAt || new Date()
    };
    
    this.profiles.set(id, updatedProfile);
    return updatedProfile;
  }

  async deleteProfile(id: number): Promise<boolean> {
    const profile = this.profiles.get(id);
    if (!profile) return false;
    
    // Profile folder deletion is now handled by the profiles route
    
    return this.profiles.delete(id);
  }
}

export const storage = new MemStorage();
