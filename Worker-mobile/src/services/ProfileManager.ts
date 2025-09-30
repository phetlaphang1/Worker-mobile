import LDPlayerController, { LDPlayerInstance } from '../core/LDPlayerController.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export interface MobileProfile {
  id: string;
  name: string;
  instanceName: string;
  port: number;
  settings: {
    resolution: string;
    dpi: number;
    cpu: number;
    memory: number;
    androidVersion?: string;
  };
  device: {
    imei?: string;
    androidId?: string;
    model?: string;
    manufacturer?: string;
    brand?: string;
  };
  network: {
    useProxy: boolean;
    proxyHost?: string;
    proxyPort?: number;
    proxyUsername?: string;
    proxyPassword?: string;
    proxyType?: 'http' | 'socks5';
  };
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  apps: {
    twitter?: {
      installed: boolean;
      username?: string;
      loggedIn: boolean;
    };
    [key: string]: any;
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  lastUsed?: Date;
  metadata?: Record<string, any>;
}

export class ProfileManager {
  private profiles: Map<string, MobileProfile> = new Map();
  private controller: LDPlayerController;
  private profilesPath: string;

  constructor(controller: LDPlayerController) {
    this.controller = controller;
    this.profilesPath = path.join(process.cwd(), 'data', 'profiles');
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.profilesPath, { recursive: true });
      await this.loadProfiles();
    } catch (error) {
      logger.error('Failed to initialize profile storage:', error);
    }
  }

  // Load profiles from storage
  private async loadProfiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.profilesPath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const profilePath = path.join(this.profilesPath, file);
          const data = await fs.readFile(profilePath, 'utf-8');
          const profile = JSON.parse(data) as MobileProfile;

          // Convert date strings back to Date objects
          profile.createdAt = new Date(profile.createdAt);
          if (profile.lastUsed) {
            profile.lastUsed = new Date(profile.lastUsed);
          }

          this.profiles.set(profile.id, profile);
        }
      }

      logger.info(`Loaded ${this.profiles.size} profiles`);
    } catch (error) {
      logger.error('Failed to load profiles:', error);
    }
  }

  // Save profile to storage
  private async saveProfile(profile: MobileProfile): Promise<void> {
    try {
      const profilePath = path.join(this.profilesPath, `${profile.id}.json`);
      await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));
      logger.debug(`Saved profile ${profile.id}`);
    } catch (error) {
      logger.error(`Failed to save profile ${profile.id}:`, error);
      throw error;
    }
  }

  // Create new profile
  async createProfile(config: {
    name: string;
    settings?: Partial<MobileProfile['settings']>;
    device?: Partial<MobileProfile['device']>;
    network?: Partial<MobileProfile['network']>;
    location?: MobileProfile['location'];
  }): Promise<MobileProfile> {
    try {
      const profileId = this.generateProfileId();
      const instanceName = `Profile_${profileId}`;
      const port = 5555 + this.profiles.size * 2;

      // Default settings
      const defaultSettings = {
        resolution: '720,1280',
        dpi: 240,
        cpu: 2,
        memory: 2048,
        androidVersion: '9'
      };

      // Create profile object
      const profile: MobileProfile = {
        id: profileId,
        name: config.name,
        instanceName,
        port,
        settings: { ...defaultSettings, ...config.settings },
        device: config.device || {},
        network: { useProxy: false, ...config.network },
        location: config.location,
        apps: {},
        status: 'inactive',
        createdAt: new Date()
      };

      // Create LDPlayer instance
      await this.controller.createInstance(instanceName, {
        resolution: profile.settings.resolution,
        dpi: profile.settings.dpi,
        cpu: profile.settings.cpu,
        memory: profile.settings.memory
      });

      // Save profile
      this.profiles.set(profileId, profile);
      await this.saveProfile(profile);

      logger.info(`Created profile: ${profile.name} (${profileId})`);
      return profile;
    } catch (error) {
      logger.error('Failed to create profile:', error);
      throw error;
    }
  }

  // Activate profile (launch instance)
  async activateProfile(profileId: string): Promise<void> {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        throw new Error(`Profile ${profileId} not found`);
      }

      // Launch instance
      await this.controller.launchInstance(profile.instanceName);

      // Configure device settings
      if (profile.device && Object.keys(profile.device).length > 0) {
        await this.controller.setDeviceInfo(profile.port, profile.device);
      }

      // Set proxy if configured
      if (profile.network.useProxy && profile.network.proxyHost && profile.network.proxyPort) {
        await this.controller.setProxy(
          profile.port,
          profile.network.proxyHost,
          profile.network.proxyPort
        );
      }

      // Set location if configured
      if (profile.location) {
        await this.controller.setLocation(
          profile.port,
          profile.location.latitude,
          profile.location.longitude
        );
      }

      // Update profile status
      profile.status = 'active';
      profile.lastUsed = new Date();
      await this.saveProfile(profile);

      logger.info(`Activated profile: ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to activate profile ${profileId}:`, error);
      throw error;
    }
  }

  // Deactivate profile (stop instance)
  async deactivateProfile(profileId: string): Promise<void> {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        throw new Error(`Profile ${profileId} not found`);
      }

      // Stop instance
      await this.controller.stopInstance(profile.instanceName);

      // Update profile status
      profile.status = 'inactive';
      await this.saveProfile(profile);

      logger.info(`Deactivated profile: ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to deactivate profile ${profileId}:`, error);
      throw error;
    }
  }

  // Delete profile
  async deleteProfile(profileId: string): Promise<void> {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        throw new Error(`Profile ${profileId} not found`);
      }

      // Remove instance
      await this.controller.removeInstance(profile.instanceName);

      // Delete profile file
      const profilePath = path.join(this.profilesPath, `${profileId}.json`);
      await fs.unlink(profilePath);

      // Remove from memory
      this.profiles.delete(profileId);

      logger.info(`Deleted profile: ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to delete profile ${profileId}:`, error);
      throw error;
    }
  }

  // Update profile
  async updateProfile(profileId: string, updates: Partial<MobileProfile>): Promise<MobileProfile> {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        throw new Error(`Profile ${profileId} not found`);
      }

      // Merge updates
      Object.assign(profile, updates);

      // Save updated profile
      await this.saveProfile(profile);

      logger.info(`Updated profile: ${profile.name}`);
      return profile;
    } catch (error) {
      logger.error(`Failed to update profile ${profileId}:`, error);
      throw error;
    }
  }

  // Get profile by ID
  getProfile(profileId: string): MobileProfile | undefined {
    return this.profiles.get(profileId);
  }

  // Get all profiles
  getAllProfiles(): MobileProfile[] {
    return Array.from(this.profiles.values());
  }

  // Get active profiles
  getActiveProfiles(): MobileProfile[] {
    return this.getAllProfiles().filter(p => p.status === 'active');
  }

  // Batch operations
  async activateMultipleProfiles(profileIds: string[]): Promise<void> {
    for (const profileId of profileIds) {
      await this.activateProfile(profileId);
      // Add delay between activations
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  async deactivateAllProfiles(): Promise<void> {
    const activeProfiles = this.getActiveProfiles();
    for (const profile of activeProfiles) {
      await this.deactivateProfile(profile.id);
    }
  }

  // Clone profile
  async cloneProfile(profileId: string, newName: string): Promise<MobileProfile> {
    const originalProfile = this.profiles.get(profileId);
    if (!originalProfile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const clonedProfile = await this.createProfile({
      name: newName,
      settings: originalProfile.settings,
      device: originalProfile.device,
      network: originalProfile.network,
      location: originalProfile.location
    });

    logger.info(`Cloned profile ${originalProfile.name} to ${newName}`);
    return clonedProfile;
  }

  // Import/Export profiles
  async exportProfile(profileId: string, exportPath: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    await fs.writeFile(exportPath, JSON.stringify(profile, null, 2));
    logger.info(`Exported profile ${profile.name} to ${exportPath}`);
  }

  async importProfile(importPath: string): Promise<MobileProfile> {
    const data = await fs.readFile(importPath, 'utf-8');
    const importedProfile = JSON.parse(data) as MobileProfile;

    // Generate new ID to avoid conflicts
    importedProfile.id = this.generateProfileId();
    importedProfile.instanceName = `Profile_${importedProfile.id}`;
    importedProfile.port = 5555 + this.profiles.size * 2;

    // Create instance
    await this.controller.createInstance(importedProfile.instanceName, {
      resolution: importedProfile.settings.resolution,
      dpi: importedProfile.settings.dpi,
      cpu: importedProfile.settings.cpu,
      memory: importedProfile.settings.memory
    });

    // Save profile
    this.profiles.set(importedProfile.id, importedProfile);
    await this.saveProfile(importedProfile);

    logger.info(`Imported profile: ${importedProfile.name}`);
    return importedProfile;
  }

  // Helper method to generate unique profile ID
  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get profile statistics
  getStatistics(): {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
  } {
    const profiles = this.getAllProfiles();
    return {
      total: profiles.length,
      active: profiles.filter(p => p.status === 'active').length,
      inactive: profiles.filter(p => p.status === 'inactive').length,
      suspended: profiles.filter(p => p.status === 'suspended').length
    };
  }
}

export default ProfileManager;