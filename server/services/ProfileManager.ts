import LDPlayerController, { LDPlayerInstance } from '../core/LDPlayerController.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { APPS_CONFIG, getAutoInstallApps } from '../config/apps.config.js';

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
  private scriptExecutor: any; // Will be injected later

  constructor(controller: LDPlayerController) {
    this.controller = controller;
    this.profilesPath = path.join(process.cwd(), 'data', 'profiles');
    this.initializeStorage();
  }

  // Inject script executor (to avoid circular dependency)
  setScriptExecutor(scriptExecutor: any): void {
    this.scriptExecutor = scriptExecutor;
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
        resolution: '360,640',
        dpi: 160,
        cpu: 1,
        memory: 1024,
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

      // Auto-install apps from config
      await this.autoInstallApps(profileId);

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

      // Auto-install Twitter if not installed
      if (!profile.apps.twitter?.installed) {
        logger.info(`Installing Twitter on profile: ${profile.name}`);
        await this.installTwitterApp(profileId);
      }

      // Update profile status
      profile.status = 'active';
      profile.lastUsed = new Date();
      await this.saveProfile(profile);

      // Auto-execute assigned scripts OR launch Google app
      const autoRunScripts = profile.metadata?.autoRunScripts || [];
      if (autoRunScripts.length > 0) {
        // Execute auto-run scripts
        logger.info(`Auto-executing ${autoRunScripts.length} script(s) for ${profile.name}`);
        await this.executeAutoRunScripts(profileId, autoRunScripts);
      } else {
        // No scripts assigned, just launch Google app
        await this.autoLaunchApp(profileId);
      }

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

  // Clone profile (including apps)
  async cloneProfile(profileId: string, newName: string, options?: {
    copyApps?: boolean;
    launchAndSetup?: boolean;
  }): Promise<MobileProfile> {
    const originalProfile = this.profiles.get(profileId);
    if (!originalProfile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Create new profile with same settings
    const clonedProfile = await this.createProfile({
      name: newName,
      settings: originalProfile.settings,
      device: originalProfile.device,
      network: originalProfile.network,
      location: originalProfile.location
    });

    // Copy apps if requested
    if (options?.copyApps && originalProfile.apps) {
      logger.info(`Cloning apps from ${originalProfile.name} to ${newName}`);

      // Use LDPlayer copy command to clone instance (faster than reinstalling apps)
      try {
        await this.controller.cloneInstance(originalProfile.instanceName, clonedProfile.instanceName);

        // Update apps status
        clonedProfile.apps = JSON.parse(JSON.stringify(originalProfile.apps));
        await this.saveProfile(clonedProfile);

        logger.info(`Apps cloned successfully`);
      } catch (error) {
        logger.warn('Failed to clone apps, will install manually on activation');
      }
    }

    // Auto-launch and setup if requested
    if (options?.launchAndSetup) {
      await this.activateProfile(clonedProfile.id);
    }

    logger.info(`Cloned profile ${originalProfile.name} to ${newName}`);
    return clonedProfile;
  }

  // Create base profile with Twitter pre-installed
  async createBaseProfile(name: string = 'Base Profile'): Promise<MobileProfile> {
    logger.info('Creating base profile with Twitter...');

    const profile = await this.createProfile({
      name,
      settings: {
        resolution: '360,640',
        dpi: 160,
        cpu: 1,
        memory: 1024
      }
    });

    // Launch and install Twitter
    await this.activateProfile(profile.id);

    logger.info('Base profile created. You can clone this for new profiles.');
    return profile;
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

  // Install Twitter app on profile
  async installTwitterApp(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    try {
      // Twitter package name
      const twitterPackage = 'com.twitter.android';

      // Check if Twitter APK exists
      const apkPath = process.env.TWITTER_APK_PATH || './apks/twitter.apk';

      logger.info(`Installing Twitter APK from: ${apkPath}`);
      await this.controller.installAPK(profile.port, apkPath);

      // Update profile
      profile.apps.twitter = {
        installed: true,
        loggedIn: false,
        packageName: twitterPackage
      } as any;

      await this.saveProfile(profile);
      logger.info(`Twitter installed on profile: ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to install Twitter on profile ${profileId}:`, error);
      // Don't throw - just log warning
      logger.warn('Continue without Twitter. Download APK and set TWITTER_APK_PATH in .env');
    }
  }

  // Install multiple apps at once
  async installApps(profileId: string, apps: Array<{ name: string; apkPath: string; packageName: string }>): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    for (const app of apps) {
      try {
        logger.info(`Installing ${app.name} on profile: ${profile.name}`);
        await this.controller.installAPK(profile.port, app.apkPath);

        profile.apps[app.name.toLowerCase()] = {
          installed: true,
          packageName: app.packageName
        };

        logger.info(`${app.name} installed successfully`);
      } catch (error) {
        logger.error(`Failed to install ${app.name}:`, error);
      }
    }

    await this.saveProfile(profile);
  }

  // Auto-install apps from config
  private async autoInstallApps(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    // Get selected apps from profile metadata
    const selectedApps = profile.metadata?.selectedApps || [];

    // If selectedApps specified, install those apps
    if (selectedApps.length > 0) {
      logger.info(`Installing ${selectedApps.length} selected apps on profile: ${profile.name}`);
      await this.installSelectedApps(profileId, selectedApps);
      return;
    }

    // Otherwise, use auto-install from config
    const appsToInstall = getAutoInstallApps();
    if (appsToInstall.length === 0) {
      logger.info('No apps configured for auto-install');
      return;
    }

    logger.info(`Auto-installing ${appsToInstall.length} apps on profile: ${profile.name}`);

    for (const appConfig of appsToInstall) {
      try {
        // Check if app already installed
        const isInstalled = await this.controller.isAppInstalled(
          profile.port,
          appConfig.packageName
        );

        if (isInstalled) {
          logger.info(`${appConfig.name} already installed on ${profile.name}`);
          profile.apps[appConfig.name.toLowerCase()] = {
            installed: true,
            packageName: appConfig.packageName,
          };
          continue;
        }

        // Check if APK file exists
        const apkPath = path.resolve(process.cwd(), appConfig.apkPath);
        try {
          await fs.access(apkPath);
        } catch {
          logger.warn(`APK not found: ${apkPath}. Skipping ${appConfig.name}`);
          continue;
        }

        // Install APK
        logger.info(`Installing ${appConfig.name} from ${apkPath}...`);
        await this.controller.installAPK(profile.port, apkPath);

        // Update profile
        profile.apps[appConfig.name.toLowerCase()] = {
          installed: true,
          packageName: appConfig.packageName,
        };

        logger.info(`${appConfig.name} installed successfully on ${profile.name}`);
      } catch (error) {
        logger.error(`Failed to install ${appConfig.name}:`, error);
      }
    }

    await this.saveProfile(profile);
  }

  // Install selected apps from filenames
  private async installSelectedApps(profileId: string, selectedAppsFilenames: string[]): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    const { scanAvailableApps } = await import('../utils/scanApks.js');
    const availableApps = await scanAvailableApps();

    for (const filename of selectedAppsFilenames) {
      const appInfo = availableApps.find(app => app.fileName === filename);
      if (!appInfo) {
        logger.warn(`App ${filename} not found in apks folder`);
        continue;
      }

      try {
        // Check if app already installed
        const isInstalled = await this.controller.isAppInstalled(
          profile.port,
          appInfo.packageName || ''
        );

        if (isInstalled) {
          logger.info(`${appInfo.name} already installed on ${profile.name}`);
          profile.apps[appInfo.name.toLowerCase()] = {
            installed: true,
            packageName: appInfo.packageName,
          };
          continue;
        }

        // Install APK
        logger.info(`Installing ${appInfo.name} from ${appInfo.filePath}...`);
        const apkPath = path.resolve(process.cwd(), appInfo.filePath);
        await this.controller.installAPK(profile.port, apkPath);

        // Update profile
        profile.apps[appInfo.name.toLowerCase()] = {
          installed: true,
          packageName: appInfo.packageName,
        };

        logger.info(`${appInfo.name} installed successfully on ${profile.name}`);
      } catch (error) {
        logger.error(`Failed to install ${appInfo.name}:`, error);
      }
    }

    await this.saveProfile(profile);
  }

  // Helper method to generate unique profile ID
  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Auto-launch app after instance activation
  private async autoLaunchApp(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    try {
      // Wait for instance to fully boot (5 seconds)
      logger.info(`Waiting for instance to boot: ${profile.name}`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Launch Google app (com.android.chrome or com.google.android.googlequicksearchbox)
      const googlePackages = [
        'com.android.chrome',                      // Chrome browser
        'com.google.android.googlequicksearchbox', // Google app
        'com.android.browser',                     // Default browser
      ];

      for (const packageName of googlePackages) {
        try {
          // Check if app exists
          const isInstalled = await this.controller.isAppInstalled(profile.port, packageName);
          if (isInstalled) {
            logger.info(`Launching ${packageName} on ${profile.name}`);
            await this.controller.launchApp(profile.port, packageName);
            logger.info(`${packageName} launched successfully`);
            return; // Exit after launching first available app
          }
        } catch (error) {
          logger.debug(`${packageName} not available or failed to launch`);
        }
      }

      logger.warn(`No Google app found to auto-launch on ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to auto-launch app on ${profileId}:`, error);
      // Don't throw - this is optional feature
    }
  }

  // Execute auto-run scripts after instance activation
  private async executeAutoRunScripts(profileId: string, scripts: Array<{scriptName: string; scriptData: Record<string, any>}>): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile || !this.scriptExecutor) return;

    try {
      // Wait for instance to fully boot
      logger.info(`Waiting for instance to boot before executing scripts: ${profile.name}`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Execute each script in sequence
      for (const script of scripts) {
        try {
          logger.info(`Auto-executing script "${script.scriptName}" on ${profile.name}`);

          await this.scriptExecutor.queueScript({
            profileId: profile.id,
            scriptType: 'twitter', // Default to twitter for now
            scriptName: script.scriptName,
            scriptData: script.scriptData
          });

          logger.info(`Script "${script.scriptName}" queued successfully for ${profile.name}`);
        } catch (error) {
          logger.error(`Failed to execute script "${script.scriptName}":`, error);
          // Continue with next script even if one fails
        }
      }

      logger.info(`All auto-run scripts queued for ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to execute auto-run scripts for ${profileId}:`, error);
      // Don't throw - scripts are optional
    }
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