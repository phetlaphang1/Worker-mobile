/**
 * ProfileIsolationService - Complete profile isolation like GemLogin
 *
 * Integrates:
 * - FingerprintService (device fingerprint randomization)
 * - ProxyManager (unique IP per profile)
 * - SessionManager (cookies, localStorage persistence)
 * - ActionRecorder (automation playback)
 *
 * Each profile is completely isolated with unique:
 * - Device fingerprint (IMEI, Android ID, Model, etc.)
 * - Network identity (dedicated proxy/IP)
 * - Browser state (cookies, localStorage, sessionStorage)
 * - Automation capabilities (record/playback actions)
 */

import { logger } from '../utils/logger.js';
import path from 'path';
import LDPlayerController from '../core/LDPlayerController.js';
import FingerprintService from './FingerprintService.js';
import ProxyManager from './ProxyManager.js';
import SessionManager from './SessionManager.js';
import ActionRecorder from './ActionRecorder.js';
import ProfileManager, { MobileProfile } from './ProfileManager.js';
import { DeviceFingerprint } from './FingerprintGenerator.js';
import { ProxyConfig } from '../types/proxy.js';

export interface IsolatedProfileConfig {
  profileId: number;
  fingerprint: DeviceFingerprint;
  proxy?: ProxyConfig;
  sessionSaved: boolean;
  automationScripts: string[];
  isolationLevel: 'high' | 'medium' | 'low';
}

export interface IsolationOptions {
  autoApplyFingerprint?: boolean;
  autoAssignProxy?: boolean;
  stickyProxy?: boolean;
  autoSaveSession?: boolean;
  fingerprintBrand?: string;
  isolationLevel?: 'high' | 'medium' | 'low';
}

export class ProfileIsolationService {
  private controller: LDPlayerController;
  private fingerprintService: FingerprintService;
  private proxyManager: ProxyManager;
  private sessionManager: SessionManager;
  private actionRecorder: ActionRecorder;
  private profileManager: ProfileManager;
  private isolationConfigs: Map<number, IsolatedProfileConfig> = new Map();

  constructor(
    controller: LDPlayerController,
    fingerprintService: FingerprintService,
    proxyManager: ProxyManager,
    sessionManager: SessionManager,
    actionRecorder: ActionRecorder,
    profileManager: ProfileManager
  ) {
    this.controller = controller;
    this.fingerprintService = fingerprintService;
    this.proxyManager = proxyManager;
    this.sessionManager = sessionManager;
    this.actionRecorder = actionRecorder;
    this.profileManager = profileManager;
  }

  async initialize(): Promise<void> {
    logger.info('ProfileIsolationService initialized');
  }

  /**
   * Setup complete isolation for a profile
   * This is the main method to create a fully isolated profile like GemLogin
   */
  async setupProfileIsolation(profileId: number, options?: IsolationOptions): Promise<IsolatedProfileConfig> {
    const {
      autoApplyFingerprint = true,
      autoAssignProxy = true,
      stickyProxy = true,
      autoSaveSession = true,
      fingerprintBrand,
      isolationLevel = 'high'
    } = options || {};

    logger.info(`Setting up isolation for profile ${profileId} (level: ${isolationLevel})...`);

    const profile = this.profileManager.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const config: IsolatedProfileConfig = {
      profileId,
      fingerprint: {} as DeviceFingerprint,
      sessionSaved: false,
      automationScripts: [],
      isolationLevel
    };

    // 1. Apply unique device fingerprint
    if (autoApplyFingerprint) {
      logger.info(`[1/3] Applying device fingerprint...`);
      const { FingerprintGenerator } = await import('./FingerprintGenerator.js');

      // Generate fingerprint based on isolation level
      const fingerprint = FingerprintGenerator.generateFingerprint({
        brand: fingerprintBrand,
        includePhoneNumber: isolationLevel === 'high'
      });

      // Apply fingerprint
      await this.fingerprintService.applyFingerprint(profile.instanceName, fingerprint, {
        method: 'ldconsole',
        requireRestart: false
      });

      config.fingerprint = fingerprint;
      logger.info(`✅ Fingerprint applied: ${fingerprint.brand} ${fingerprint.model}`);
    }

    // 2. Assign unique proxy/IP
    if (autoAssignProxy) {
      logger.info(`[2/3] Assigning proxy...`);
      const proxy = this.proxyManager.assignProxyToInstance(profile.instanceName, stickyProxy);

      if (proxy) {
        config.proxy = proxy;

        // Apply proxy to profile
        await this.profileManager.updateProfile(profileId, {
          network: {
            useProxy: true,
            proxyHost: proxy.host,
            proxyPort: proxy.port,
            proxyUsername: proxy.username,
            proxyPassword: proxy.password,
            proxyType: proxy.type as 'http' | 'socks5'
          }
        });

        logger.info(`✅ Proxy assigned: ${proxy.host}:${proxy.port}`);
      } else {
        logger.warn('No proxy available, continuing without proxy');
      }
    }

    // 3. Initialize session storage (will be saved after first use)
    if (autoSaveSession) {
      logger.info(`[3/3] Initializing session storage...`);
      config.sessionSaved = false; // Will be saved when profile is activated
      logger.info('✅ Session storage ready');
    }

    // Save config
    this.isolationConfigs.set(profileId, config);

    logger.info(`✅ Profile isolation setup complete for profile ${profileId}`);
    logger.info(`   - Fingerprint: ${config.fingerprint.brand} ${config.fingerprint.model}`);
    logger.info(`   - Proxy: ${config.proxy ? `${config.proxy.host}:${config.proxy.port}` : 'None'}`);
    logger.info(`   - Session: ${config.sessionSaved ? 'Saved' : 'Will be saved on first use'}`);
    logger.info(`   - Isolation Level: ${config.isolationLevel}`);

    return config;
  }

  /**
   * Activate profile with full isolation
   */
  async activateIsolatedProfile(profileId: number, options?: {
    restoreSession?: boolean;
    runAutomationScripts?: boolean;
  }): Promise<void> {
    const { restoreSession = true, runAutomationScripts = false } = options || {};

    logger.info(`Activating isolated profile ${profileId}...`);

    const config = this.isolationConfigs.get(profileId);
    if (!config) {
      throw new Error(`Profile ${profileId} is not configured for isolation. Run setupProfileIsolation first.`);
    }

    const profile = this.profileManager.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // 1. Launch instance
    logger.info('Launching instance...');
    await this.profileManager.launchInstanceOnly(profileId);

    // Wait for instance to boot
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2. Apply proxy settings via ADB (if configured)
    if (config.proxy) {
      logger.info('Applying proxy settings...');
      await this.applyProxySettings(profile.port, config.proxy);
    }

    // 3. Restore session (cookies, localStorage)
    if (restoreSession && config.sessionSaved) {
      logger.info('Restoring session...');
      try {
        await this.sessionManager.restoreSession(profileId, profile.port);
        logger.info('✅ Session restored');
      } catch (error) {
        logger.warn('Failed to restore session:', error);
      }
    }

    // 4. Run automation scripts (if any)
    if (runAutomationScripts && config.automationScripts.length > 0) {
      logger.info(`Running ${config.automationScripts.length} automation scripts...`);
      for (const scriptId of config.automationScripts) {
        try {
          await this.actionRecorder.playback(scriptId, profile.port, {
            continueOnError: true,
            retryOnFailure: true
          });
        } catch (error) {
          logger.warn(`Failed to run script ${scriptId}:`, error);
        }
      }
    }

    logger.info(`✅ Profile ${profileId} activated with full isolation`);
  }

  /**
   * Deactivate profile and save session
   */
  async deactivateIsolatedProfile(profileId: number, options?: {
    saveSession?: boolean;
  }): Promise<void> {
    const { saveSession = true } = options || {};

    logger.info(`Deactivating isolated profile ${profileId}...`);

    const config = this.isolationConfigs.get(profileId);
    const profile = this.profileManager.getProfile(profileId);

    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // 1. Save session before deactivating
    if (saveSession && config) {
      logger.info('Saving session...');
      try {
        await this.sessionManager.saveSession(profileId, profile.port);
        config.sessionSaved = true;
        logger.info('✅ Session saved');
      } catch (error) {
        logger.warn('Failed to save session:', error);
      }
    }

    // 2. Deactivate profile
    await this.profileManager.deactivateProfile(profileId);

    logger.info(`✅ Profile ${profileId} deactivated`);
  }

  /**
   * Clone profile with complete isolation (new fingerprint, new proxy, new session)
   */
  async cloneIsolatedProfile(profileId: number, newName: string, options?: {
    copySession?: boolean;
    assignNewProxy?: boolean;
    applyNewFingerprint?: boolean;
  }): Promise<MobileProfile> {
    const {
      copySession = false,
      assignNewProxy = true,
      applyNewFingerprint = true
    } = options || {};

    logger.info(`Cloning isolated profile ${profileId} to ${newName}...`);

    // Clone the profile (ProfileManager handles fingerprint)
    const newProfile = await this.profileManager.cloneProfile(profileId, newName, {
      launchAndSetup: false,
      autoApplyFingerprint: applyNewFingerprint
    });

    // Setup isolation for cloned profile
    await this.setupProfileIsolation(newProfile.id, {
      autoApplyFingerprint: false, // Already applied by cloneProfile
      autoAssignProxy: assignNewProxy,
      autoSaveSession: true,
      isolationLevel: 'high'
    });

    // Copy session if requested
    if (copySession) {
      logger.info('Copying session from original profile...');
      try {
        const session = await this.sessionManager.getSession(profileId);
        if (session) {
          // Create new session for cloned profile
          const clonedSession = { ...session, profileId: newProfile.id, savedAt: new Date() };
          await this.sessionManager.importSession(
            path.join(this.sessionManager['sessionsPath'], `${profileId}.json`),
            newProfile.id
          );
          logger.info('✅ Session copied');
        }
      } catch (error) {
        logger.warn('Failed to copy session:', error);
      }
    }

    logger.info(`✅ Cloned profile ${newProfile.id} with complete isolation`);
    return newProfile;
  }

  /**
   * Add automation script to profile
   */
  async addAutomationScript(profileId: number, scriptId: string): Promise<void> {
    const config = this.isolationConfigs.get(profileId);
    if (!config) {
      throw new Error(`Profile ${profileId} is not configured for isolation`);
    }

    const script = this.actionRecorder.getScript(scriptId);
    if (!script) {
      throw new Error(`Script ${scriptId} not found`);
    }

    if (!config.automationScripts.includes(scriptId)) {
      config.automationScripts.push(scriptId);
      logger.info(`Added automation script "${script.name}" to profile ${profileId}`);
    }
  }

  /**
   * Remove automation script from profile
   */
  removeAutomationScript(profileId: number, scriptId: string): void {
    const config = this.isolationConfigs.get(profileId);
    if (!config) {
      throw new Error(`Profile ${profileId} is not configured for isolation`);
    }

    const index = config.automationScripts.indexOf(scriptId);
    if (index > -1) {
      config.automationScripts.splice(index, 1);
      logger.info(`Removed automation script from profile ${profileId}`);
    }
  }

  /**
   * Rotate profile identity (new fingerprint + new proxy + clear session)
   */
  async rotateProfileIdentity(profileId: number, options?: {
    rotateFingerprin?: boolean;
    rotateProxy?: boolean;
    clearSession?: boolean;
  }): Promise<void> {
    const {
      rotateFingerprin = true,
      rotateProxy = true,
      clearSession = true
    } = options || {};

    logger.info(`Rotating identity for profile ${profileId}...`);

    const config = this.isolationConfigs.get(profileId);
    const profile = this.profileManager.getProfile(profileId);

    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Stop instance if running
    if (profile.status === 'active') {
      await this.profileManager.deactivateProfile(profileId);
    }

    // 1. Rotate fingerprint
    if (rotateFingerprin) {
      logger.info('Rotating device fingerprint...');
      const { FingerprintGenerator } = await import('./FingerprintGenerator.js');
      const newFingerprint = FingerprintGenerator.generateFingerprint({
        includePhoneNumber: true
      });

      await this.fingerprintService.applyFingerprint(profile.instanceName, newFingerprint, {
        method: 'ldconsole'
      });

      if (config) {
        config.fingerprint = newFingerprint;
      }

      logger.info(`✅ New fingerprint: ${newFingerprint.brand} ${newFingerprint.model}`);
    }

    // 2. Rotate proxy
    if (rotateProxy) {
      logger.info('Rotating proxy...');
      const newProxy = this.proxyManager.rotateProxyForInstance(profile.instanceName);

      if (newProxy && config) {
        config.proxy = newProxy;
        await this.profileManager.updateProfile(profileId, {
          network: {
            useProxy: true,
            proxyHost: newProxy.host,
            proxyPort: newProxy.port,
            proxyUsername: newProxy.username,
            proxyPassword: newProxy.password,
            proxyType: newProxy.type as 'http' | 'socks5'
          }
        });

        logger.info(`✅ New proxy: ${newProxy.host}:${newProxy.port}`);
      }
    }

    // 3. Clear session
    if (clearSession) {
      logger.info('Clearing session...');
      await this.sessionManager.deleteSession(profileId);

      if (config) {
        config.sessionSaved = false;
      }

      logger.info('✅ Session cleared');
    }

    logger.info(`✅ Profile identity rotated for profile ${profileId}`);
  }

  /**
   * Apply proxy settings via ADB
   */
  private async applyProxySettings(port: number, proxy: ProxyConfig): Promise<void> {
    try {
      const adbPath = process.env.ADB_PATH || 'adb.exe';
      const { execSync } = await import('child_process');

      // Set global proxy via ADB
      const proxyHost = proxy.host;
      const proxyPort = proxy.port;

      execSync(`"${adbPath}" -s 127.0.0.1:${port} shell settings put global http_proxy ${proxyHost}:${proxyPort}`);

      logger.info(`Proxy applied via ADB: ${proxyHost}:${proxyPort}`);
    } catch (error) {
      logger.error('Failed to apply proxy settings:', error);
      throw error;
    }
  }

  /**
   * Get isolation config for profile
   */
  getIsolationConfig(profileId: number): IsolatedProfileConfig | undefined {
    return this.isolationConfigs.get(profileId);
  }

  /**
   * Get all isolation configs
   */
  getAllIsolationConfigs(): IsolatedProfileConfig[] {
    return Array.from(this.isolationConfigs.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalIsolatedProfiles: this.isolationConfigs.size,
      profiles: Array.from(this.isolationConfigs.values()).map(c => ({
        profileId: c.profileId,
        fingerprint: `${c.fingerprint.brand} ${c.fingerprint.model}`,
        proxy: c.proxy ? `${c.proxy.host}:${c.proxy.port}` : 'None',
        sessionSaved: c.sessionSaved,
        automationScriptsCount: c.automationScripts.length,
        isolationLevel: c.isolationLevel
      }))
    };
  }
}

export default ProfileIsolationService;
