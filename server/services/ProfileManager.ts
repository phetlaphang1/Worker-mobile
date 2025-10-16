import LDPlayerController, { LDPlayerInstance } from '../core/LDPlayerController.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { APPS_CONFIG, getAutoInstallApps } from '../config/apps.config.js';
import type FingerprintService from './FingerprintService.js';

export interface MobileProfile {
  id: number;
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
    resolution?: string; // Real device resolution (e.g., "1080x2400")
    dpi?: number; // Real device DPI (e.g., 420)
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
  status: 'active' | 'inactive' | 'suspended' | 'running';
  createdAt: Date;
  lastUsed?: Date;
  metadata?: Record<string, any>;
}

export class ProfileManager {
  private profiles: Map<number, MobileProfile> = new Map();
  private controller: LDPlayerController;
  private nextProfileId: number = 1;
  private profilesPath: string;
  private scriptExecutor: any; // Will be injected later
  private fingerprintService?: FingerprintService; // Will be injected later
  private broadcastStatus?: (type: string, data: any) => void; // WebSocket broadcast for status updates

  constructor(controller: LDPlayerController) {
    this.controller = controller;
    this.profilesPath = path.join(process.cwd(), 'data', 'profiles');
    // Don't call async initialization in constructor
  }

  // Inject script executor (to avoid circular dependency)
  setScriptExecutor(scriptExecutor: any): void {
    this.scriptExecutor = scriptExecutor;
  }

  // Inject fingerprint service (to avoid circular dependency)
  setFingerprintService(fingerprintService: FingerprintService): void {
    this.fingerprintService = fingerprintService;
  }

  // Inject broadcast function for WebSocket status updates
  setBroadcastStatus(broadcastStatusFn: (type: string, data: any) => void): void {
    this.broadcastStatus = broadcastStatusFn;
    logger.info('ProfileManager: WebSocket broadcast function injected');
  }

  // Public async initialization method - must be called before using ProfileManager
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.profilesPath, { recursive: true });
      await this.loadProfiles();
      logger.info('ProfileManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize profile storage:', error);
      throw error;
    }
  }

  // Load profiles from storage
  private async loadProfiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.profilesPath);

      for (const file of files) {
        // Only load files with numeric names (e.g., 1.json, 2.json)
        if (file.endsWith('.json') && /^\d+\.json$/.test(file)) {
          const profilePath = path.join(this.profilesPath, file);
          const data = await fs.readFile(profilePath, 'utf-8');
          const profile = JSON.parse(data) as MobileProfile;

          // Validate profile has numeric ID
          if (typeof profile.id !== 'number' || isNaN(profile.id) || profile.id === null) {
            logger.warn(`Skipping invalid profile file: ${file} (invalid ID: ${profile.id})`);
            continue;
          }

          // Convert date strings back to Date objects
          profile.createdAt = new Date(profile.createdAt);
          if (profile.lastUsed) {
            profile.lastUsed = new Date(profile.lastUsed);
          }

          this.profiles.set(profile.id, profile);
        }
      }

      // Update nextProfileId to be max(existing IDs) + 1
      if (this.profiles.size > 0) {
        const maxId = Math.max(...Array.from(this.profiles.keys()));
        this.nextProfileId = maxId + 1;
      } else {
        this.nextProfileId = 1;
      }

      logger.info(`Loaded ${this.profiles.size} profiles, next ID will be ${this.nextProfileId}`);
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
    name?: string;
    settings?: Partial<MobileProfile['settings']>;
    device?: Partial<MobileProfile['device']>;
    network?: Partial<MobileProfile['network']>;
    location?: MobileProfile['location'];
    autoApplyFingerprint?: boolean; // Auto-apply random fingerprint (default: true)
    fingerprintBrand?: string; // Optional: specify brand for fingerprint
  }): Promise<MobileProfile> {
    try {
      const profileId = this.generateProfileId();
      // Use provided name or generate default
      const displayName = config.name || `Instance_${profileId}`;
      // Instance name for LDPlayer: sanitized + profile ID for uniqueness
      // This prevents naming conflicts when multiple instances have similar names
      const baseName = displayName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const instanceName = `${baseName}_${profileId}`;
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
        name: displayName, // Use provided name
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

      // Auto-apply fingerprint if enabled (default: true)
      const shouldApplyFingerprint = config.autoApplyFingerprint !== false;
      if (shouldApplyFingerprint && this.fingerprintService) {
        try {
          logger.info(`Auto-applying fingerprint to ${instanceName}...`);
          const { FingerprintGenerator } = await import('./FingerprintGenerator.js');

          // Generate fingerprint with optional brand
          const fingerprint = FingerprintGenerator.generateFingerprint({
            brand: config.fingerprintBrand,
            includePhoneNumber: true
          });

          // Apply via ldconsole (instance is stopped, perfect timing!)
          await this.fingerprintService.applyFingerprint(instanceName, fingerprint, {
            method: 'ldconsole',
            requireRestart: false
          });

          // Update profile device info with applied fingerprint
          profile.device = {
            imei: fingerprint.imei,
            androidId: fingerprint.androidId,
            model: fingerprint.model,
            manufacturer: fingerprint.manufacturer,
            brand: fingerprint.brand,
            resolution: fingerprint.realResolution, // Save real device resolution
            dpi: fingerprint.realDpi // Save real device DPI
          };

          logger.info(`✅ Fingerprint applied: ${fingerprint.brand} ${fingerprint.model} (IMEI: ${fingerprint.imei})`);
        } catch (fingerprintError) {
          logger.warn(`Failed to auto-apply fingerprint (continuing anyway):`, fingerprintError);
          // Don't throw - profile creation should still succeed
        }
      } else if (shouldApplyFingerprint && !this.fingerprintService) {
        logger.warn('FingerprintService not available, skipping auto-apply fingerprint');
      }

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
  // Launch instance only (without installing apps or running scripts)
  async launchInstanceOnly(profileId: number): Promise<void> {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        throw new Error(`Profile ${profileId} not found`);
      }

      logger.info(`[ProfileManager] launchInstanceOnly called for Profile ID: ${profileId}, Instance: ${profile.instanceName}`);

      // Just launch the instance
      logger.info(`[ProfileManager] Calling LDPlayerController.launchInstance("${profile.instanceName}")`);
      await this.controller.launchInstance(profile.instanceName);

      // Update profile status
      profile.status = 'active';
      profile.lastUsed = new Date();
      await this.saveProfile(profile);

      // Broadcast status update via WebSocket
      if (this.broadcastStatus) {
        this.broadcastStatus('profile_status_update', {
          profileId: profile.id,
          status: 'active',
          instanceName: profile.instanceName,
          timestamp: new Date().toISOString()
        });
        logger.info(`[ProfileManager] Broadcasted status update for profile ${profileId}: active`);
      } else {
        logger.warn(`[ProfileManager] broadcastStatus is not set, cannot notify clients`);
      }

      logger.info(`[ProfileManager] Launched instance only: ${profile.name}`);
    } catch (error) {
      logger.error(`[ProfileManager] Failed to launch instance ${profileId}:`, error);
      throw error;
    }
  }

  async activateProfile(profileId: number): Promise<void> {
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
  async deactivateProfile(profileId: number): Promise<void> {
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

      // Broadcast status update via WebSocket
      if (this.broadcastStatus) {
        this.broadcastStatus('profile_status_update', {
          profileId: profile.id,
          status: 'inactive',
          instanceName: profile.instanceName,
          timestamp: new Date().toISOString()
        });
        logger.info(`[ProfileManager] Broadcasted status update for profile ${profileId}: inactive`);
      }

      logger.info(`Deactivated profile: ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to deactivate profile ${profileId}:`, error);
      throw error;
    }
  }

  // Delete profile
  async deleteProfile(profileId: number): Promise<void> {
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
  async updateProfile(profileId: number, updates: Partial<MobileProfile>): Promise<MobileProfile> {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile) {
        throw new Error(`Profile ${profileId} not found`);
      }

      // Check if hardware settings are being updated
      const settingsChanged = updates.settings && (
        updates.settings.resolution !== profile.settings?.resolution ||
        updates.settings.cpu !== profile.settings?.cpu ||
        updates.settings.memory !== profile.settings?.memory
      );

      // Merge updates
      Object.assign(profile, updates);

      // Apply hardware changes to instance if settings changed
      if (settingsChanged && profile.settings) {
        logger.info(`Updating instance hardware settings for ${profile.name}...`);
        try {
          // Get instance from controller
          await this.controller.getAllInstancesFromLDConsole();
          const instance = this.controller.getInstance(profile.instanceName);

          if (instance) {
            // Instance must be stopped to modify settings
            const wasRunning = profile.status === 'active';
            if (wasRunning) {
              logger.info(`Stopping instance ${profile.instanceName} to apply hardware settings...`);
              await this.controller.stopInstance(profile.instanceName);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Build modify command
            const modifyArgs = [];
            if (profile.settings.resolution) {
              // ldconsole requires format: width,height,dpi
              const dpi = profile.settings.dpi || 240; // Default DPI
              modifyArgs.push(`--resolution ${profile.settings.resolution},${dpi}`);
            }
            if (profile.settings.cpu) {
              modifyArgs.push(`--cpu ${profile.settings.cpu}`);
            }
            if (profile.settings.memory) {
              modifyArgs.push(`--memory ${profile.settings.memory}`);
            }

            // Execute modify command via ldconsole
            if (modifyArgs.length > 0) {
              const ldconsolePath = process.env.LDCONSOLE_PATH || 'ldconsole.exe';
              const { execSync } = await import('child_process');
              const modifyCmd = `"${ldconsolePath}" modify --index ${instance.index} ${modifyArgs.join(' ')}`;
              logger.info(`Executing: ${modifyCmd}`);
              execSync(modifyCmd);
              logger.info(`Instance hardware settings updated successfully`);
            }

            // Restart instance if it was running
            if (wasRunning) {
              logger.info(`Restarting instance ${profile.instanceName}...`);
              await this.controller.launchInstance(profile.instanceName);
            }
          } else {
            logger.warn(`Instance ${profile.instanceName} not found in LDPlayer, skipping hardware update`);
          }
        } catch (modifyError) {
          logger.warn(`Failed to apply hardware settings to instance: ${modifyError}`);
          // Continue anyway - settings are saved to profile
        }
      }

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
  getProfile(profileId: number): MobileProfile | undefined {
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
  async activateMultipleProfiles(profileIds: number[]): Promise<void> {
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

  // Refresh all profile statuses from LDPlayer
  async refreshAllProfileStatuses(): Promise<void> {
    try {
      logger.info('Refreshing all profile statuses from LDPlayer...');

      // Get running instances from LDPlayer
      const { execSync } = await import('child_process');
      const ldconsolePath = process.env.LDCONSOLE_PATH || 'ldconsole.exe';
      const result = execSync(`"${ldconsolePath}" runninglist`).toString();
      const runningInstances = new Set(
        result.split('\n')
          .map(line => line.trim())
          .filter(line => line && line !== '')
          .map(line => line.split(',')[1]) // Get instance name
          .filter(name => name)
      );

      // Update all profiles based on running status
      for (const profile of this.profiles.values()) {
        const isRunning = runningInstances.has(profile.instanceName);

        // IMPORTANT: Don't override 'running' status (script is executing)
        // Only update if status is 'active' or 'inactive'
        if (profile.status === 'running') {
          // Skip - script is currently executing, don't touch this status
          continue;
        }

        const newStatus = isRunning ? 'active' : 'inactive';

        if (profile.status !== newStatus) {
          profile.status = newStatus;
          await this.saveProfile(profile);
          logger.info(`Updated profile ${profile.name} status to ${newStatus}`);
        }
      }

      logger.info('Profile statuses refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh profile statuses:', error);
      throw error;
    }
  }

  // Clone profile (always includes all apps and configurations)
  // Note: LDPlayer's copy command always clones everything - we cannot selectively exclude apps
  async cloneProfile(profileId: number, newName: string, options?: {
    launchAndSetup?: boolean;
    autoApplyFingerprint?: boolean; // Auto-apply new fingerprint to clone (default: true)
    fingerprintBrand?: string; // Optional: specify brand for fingerprint
  }): Promise<MobileProfile> {
    const originalProfile = this.profiles.get(profileId);
    if (!originalProfile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Clone instance WITH all apps using LDPlayer copy command
    logger.info(`Cloning instance from ${originalProfile.name} to ${newName}`);
    logger.info(`This will copy ALL settings, configurations, and installed applications`);

    const newProfileId = this.generateProfileId();
    // Create unique instance name: sanitize + add profile ID to ensure uniqueness
    // This prevents naming conflicts when multiple instances have similar names
    const baseName = newName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const newInstanceName = `${baseName}_${newProfileId}`;

    let clonedProfile: MobileProfile;

    try {
      // Clone LDPlayer instance (includes ALL apps and configurations)
      // Note: LDPlayerController.cloneInstance will handle stopping/restarting source if needed
      const clonedInstance = await this.controller.cloneInstance(
        originalProfile.instanceName,
        newInstanceName
      );

      logger.info(`LDPlayer instance cloned successfully (index: ${clonedInstance.index}, port: ${clonedInstance.port})`);

      // Wait a bit for instance to be fully registered
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create profile object from cloned instance
      // Deep clone all configurations to ensure the new profile is completely independent
      clonedProfile = {
        id: newProfileId,
        name: newName,
        instanceName: newInstanceName,
        port: clonedInstance.port,
        settings: { ...originalProfile.settings },
        device: originalProfile.device ? { ...originalProfile.device } : {},
        network: originalProfile.network ? { ...originalProfile.network } : { useProxy: false },
        location: originalProfile.location ? { ...originalProfile.location } : undefined,
        apps: originalProfile.apps ? JSON.parse(JSON.stringify(originalProfile.apps)) : {},
        status: 'inactive',
        createdAt: new Date(),
        metadata: originalProfile.metadata ? JSON.parse(JSON.stringify(originalProfile.metadata)) : {}
      };

      // Register instance in controller
      this.controller.getInstance(newInstanceName); // This ensures it's tracked

      logger.info(`Profile created for cloned instance (ID: ${newProfileId})`);
    } catch (cloneError) {
      logger.error(`Failed to clone instance: ${cloneError}`);
      throw new Error(`Failed to clone instance ${originalProfile.name}: ${cloneError instanceof Error ? cloneError.message : String(cloneError)}`);
    }

    // Auto-apply new fingerprint to cloned instance (default: true)
    const shouldApplyFingerprint = options?.autoApplyFingerprint !== false;
    if (shouldApplyFingerprint && this.fingerprintService) {
      try {
        logger.info(`Auto-applying new fingerprint to cloned instance ${newInstanceName}...`);
        const { FingerprintGenerator } = await import('./FingerprintGenerator.js');

        // Generate new fingerprint with optional brand
        const fingerprint = FingerprintGenerator.generateFingerprint({
          brand: options?.fingerprintBrand,
          includePhoneNumber: true
        });

        // Apply via ldconsole (instance is stopped after clone)
        await this.fingerprintService.applyFingerprint(newInstanceName, fingerprint, {
          method: 'ldconsole',
          requireRestart: false
        });

        // Update cloned profile device info
        clonedProfile.device = {
          imei: fingerprint.imei,
          androidId: fingerprint.androidId,
          model: fingerprint.model,
          manufacturer: fingerprint.manufacturer,
          brand: fingerprint.brand,
          resolution: fingerprint.realResolution, // Save real device resolution
          dpi: fingerprint.realDpi // Save real device DPI
        };

        logger.info(`✅ New fingerprint applied to clone: ${fingerprint.brand} ${fingerprint.model} (IMEI: ${fingerprint.imei})`);
      } catch (fingerprintError) {
        logger.warn(`Failed to auto-apply fingerprint to clone (continuing anyway):`, fingerprintError);
        // Don't throw - clone should still succeed
      }
    } else if (shouldApplyFingerprint && !this.fingerprintService) {
      logger.warn('FingerprintService not available, skipping auto-apply fingerprint for clone');
    }

    // Save profile
    this.profiles.set(clonedProfile.id, clonedProfile);
    await this.saveProfile(clonedProfile);

    logger.info(`Profile saved: ${newName} (ID: ${clonedProfile.id})`);

    // Auto-launch and setup if requested
    if (options?.launchAndSetup) {
      logger.info(`Auto-launching and setting up cloned profile: ${newName}`);
      try {
        await this.activateProfile(clonedProfile.id);
      } catch (activateError) {
        logger.error(`Failed to auto-activate cloned profile: ${activateError}`);
        // Don't throw - profile was created successfully, just activation failed
      }
    }

    logger.info(`✅ Successfully cloned profile ${originalProfile.name} to ${newName} (ID: ${clonedProfile.id})`);
    logger.info(`   The cloned instance has identical: settings, configurations, and ALL installed apps`);
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
  async exportProfile(profileId: number, exportPath: string): Promise<void> {
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
  async installTwitterApp(profileId: number): Promise<void> {
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
  async installApps(profileId: number, apps: Array<{ name: string; apkPath: string; packageName: string }>): Promise<void> {
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
  private async autoInstallApps(profileId: number): Promise<void> {
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

        // Install APK using ldconsole (more reliable than ADB)
        logger.info(`Installing ${appConfig.name} from ${apkPath}...`);

        // Refresh instance list from ldconsole and get instance index
        await this.controller.getAllInstancesFromLDConsole();
        const instance = this.controller.getInstance(profile.instanceName);
        if (!instance) {
          logger.warn(`Instance ${profile.instanceName} not found, skipping ${appConfig.name}`);
          continue;
        }

        await this.controller.installAppViaLDConsole(instance.index, apkPath);

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
  private async installSelectedApps(profileId: number, selectedAppsFilenames: string[]): Promise<void> {
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

        // Install APK using ldconsole (more reliable than ADB)
        logger.info(`Installing ${appInfo.name} from ${appInfo.filePath}...`);
        const apkPath = path.resolve(process.cwd(), appInfo.filePath);

        // Refresh instance list from ldconsole and get instance index
        await this.controller.getAllInstancesFromLDConsole();
        const instance = this.controller.getInstance(profile.instanceName);
        if (!instance) {
          logger.warn(`Instance ${profile.instanceName} not found, skipping ${appInfo.name}`);
          continue;
        }

        await this.controller.installAppViaLDConsole(instance.index, apkPath);

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
  private generateProfileId(): number {
    return this.nextProfileId++;
  }

  // Auto-launch app after instance activation
  private async autoLaunchApp(profileId: number): Promise<void> {
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
  private async executeAutoRunScripts(profileId: number, scripts: Array<{scriptName: string; scriptData: Record<string, any>}>): Promise<void> {
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

  // Import existing LDPlayer instance as Profile
  async importExistingInstance(instanceName: string, index: number): Promise<MobileProfile> {
    try {
      // Check if profile already exists for this instance
      const existingProfile = Array.from(this.profiles.values()).find(
        p => p.instanceName === instanceName
      );

      if (existingProfile) {
        logger.info(`Profile already exists for instance ${instanceName}`);
        return existingProfile;
      }

      const profileId = this.generateProfileId();
      const port = 5555 + index * 2;

      // Create profile object for existing instance
      const profile: MobileProfile = {
        id: profileId,
        name: instanceName, // Use instance name as profile name
        instanceName,
        port,
        settings: {
          resolution: '360,640', // Default, will be updated if needed
          dpi: 160,
          cpu: 2,
          memory: 2048,
          androidVersion: '9'
        },
        device: {},
        network: { useProxy: false },
        apps: {}, // Will be detected on first activation
        status: 'inactive',
        createdAt: new Date()
      };

      // Save profile
      this.profiles.set(profileId, profile);
      await this.saveProfile(profile);

      logger.info(`Imported existing instance: ${instanceName} (index: ${index}, port: ${port})`);
      return profile;
    } catch (error) {
      logger.error(`Failed to import instance ${instanceName}:`, error);
      throw error;
    }
  }

  // Scan and import all existing LDPlayer instances
  async scanAndImportAllInstances(): Promise<MobileProfile[]> {
    try {
      logger.info('Scanning for existing LDPlayer instances...');

      // Get all instances from LDPlayer
      const instances = await this.controller.getAllInstancesFromLDConsole();

      const importedProfiles: MobileProfile[] = [];

      for (const instance of instances) {
        try {
          const profile = await this.importExistingInstance(instance.name, instance.index);
          importedProfiles.push(profile);
        } catch (error) {
          logger.warn(`Failed to import instance ${instance.name}:`, error);
        }
      }

      logger.info(`Imported ${importedProfiles.length} instances as profiles`);
      return importedProfiles;
    } catch (error) {
      logger.error('Failed to scan and import instances:', error);
      throw error;
    }
  }

  // Get profile statistics
  getStatistics(): {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    running: number;
  } {
    const profiles = this.getAllProfiles();
    return {
      total: profiles.length,
      active: profiles.filter(p => p.status === 'active').length,
      inactive: profiles.filter(p => p.status === 'inactive').length,
      suspended: profiles.filter(p => p.status === 'suspended').length,
      running: profiles.filter(p => p.status === 'running').length
    };
  }

  // Install app on profile using ldconsole
  async installAppOnProfile(profileId: number, apkFileName: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    try {
      const apkPath = path.resolve(process.cwd(), 'apks', apkFileName);
      await fs.access(apkPath); // Check if file exists

      // Refresh instance list from ldconsole first
      await this.controller.getAllInstancesFromLDConsole();

      // Get instance index
      const instance = this.controller.getInstance(profile.instanceName);
      if (!instance) {
        throw new Error(`Instance ${profile.instanceName} not found`);
      }

      logger.info(`Installing ${apkFileName} on profile ${profile.name} (index: ${instance.index})`);
      await this.controller.installAppViaLDConsole(instance.index, apkPath);

      logger.info(`App ${apkFileName} installed successfully on ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to install app on profile ${profileId}:`, error);
      throw error;
    }
  }

  // Launch app on profile using ldconsole
  async launchAppOnProfile(profileId: number, packageName: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    try {
      const instance = this.controller.getInstance(profile.instanceName);
      if (!instance) {
        throw new Error(`Instance ${profile.instanceName} not found`);
      }

      logger.info(`Launching ${packageName} on profile ${profile.name} (index: ${instance.index})`);
      await this.controller.launchAppViaLDConsole(instance.index, packageName);

      logger.info(`App ${packageName} launched successfully on ${profile.name}`);
    } catch (error) {
      logger.error(`Failed to launch app on profile ${profileId}:`, error);
      throw error;
    }
  }
}

export default ProfileManager;