import { Express, Request, Response } from 'express';
import path from 'path';
import LDPlayerController from '../core/LDPlayerController.js';
import ProfileManager from '../services/ProfileManager.js';
import TaskExecutor from '../services/TaskExecutor.js';
import MobileScriptExecutor from '../services/MobileScriptExecutor.js';
import AppiumScriptService from '../services/AppiumScriptService.js';
import { setupAuthRoutes } from './auth.js';
import { logger } from '../utils/logger.js';
import { mockSettings, mockStatistics } from './mockData.js';
import { getAutoInstallApps } from '../config/apps.config.js';

import DirectMobileScriptService from '../services/DirectMobileScriptService.js';

import UIInspectorService from '../services/UIInspectorService.js';
import DeviceMonitor from '../services/DeviceMonitor.js';

import FingerprintService from '../services/FingerprintService.js';
import proxyRouter from './proxy.js';
import { setupIsolationRoutes } from './isolation.js';
import ProfileIsolationService from '../services/ProfileIsolationService.js';
import SessionManager from '../services/SessionManager.js';
import ActionRecorder from '../services/ActionRecorder.js';

interface RouteServices {
  ldPlayerController: LDPlayerController;
  profileManager: ProfileManager;
  taskExecutor: TaskExecutor;
  scriptExecutor: MobileScriptExecutor;
  appiumScriptService?: AppiumScriptService;
  directScriptService?: DirectMobileScriptService;
  uiInspectorService?: UIInspectorService;
  deviceMonitor?: DeviceMonitor;
  fingerprintService?: FingerprintService;
  isolationService?: ProfileIsolationService;
  sessionManager?: SessionManager;
  actionRecorder?: ActionRecorder;
}

export function setupRoutes(app: Express, services: RouteServices) {
  const { ldPlayerController, profileManager, taskExecutor, scriptExecutor, appiumScriptService, directScriptService, uiInspectorService, deviceMonitor, fingerprintService, isolationService, sessionManager, actionRecorder } = services;

  // Setup authentication routes first
  setupAuthRoutes(app);

  // Setup proxy management routes
  app.use(proxyRouter);

  // Setup isolation routes (GemLogin-like features)
  if (isolationService && sessionManager && actionRecorder) {
    setupIsolationRoutes(app, isolationService, sessionManager, actionRecorder);
  }

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime()
    });
  });

  // Profile routes
  // Get available apps from apks folder
  app.get('/api/apps/available', async (req: Request, res: Response) => {
    try {
      const { scanAvailableApps } = await import('../utils/scanApks.js');
      const apps = await scanAvailableApps();
      res.json(apps);
    } catch (error) {
      logger.error('Error getting available apps:', error);
      res.status(500).json({ error: 'Failed to get available apps' });
    }
  });

  app.get('/api/profiles', (req: Request, res: Response) => {
    try {
      const profiles = profileManager.getAllProfiles();
      // Return array directly for React app compatibility
      res.json(profiles);
    } catch (error) {
      logger.error('Error getting profiles:', error);
      res.status(500).json({ error: 'Failed to get profiles' });
    }
  });

  // Get default profile configuration
  app.get('/api/profiles/default-config', (req: Request, res: Response) => {
    try {
      const defaultConfig = {
        settings: {
          resolution: '360,640',
          dpi: 160,
          cpu: 1,           // Giảm từ 2 → 1 core (tối ưu cho multi-instance)
          memory: 1536,     // Giảm từ 2048 → 1536MB (tiết kiệm RAM)
          androidVersion: '9'
        },
        device: {},
        network: {
          useProxy: false
        },
        // Auto-install apps based on .env config
        selectedApps: getAutoInstallApps().map(app => path.basename(app.apkPath)),
        autoRunScripts: [],
        // Auto-activate by default (launch + install apps after creating profile)
        autoActivate: true
      };
      res.json(defaultConfig);
    } catch (error) {
      logger.error('Error getting default config:', error);
      res.status(500).json({ error: 'Failed to get default config' });
    }
  });

  app.post('/api/profiles', async (req: Request, res: Response) => {
    try {
      const { selectedApps, autoRunScripts, autoActivate = true, autoApplyFingerprint = true, fingerprintBrand, ...profileData } = req.body;

      // Validate required fields
      if (!profileData.name) {
        return res.status(400).json({ error: 'Profile name is required' });
      }

      // Apply default settings if not provided
      const defaultSettings = {
        resolution: '360,640',
        dpi: 160,
        cpu: 1,           // Giảm từ 2 → 1 core (tối ưu cho multi-instance)
        memory: 1536,     // Giảm từ 2048 → 1536MB (tiết kiệm RAM)
        androidVersion: '9'
      };

      profileData.settings = {
        ...defaultSettings,
        ...(profileData.settings || {})
      };

      // Add fingerprint options to profile data
      profileData.autoApplyFingerprint = autoApplyFingerprint;
      if (fingerprintBrand) {
        profileData.fingerprintBrand = fingerprintBrand;
      }

      // Create profile
      const profile = await profileManager.createProfile(profileData);

      // Install selected apps if provided (otherwise use auto-install from .env)
      if (selectedApps && Array.isArray(selectedApps) && selectedApps.length > 0) {
        // Store selected apps in profile metadata for installation during activation
        profile.metadata = {
          ...profile.metadata,
          selectedApps,
        };
      }

      // Store auto-run scripts if provided
      if (autoRunScripts && Array.isArray(autoRunScripts) && autoRunScripts.length > 0) {
        profile.metadata = {
          ...profile.metadata,
          autoRunScripts,
        };
      }

      // Update profile with metadata
      if (profile.metadata && Object.keys(profile.metadata).length > 0) {
        await profileManager.updateProfile(profile.id, { metadata: profile.metadata });
      }

      logger.info(`Created profile "${profile.name}" with ID ${profile.id}`);

      // Auto-activate if requested (launch + install apps)
      if (autoActivate) {
        logger.info(`Auto-activating profile "${profile.name}"...`);
        try {
          await profileManager.activateProfile(profile.id);
          logger.info(`Profile "${profile.name}" activated successfully`);
        } catch (activateError) {
          logger.error(`Failed to auto-activate profile "${profile.name}":`, activateError);
          // Return profile even if activation fails
          return res.json({
            success: true,
            profile,
            warning: 'Profile created but failed to auto-activate. Please activate manually.'
          });
        }
      }

      res.json({ success: true, profile });
    } catch (error) {
      logger.error('Error creating profile:', error);
      res.status(500).json({ error: 'Failed to create profile' });
    }
  });

  app.put('/api/profiles/:profileId', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      logger.info(`[UPDATE PROFILE] Request received for profile ${profileId}`);
      logger.info(`[UPDATE PROFILE] Update data:`, JSON.stringify(req.body, null, 2));
      const profile = await profileManager.updateProfile(profileId, req.body);
      logger.info(`[UPDATE PROFILE] Profile ${profileId} updated successfully`);
      res.json({ profile });
    } catch (error) {
      logger.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.delete('/api/profiles/:profileId', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      await profileManager.deleteProfile(profileId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting profile:', error);
      res.status(500).json({ error: 'Failed to delete profile' });
    }
  });

  app.post('/api/profiles/:profileId/activate', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      await profileManager.activateProfile(profileId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error activating profile:', error);
      res.status(500).json({ error: 'Failed to activate profile' });
    }
  });

  app.post('/api/profiles/:profileId/deactivate', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      await profileManager.deactivateProfile(profileId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deactivating profile:', error);
      res.status(500).json({ error: 'Failed to deactivate profile' });
    }
  });

  // Clone profile endpoint - always clones with ALL apps and configurations
  // Note: LDPlayer's copy command always includes everything (settings + apps)
  app.post('/api/profiles/:profileId/clone', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { newName, launchAndSetup, autoApplyFingerprint = true, fingerprintBrand } = req.body;

      if (!newName) {
        return res.status(400).json({ error: 'newName is required' });
      }

      logger.info(`Cloning profile ${profileId} to "${newName}"...`);
      logger.info(`This will clone ALL configurations and installed applications`);

      const clonedProfile = await profileManager.cloneProfile(
        profileId,
        newName,
        {
          launchAndSetup,
          autoApplyFingerprint,
          fingerprintBrand
        }
      );

      res.json({
        success: true,
        profile: clonedProfile,
        message: 'Profile cloned successfully with all apps and configurations'
      });
    } catch (error) {
      logger.error('Error cloning profile:', error);
      res.status(500).json({ error: 'Failed to clone profile' });
    }
  });

  app.post('/api/profiles/:profileId/install-app', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { apkFileName } = req.body;
      if (!apkFileName) {
        return res.status(400).json({ error: 'apkFileName is required' });
      }
      await profileManager.installAppOnProfile(profileId, apkFileName);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error installing app:', error);
      res.status(500).json({ error: 'Failed to install app' });
    }
  });

  app.post('/api/profiles/:profileId/launch-app', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { packageName } = req.body;
      if (!packageName) {
        return res.status(400).json({ error: 'packageName is required' });
      }
      await profileManager.launchAppOnProfile(profileId, packageName);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error launching app:', error);
      res.status(500).json({ error: 'Failed to launch app' });
    }
  });

  // Clear app data (reset app to initial state)
  app.post('/api/profiles/:profileId/clear-app-data', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { packageName } = req.body;

      if (!packageName) {
        return res.status(400).json({ error: 'packageName is required' });
      }

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (profile.status !== 'active') {
        return res.status(400).json({ error: 'Profile must be active to clear app data' });
      }

      // Clear app data using LDPlayerController
      await ldPlayerController.clearAppData(profile.port, packageName);

      logger.info(`Cleared data for ${packageName} on profile ${profile.name}`);
      res.json({
        success: true,
        message: `App data cleared for ${packageName}. The app will restart in clean state.`
      });
    } catch (error) {
      logger.error('Error clearing app data:', error);
      res.status(500).json({ error: 'Failed to clear app data' });
    }
  });

  app.post('/api/profiles/import-existing', async (req: Request, res: Response) => {
    try {
      const profiles = await profileManager.scanAndImportAllInstances();
      res.json({ success: true, count: profiles.length, profiles });
    } catch (error) {
      logger.error('Error importing existing instances:', error);
      res.status(500).json({ error: 'Failed to import existing instances' });
    }
  });

  app.post('/api/profiles/import-instance', async (req: Request, res: Response) => {
    try {
      const { instanceName, index } = req.body;
      if (!instanceName || index === undefined) {
        return res.status(400).json({ error: 'instanceName and index are required' });
      }
      const profile = await profileManager.importExistingInstance(instanceName, index);
      res.json({ success: true, profile });
    } catch (error) {
      logger.error('Error importing instance:', error);
      res.status(500).json({ error: 'Failed to import instance' });
    }
  });

  // Scan installed apps on profile/instance
  app.get('/api/profiles/:profileId/installed-apps', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Get installed apps via ADB
      const apps = await ldPlayerController.getInstalledApps(profile.port);

      // Update profile with detected apps
      const appsObject: Record<string, any> = {};
      apps.forEach(app => {
        appsObject[app.packageName] = {
          installed: true,
          packageName: app.packageName,
          appName: app.appName
        };
      });

      // Update profile
      await profileManager.updateProfile(profileId, {
        apps: appsObject
      });

      logger.info(`Scanned ${apps.length} apps for profile ${profile.name}`);
      res.json({ apps, count: apps.length });

    } catch (error) {
      logger.error('Error scanning installed apps:', error);
      res.status(500).json({ error: 'Failed to scan installed apps' });
    }
  });

  // Scan apps for all active profiles
  app.post('/api/profiles/scan-all-apps', async (req: Request, res: Response) => {
    try {
      const profiles = profileManager.getAllProfiles();
      const results = [];

      for (const profile of profiles) {
        if (profile.status === 'active') {
          try {
            const apps = await ldPlayerController.getInstalledApps(profile.port);

            // Update profile
            const appsObject: Record<string, any> = {};
            apps.forEach(app => {
              appsObject[app.packageName] = {
                installed: true,
                packageName: app.packageName,
                appName: app.appName
              };
            });

            await profileManager.updateProfile(profile.id, {
              apps: appsObject
            });

            results.push({
              profileId: profile.id,
              profileName: profile.name,
              appsCount: apps.length,
              apps
            });

            logger.info(`Scanned ${apps.length} apps for profile ${profile.name}`);
          } catch (error) {
            logger.error(`Failed to scan apps for profile ${profile.name}:`, error);
            results.push({
              profileId: profile.id,
              profileName: profile.name,
              error: 'Failed to scan apps'
            });
          }
        }
      }

      res.json({
        success: true,
        scannedProfiles: results.length,
        results
      });

    } catch (error) {
      logger.error('Error scanning all apps:', error);
      res.status(500).json({ error: 'Failed to scan all apps' });
    }
  });

  // Check if specific apps are installed
  app.post('/api/profiles/:profileId/check-apps', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { packageNames } = req.body;

      if (!Array.isArray(packageNames)) {
        return res.status(400).json({ error: 'packageNames must be an array' });
      }

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const results = await ldPlayerController.checkAppsInstalled(profile.port, packageNames);

      res.json({ results });

    } catch (error) {
      logger.error('Error checking apps:', error);
      res.status(500).json({ error: 'Failed to check apps' });
    }
  });

  // Task routes
  app.get('/api/tasks', (req: Request, res: Response) => {
    try {
      const tasks = taskExecutor.getAllTasks();
      // Return array directly for React app compatibility
      res.json(tasks);
    } catch (error) {
      logger.error('Error getting tasks:', error);
      res.status(500).json({ error: 'Failed to get tasks' });
    }
  });

  app.post('/api/tasks', async (req: Request, res: Response) => {
    try {
      const task = await taskExecutor.addTask(req.body);
      res.json({ task });
    } catch (error) {
      logger.error('Error adding task:', error);
      res.status(500).json({ error: 'Failed to add task' });
    }
  });

  app.delete('/api/tasks/:taskId', (req: Request, res: Response) => {
    try {
      const success = taskExecutor.cancelTask(req.params.taskId);
      res.json({ success });
    } catch (error) {
      logger.error('Error canceling task:', error);
      res.status(500).json({ error: 'Failed to cancel task' });
    }
  });

  // Instance management routes
  app.get('/api/instances', async (req: Request, res: Response) => {
    try {
      // Auto-sync instance states with LDPlayer before returning
      await ldPlayerController.syncAllInstancesState();
      const instances = ldPlayerController.getInstances();
      res.json({ instances });
    } catch (error) {
      logger.error('Error getting instances:', error);
      res.status(500).json({ error: 'Failed to get instances' });
    }
  });

  app.post('/api/instances/:instanceName/launch', async (req: Request, res: Response) => {
    try {
      await ldPlayerController.launchInstance(req.params.instanceName);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error launching instance:', error);
      res.status(500).json({ error: 'Failed to launch instance' });
    }
  });

  app.post('/api/instances/:instanceName/stop', async (req: Request, res: Response) => {
    try {
      const { forceCleanup = true, timeout = 30000 } = req.body;
      await ldPlayerController.stopInstance(req.params.instanceName, { forceCleanup, timeout });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error stopping instance:', error);
      res.json({ error: 'Failed to stop instance' });
    }
  });

  // Restart instance gracefully
  app.post('/api/instances/:instanceName/restart', async (req: Request, res: Response) => {
    try {
      const { timeout = 120000, verifyHealth = true } = req.body;
      await ldPlayerController.restartInstance(req.params.instanceName, { timeout, verifyHealth });
      res.json({ success: true, message: 'Instance restarted successfully' });
    } catch (error) {
      logger.error('Error restarting instance:', error);
      res.status(500).json({ error: 'Failed to restart instance' });
    }
  });

  // Sync instance state (fix inconsistent states)
  app.post('/api/instances/:instanceName/sync-state', async (req: Request, res: Response) => {
    try {
      await ldPlayerController.syncInstanceState(req.params.instanceName);
      const instance = ldPlayerController.getInstance(req.params.instanceName);
      res.json({
        success: true,
        message: 'Instance state synchronized',
        instance
      });
    } catch (error) {
      logger.error('Error syncing instance state:', error);
      res.status(500).json({ error: 'Failed to sync instance state' });
    }
  });

  // Sync all instances state
  app.post('/api/instances/sync-all-states', async (req: Request, res: Response) => {
    try {
      await ldPlayerController.syncAllInstancesState();
      const instances = ldPlayerController.getInstances();
      res.json({
        success: true,
        message: 'All instances synchronized',
        instances
      });
    } catch (error) {
      logger.error('Error syncing all instances:', error);
      res.status(500).json({ error: 'Failed to sync all instances' });
    }
  });

  // Device control routes
  app.post('/api/device/:port/tap', async (req: Request, res: Response) => {
    try {
      const { x, y } = req.body;
      await ldPlayerController.tap(parseInt(req.params.port), x, y);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error performing tap:', error);
      res.status(500).json({ error: 'Failed to perform tap' });
    }
  });

  app.post('/api/device/:port/swipe', async (req: Request, res: Response) => {
    try {
      const { x1, y1, x2, y2, duration } = req.body;
      await ldPlayerController.swipe(
        parseInt(req.params.port),
        x1, y1, x2, y2,
        duration
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Error performing swipe:', error);
      res.status(500).json({ error: 'Failed to perform swipe' });
    }
  });

  app.post('/api/device/:port/text', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      await ldPlayerController.inputText(parseInt(req.params.port), text);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error inputting text:', error);
      res.status(500).json({ error: 'Failed to input text' });
    }
  });

  app.post('/api/device/:port/screenshot', async (req: Request, res: Response) => {
    try {
      const { savePath } = req.body;
      await ldPlayerController.screenshot(parseInt(req.params.port), savePath);
      res.json({ success: true, path: savePath });
    } catch (error) {
      logger.error('Error taking screenshot:', error);
      res.status(500).json({ error: 'Failed to take screenshot' });
    }
  });

  // Statistics route
  app.get('/api/statistics', (req: Request, res: Response) => {
    try {
      const stats = {
        profiles: profileManager.getStatistics(),
        tasks: {
          total: taskExecutor.getAllTasks().length,
          pending: taskExecutor.getPendingTasks().length,
          running: taskExecutor.getRunningTasks().length,
          completed: taskExecutor.getAllTasks().filter(t => t.status === 'completed').length,
          failed: taskExecutor.getAllTasks().filter(t => t.status === 'failed').length
        },
        instances: {
          total: ldPlayerController.getInstances().length,
          running: ldPlayerController.getInstances().filter(i => i.status === 'running').length,
          stopped: ldPlayerController.getInstances().filter(i => i.status === 'stopped').length
        }
      };
      res.json(stats);
    } catch (error) {
      logger.error('Error getting statistics:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  // Additional routes needed by React app

  // Settings routes
  app.get('/api/settings', (req: Request, res: Response) => {
    try {
      res.json(mockSettings);
    } catch (error) {
      logger.error('Error getting settings:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    try {
      // In real implementation, save settings
      res.json({ ...mockSettings, ...req.body });
    } catch (error) {
      logger.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // Fetch tasks from task center
  app.post('/api/tasks/fetch-from-task-center', async (req: Request, res: Response) => {
    try {
      // Mock implementation - in real app would fetch from task center
      const tasks = taskExecutor.getAllTasks();
      res.json({ message: 'Tasks fetched successfully', tasks });
    } catch (error) {
      logger.error('Error fetching tasks from task center:', error);
      res.status(500).json({ error: 'Failed to fetch tasks from task center' });
    }
  });

  // Task execution routes
  app.post('/api/tasks/:id/run', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      const { headless = false } = req.body;
      // Mock execute task
      res.json({ success: true, message: 'Task started', taskId, headless });
    } catch (error) {
      logger.error('Error running task:', error);
      res.status(500).json({ error: 'Failed to run task' });
    }
  });

  app.post('/api/tasks/:id/launch', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      const { headless = false } = req.body;
      // Mock launch task
      res.json({ success: true, message: 'Task launched', taskId, headless });
    } catch (error) {
      logger.error('Error launching task:', error);
      res.status(500).json({ error: 'Failed to launch task' });
    }
  });

  // Profile launch/stop routes
  // Launch instance only (without running scripts)
  app.post('/api/profiles/:id/launch-only', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.id);
      logger.info(`[LAUNCH-ONLY] Request received for profile ID: ${profileId}`);

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        logger.error(`[LAUNCH-ONLY] Profile ${profileId} not found`);
        return res.status(404).json({ error: 'Profile not found' });
      }

      logger.info(`[LAUNCH-ONLY] Launching instance: ${profile.instanceName} (Profile: ${profile.name})`);
      await profileManager.launchInstanceOnly(profileId);

      logger.info(`[LAUNCH-ONLY] Successfully launched instance: ${profile.instanceName}`);
      res.json({ success: true, message: 'Instance launched without scripts' });
    } catch (error) {
      logger.error('[LAUNCH-ONLY] Error launching instance:', error);
      res.status(500).json({ error: 'Failed to launch instance' });
    }
  });

  app.post('/api/profiles/:id/launch', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.id);
      const { headless = false } = req.body;

      let profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Activate profile if not already active
      if (profile.status !== 'active') {
        await profileManager.activateProfile(profileId);
        // Get fresh profile after activation
        profile = profileManager.getProfile(profileId)!;
      }

      // IMPORTANT: Always get FRESH profile from DB to ensure latest script content
      // (in case user just updated script but instance was already active)
      profile = profileManager.getProfile(profileId)!;

      // Execute script if exists in profile metadata
      const scriptContent = profile.metadata?.scriptContent;
      if (scriptContent && scriptContent.trim() !== '') {
        if (!directScriptService) {
          return res.status(500).json({ error: 'Direct Script Service not initialized' });
        }

        logger.info(`Executing script for profile ${profile.name}`);
        const task = await directScriptService.queueScript(scriptContent, profileId);

        res.json({
          success: true,
          message: 'Profile launched and script executing',
          execution: {
            taskId: task.id,
            status: task.status
          }
        });
      } else {
        logger.info(`Profile ${profile.name} has no script to execute`);
        res.json({ success: true, message: 'Profile launched (no script to execute)' });
      }
    } catch (error) {
      logger.error('Error launching profile:', error);
      res.status(500).json({ error: 'Failed to launch profile' });
    }
  });

  app.post('/api/profiles/:id/stop', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.id);
      await profileManager.deactivateProfile(profileId);
      res.json({ success: true, message: 'Profile stopped' });
    } catch (error) {
      logger.error('Error stopping profile:', error);
      res.status(500).json({ error: 'Failed to stop profile' });
    }
  });

  // Refresh all profile statuses from LDPlayer (also syncs instance states)
  app.post('/api/profiles/refresh-status', async (req: Request, res: Response) => {
    try {
      // Sync both profiles AND instances for complete status accuracy
      await Promise.all([
        profileManager.refreshAllProfileStatuses(),
        ldPlayerController.syncAllInstancesState()
      ]);

      res.json({ success: true, message: 'Profile and instance statuses refreshed' });
    } catch (error) {
      logger.error('Error refreshing statuses:', error);
      res.status(500).json({ error: 'Failed to refresh statuses' });
    }
  });

  // Get single task/profile by ID
  app.get('/api/tasks/:id', (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      const task = taskExecutor.getAllTasks().find(t => String(t.id) === taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      logger.error('Error getting task:', error);
      res.status(500).json({ error: 'Failed to get task' });
    }
  });

  app.get('/api/profiles/:id', (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.id);
      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      res.json(profile);
    } catch (error) {
      logger.error('Error getting profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  // Twitter caring routes (mock for now)
  app.get('/api/twitter-caring/tasks', (req: Request, res: Response) => {
    try {
      res.json([]);
    } catch (error) {
      logger.error('Error getting twitter caring tasks:', error);
      res.status(500).json({ error: 'Failed to get twitter caring tasks' });
    }
  });

  app.post('/api/twitter-caring/execute', async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: 'Twitter caring task executed' });
    } catch (error) {
      logger.error('Error executing twitter caring:', error);
      res.status(500).json({ error: 'Failed to execute twitter caring' });
    }
  });

  // ============================================
  // Script Execution Routes (BoxPhone-like)
  // ============================================

  // Execute script on profile
  app.post('/api/profiles/:profileId/execute-script', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { scriptType, scriptName, scriptData } = req.body;

      const task = await scriptExecutor.queueScript({
        profileId,
        scriptType,
        scriptName,
        scriptData
      });

      res.json({ success: true, task });
    } catch (error) {
      logger.error('Error executing script:', error);
      res.status(500).json({ error: 'Failed to execute script' });
    }
  });

  // Get all script tasks
  app.get('/api/scripts', (req: Request, res: Response) => {
    try {
      const scripts = scriptExecutor.getAllTasks();
      res.json(scripts);
    } catch (error) {
      logger.error('Error getting scripts:', error);
      res.status(500).json({ error: 'Failed to get scripts' });
    }
  });

  // Twitter shortcuts
  app.post('/api/twitter/like', async (req: Request, res: Response) => {
    try {
      const { profileId, searchQuery, count } = req.body;
      const task = await scriptExecutor.queueScript({
        profileId,
        scriptType: 'twitter',
        scriptName: 'likeTweets',
        scriptData: { searchQuery, count }
      });
      res.json({ success: true, task });
    } catch (error) {
      logger.error('Error executing Twitter like:', error);
      res.status(500).json({ error: 'Failed to execute Twitter like' });
    }
  });

  app.post('/api/twitter/post', async (req: Request, res: Response) => {
    try {
      const { profileId, text, media, poll } = req.body;
      const task = await scriptExecutor.queueScript({
        profileId,
        scriptType: 'twitter',
        scriptName: 'postTweet',
        scriptData: { text, media, poll }
      });
      res.json({ success: true, task });
    } catch (error) {
      logger.error('Error executing Twitter post:', error);
      res.status(500).json({ error: 'Failed to execute Twitter post' });
    }
  });

  // ============================================
  // Appium Script Execution Routes (Puppeteer-style)
  // ============================================

  // Execute custom JavaScript code on mobile instance
  app.post('/api/appium/execute', async (req: Request, res: Response) => {
    try {
      if (!appiumScriptService) {
        return res.status(500).json({ error: 'Appium Script Service not initialized' });
      }

      const { profileId, scriptCode } = req.body;

      if (!profileId || !scriptCode) {
        return res.status(400).json({ error: 'profileId and scriptCode are required' });
      }

      const task = await appiumScriptService.queueScript(scriptCode, profileId);
      res.json({ success: true, task });
    } catch (error) {
      logger.error('Error executing Appium script:', error);
      res.status(500).json({ error: 'Failed to execute Appium script' });
    }
  });

  // Get all Appium script tasks
  app.get('/api/appium/tasks', (req: Request, res: Response) => {
    try {
      if (!appiumScriptService) {
        return res.status(500).json({ error: 'Appium Script Service not initialized' });
      }

      const tasks = appiumScriptService.getAllTasks();
      res.json(tasks);
    } catch (error) {
      logger.error('Error getting Appium tasks:', error);
      res.status(500).json({ error: 'Failed to get Appium tasks' });
    }
  });

  // Get specific Appium task by ID
  app.get('/api/appium/tasks/:taskId', (req: Request, res: Response) => {
    try {
      if (!appiumScriptService) {
        return res.status(500).json({ error: 'Appium Script Service not initialized' });
      }

      const task = appiumScriptService.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      logger.error('Error getting Appium task:', error);
      res.status(500).json({ error: 'Failed to get Appium task' });
    }
  });

  // Get Appium tasks for specific profile
  app.get('/api/appium/profiles/:profileId/tasks', (req: Request, res: Response) => {
    try {
      if (!appiumScriptService) {
        return res.status(500).json({ error: 'Appium Script Service not initialized' });
      }

      const profileId = parseInt(req.params.profileId);
      const tasks = appiumScriptService.getTasksForProfile(profileId);
      res.json(tasks);
    } catch (error) {
      logger.error('Error getting profile Appium tasks:', error);
      res.status(500).json({ error: 'Failed to get profile Appium tasks' });
    }
  });

  // Close Appium session for profile
  app.post('/api/appium/profiles/:profileId/close-session', async (req: Request, res: Response) => {
    try {
      if (!appiumScriptService) {
        return res.status(500).json({ error: 'Appium Script Service not initialized' });
      }

      const profileId = parseInt(req.params.profileId);
      await appiumScriptService.closeSession(profileId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error closing Appium session:', error);
      res.status(500).json({ error: 'Failed to close Appium session' });
    }
  });

  // Clear completed Appium tasks
  app.post('/api/appium/tasks/clear-completed', (req: Request, res: Response) => {
    try {
      if (!appiumScriptService) {
        return res.status(500).json({ error: 'Appium Script Service not initialized' });
      }

      appiumScriptService.clearCompletedTasks();
      res.json({ success: true });
    } catch (error) {
      logger.error('Error clearing completed tasks:', error);
      res.status(500).json({ error: 'Failed to clear completed tasks' });
    }
  });

  // ============================================
  // Direct Mobile Script Routes (ADB-based, NO Appium server needed!)
  // ============================================

  // Execute JavaScript code using ADB directly (like Puppeteer!)
  app.post('/api/direct/execute', async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG API] /api/direct/execute called');

      if (!directScriptService) {
        console.error('[DEBUG API] DirectScriptService not initialized!');
        return res.status(500).json({ error: 'Direct Script Service not initialized' });
      }

      const { profileId, scriptCode } = req.body;
      console.log(`[DEBUG API] Request: profileId=${profileId}, scriptLength=${scriptCode?.length || 0}`);

      if (!profileId || !scriptCode) {
        console.error('[DEBUG API] Missing profileId or scriptCode');
        return res.status(400).json({ error: 'profileId and scriptCode are required' });
      }

      console.log(`[DEBUG API] Queuing script for profile ${profileId}...`);
      const task = await directScriptService.queueScript(scriptCode, profileId);
      console.log(`[DEBUG API] Script queued successfully: taskId=${task.id}, status=${task.status}`);

      res.json({ success: true, task });
    } catch (error) {
      console.error('[DEBUG API] Error executing direct script:', error);
      logger.error('Error executing direct script:', error);
      res.status(500).json({ error: 'Failed to execute direct script' });
    }
  });

  // Get all direct script tasks
  app.get('/api/direct/tasks', (req: Request, res: Response) => {
    try {
      if (!directScriptService) {
        return res.status(500).json({ error: 'Direct Script Service not initialized' });
      }

      const tasks = directScriptService.getAllTasks();
      res.json(tasks);
    } catch (error) {
      logger.error('Error getting direct tasks:', error);
      res.status(500).json({ error: 'Failed to get direct tasks' });
    }
  });

  // Get specific direct task by ID
  app.get('/api/direct/tasks/:taskId', (req: Request, res: Response) => {
    try {
      if (!directScriptService) {
        return res.status(500).json({ error: 'Direct Script Service not initialized' });
      }

      const task = directScriptService.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      logger.error('Error getting direct task:', error);
      res.status(500).json({ error: 'Failed to get direct task' });
    }
  });

  // Get direct tasks for specific profile
  app.get('/api/direct/profiles/:profileId/tasks', (req: Request, res: Response) => {
    try {
      if (!directScriptService) {
        return res.status(500).json({ error: 'Direct Script Service not initialized' });
      }

      const profileId = parseInt(req.params.profileId);
      const tasks = directScriptService.getTasksForProfile(profileId);
      res.json(tasks);
    } catch (error) {
      logger.error('Error getting profile direct tasks:', error);
      res.status(500).json({ error: 'Failed to get profile direct tasks' });
    }
  });

  // Clear completed direct tasks
  app.post('/api/direct/tasks/clear-completed', (req: Request, res: Response) => {
    try {
      if (!directScriptService) {
        return res.status(500).json({ error: 'Direct Script Service not initialized' });
      }

      directScriptService.clearCompletedTasks();
      res.json({ success: true });
    } catch (error) {
      logger.error('Error clearing completed direct tasks:', error);
      res.status(500).json({ error: 'Failed to clear completed direct tasks' });
    }
  });

  // ============================================
  // Task Center Integration - Webhook Endpoints
  // ============================================

  /**
   * Webhook endpoint for Task Center to send JS scripts
   * Task Center will POST to this endpoint with script data
   */
  app.post('/api/task-center/webhook/script', async (req: Request, res: Response) => {
    try {
      const {
        taskId,
        scriptCode,
        profileId,
        priority = 5,
        metadata = {},
        apiKey
      } = req.body;

      // Verify API key if configured
      const expectedApiKey = process.env.TASK_CENTER_API_KEY;
      if (expectedApiKey && apiKey !== expectedApiKey) {
        logger.warn('Task Center webhook: Invalid API key');
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Validate required fields
      if (!scriptCode) {
        return res.status(400).json({ error: 'scriptCode is required' });
      }

      // Create task in TaskExecutor
      const task = await taskExecutor.addTask({
        type: 'appium_script',
        profileId: profileId || '', // Will be assigned to available profile if empty
        scriptCode,
        data: metadata,
        priority,
        maxRetries: 3,
        source: 'task_center'
      });

      logger.info(`Received script from Task Center: ${task.id}${taskId ? ` (Task Center ID: ${taskId})` : ''}`);

      res.json({
        success: true,
        taskId: task.id,
        message: 'Script queued for execution',
        status: task.status
      });
    } catch (error) {
      logger.error('Error handling Task Center webhook:', error);
      res.status(500).json({ error: 'Failed to queue script' });
    }
  });

  /**
   * Get task status for Task Center
   */
  app.get('/api/task-center/tasks/:taskId/status', (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const task = taskExecutor.getTask(taskId);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({
        id: task.id,
        status: task.status,
        progress: task.status === 'running' ? 50 : task.status === 'completed' ? 100 : 0,
        result: task.result,
        error: task.error,
        logs: task.logs,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt
      });
    } catch (error) {
      logger.error('Error getting task status:', error);
      res.status(500).json({ error: 'Failed to get task status' });
    }
  });

  /**
   * Batch endpoint: Task Center sends multiple scripts at once
   */
  app.post('/api/task-center/webhook/scripts/batch', async (req: Request, res: Response) => {
    try {
      const { scripts, apiKey } = req.body;

      // Verify API key
      const expectedApiKey = process.env.TASK_CENTER_API_KEY;
      if (expectedApiKey && apiKey !== expectedApiKey) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      if (!Array.isArray(scripts)) {
        return res.status(400).json({ error: 'scripts must be an array' });
      }

      const tasks = [];
      for (const script of scripts) {
        const task = await taskExecutor.addTask({
          type: 'appium_script',
          profileId: script.profileId || '',
          scriptCode: script.scriptCode,
          data: script.metadata || {},
          priority: script.priority || 5,
          maxRetries: 3,
          source: 'task_center'
        });
        tasks.push({
          taskId: task.id,
          status: task.status,
          originalId: script.taskId
        });
      }

      logger.info(`Received ${scripts.length} scripts from Task Center in batch`);

      res.json({
        success: true,
        count: tasks.length,
        tasks
      });
    } catch (error) {
      logger.error('Error handling batch webhook:', error);
      res.status(500).json({ error: 'Failed to queue scripts' });
    }
  });

  // ============================================
  // Profile Settings Routes (for Settings Tab in Profile)
  // ============================================

  // Get profile settings (including auto-run scripts, apps, etc.)
  app.get('/api/profiles/:profileId/settings', (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Return comprehensive settings for the profile
      const settings = {
        profileId: profile.id,
        profileName: profile.name,
        instanceName: profile.instanceName,
        status: profile.status,

        // Hardware settings
        hardware: {
          resolution: profile.settings.resolution,
          dpi: profile.settings.dpi,
          cpu: profile.settings.cpu,
          memory: profile.settings.memory,
          androidVersion: profile.settings.androidVersion
        },

        // Device info
        device: profile.device || {},

        // Network settings
        network: profile.network || { useProxy: false },

        // Location settings
        location: profile.location,

        // Installed apps
        apps: profile.apps || {},

        // Auto-run scripts configuration
        autoRunScripts: profile.metadata?.autoRunScripts || [],

        // Selected apps for installation
        selectedApps: profile.metadata?.selectedApps || [],

        // Additional metadata
        metadata: profile.metadata || {}
      };

      res.json(settings);
    } catch (error) {
      logger.error('Error getting profile settings:', error);
      res.status(500).json({ error: 'Failed to get profile settings' });
    }
  });

  // Update profile settings (including auto-run scripts)
  app.put('/api/profiles/:profileId/settings', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const {
        hardware,
        device,
        network,
        location,
        autoRunScripts,
        selectedApps,
        metadata
      } = req.body;

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Prepare update object
      const updates: any = {};

      if (hardware) {
        updates.settings = {
          ...profile.settings,
          ...hardware
        };
      }

      if (device) {
        updates.device = {
          ...profile.device,
          ...device
        };
      }

      if (network) {
        updates.network = {
          ...profile.network,
          ...network
        };
      }

      if (location) {
        updates.location = location;
      }

      // Update metadata (including scripts and apps)
      if (autoRunScripts || selectedApps || metadata) {
        updates.metadata = {
          ...profile.metadata,
          ...(autoRunScripts !== undefined && { autoRunScripts }),
          ...(selectedApps !== undefined && { selectedApps }),
          ...(metadata && metadata)
        };
      }

      // Apply updates
      const updatedProfile = await profileManager.updateProfile(profileId, updates);

      logger.info(`Updated settings for profile ${profile.name}`);
      res.json({
        success: true,
        profile: updatedProfile,
        message: 'Profile settings updated successfully'
      });
    } catch (error) {
      logger.error('Error updating profile settings:', error);
      res.status(500).json({ error: 'Failed to update profile settings' });
    }
  });

  // ============================================
  // Profile Scripts Configuration Routes
  // ============================================

  // Set scripts for instance (auto-run configuration)
  app.put('/api/profiles/:profileId/scripts', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { autoRunScripts } = req.body;

      if (!Array.isArray(autoRunScripts)) {
        return res.status(400).json({ error: 'autoRunScripts must be an array' });
      }

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Update profile metadata with auto-run scripts
      const updatedProfile = await profileManager.updateProfile(profileId, {
        metadata: {
          ...profile.metadata,
          autoRunScripts
        }
      });

      logger.info(`Updated scripts for profile ${profile.name}: ${autoRunScripts.length} script(s)`);
      res.json({ success: true, profile: updatedProfile });
    } catch (error) {
      logger.error('Error setting profile scripts:', error);
      res.status(500).json({ error: 'Failed to set profile scripts' });
    }
  });

  // Get scripts configuration for instance
  app.get('/api/profiles/:profileId/scripts', (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const autoRunScripts = profile.metadata?.autoRunScripts || [];
      res.json({ autoRunScripts });
    } catch (error) {
      logger.error('Error getting profile scripts:', error);
      res.status(500).json({ error: 'Failed to get profile scripts' });
    }
  });

  // Add a script to instance
  app.post('/api/profiles/:profileId/scripts', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { scriptName, scriptData } = req.body;

      if (!scriptName) {
        return res.status(400).json({ error: 'scriptName is required' });
      }

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const currentScripts = profile.metadata?.autoRunScripts || [];
      const newScript = { scriptName, scriptData: scriptData || {} };

      // Check if script already exists
      const existingIndex = currentScripts.findIndex((s: any) => s.scriptName === scriptName);
      if (existingIndex >= 0) {
        // Update existing script
        currentScripts[existingIndex] = newScript;
      } else {
        // Add new script
        currentScripts.push(newScript);
      }

      const updatedProfile = await profileManager.updateProfile(profileId, {
        metadata: {
          ...profile.metadata,
          autoRunScripts: currentScripts
        }
      });

      logger.info(`Added/Updated script "${scriptName}" for profile ${profile.name}`);
      res.json({ success: true, profile: updatedProfile, script: newScript });
    } catch (error) {
      logger.error('Error adding profile script:', error);
      res.status(500).json({ error: 'Failed to add profile script' });
    }
  });

  // Remove a script from instance
  app.delete('/api/profiles/:profileId/scripts/:scriptName', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { scriptName } = req.params;

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const currentScripts = profile.metadata?.autoRunScripts || [];
      const filteredScripts = currentScripts.filter((s: any) => s.scriptName !== scriptName);

      if (filteredScripts.length === currentScripts.length) {
        return res.status(404).json({ error: 'Script not found in profile' });
      }

      const updatedProfile = await profileManager.updateProfile(profileId, {
        metadata: {
          ...profile.metadata,
          autoRunScripts: filteredScripts
        }
      });

      logger.info(`Removed script "${scriptName}" from profile ${profile.name}`);
      res.json({ success: true, profile: updatedProfile });
    } catch (error) {
      logger.error('Error removing profile script:', error);
      res.status(500).json({ error: 'Failed to remove profile script' });
    }
  });

  // ============================================
  // Profile Script Management (for UI Script Editor)
  // ============================================

  // Get script content for profile
  app.get('/api/profiles/:profileId/script', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Get script content from profile metadata or return empty
      const scriptContent = profile.metadata?.scriptContent || '';
      res.json({ content: scriptContent });
    } catch (error) {
      logger.error('Error getting profile script:', error);
      res.status(500).json({ error: 'Failed to get profile script' });
    }
  });

  // Create/Update script content for profile
  app.post('/api/profiles/:profileId/script', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { content } = req.body;

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Save script content to profile metadata
      const updatedProfile = await profileManager.updateProfile(profileId, {
        metadata: {
          ...profile.metadata,
          scriptContent: content || ''
        }
      });

      logger.info(`Created script for profile ${profile.name}`);
      res.json({ success: true, content, profile: updatedProfile });
    } catch (error) {
      logger.error('Error creating profile script:', error);
      res.status(500).json({ error: 'Failed to create profile script' });
    }
  });

  // Update script content for profile
  app.put('/api/profiles/:profileId/script', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { content } = req.body;

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Update script content in profile metadata
      const updatedProfile = await profileManager.updateProfile(profileId, {
        metadata: {
          ...profile.metadata,
          scriptContent: content || ''
        }
      });

      logger.info(`Updated script for profile ${profile.name}`);
      res.json({ success: true, content, profile: updatedProfile });
    } catch (error) {
      logger.error('Error updating profile script:', error);
      res.status(500).json({ error: 'Failed to update profile script' });
    }
  });

  // ============================================
  // Profile Logs and Output
  // ============================================

  // Get log content for profile
  app.get('/api/profiles/:profileId/log', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Get log content from profile execution history
      const logContent = profile.metadata?.lastLog || 'No log available';
      res.json({ content: logContent });
    } catch (error) {
      logger.error('Error getting profile log:', error);
      res.status(500).json({ error: 'Failed to get profile log' });
    }
  });

  // Get output files for profile
  app.get('/api/profiles/:profileId/output', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Get output files from profile metadata
      const outputFiles = profile.metadata?.outputFiles || [];
      const outputPath = profile.metadata?.outputPath || `output/${profileId}`;

      res.json({
        files: outputFiles,
        path: outputPath
      });
    } catch (error) {
      logger.error('Error getting profile output:', error);
      res.status(500).json({ error: 'Failed to get profile output' });
    }
  });

  // Download output file
  app.get('/api/profiles/:profileId/output/:filename', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const { filename } = req.params;
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // In a real implementation, serve the actual file
      // For now, return a mock response
      res.status(404).json({ error: 'File download not implemented yet' });
    } catch (error) {
      logger.error('Error downloading output file:', error);
      res.status(500).json({ error: 'Failed to download output file' });
    }
  });

  // ============================================
  // Open Browser with Profile
  // ============================================

  app.post('/api/profiles/:id/open-browser', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.id);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Launch the instance (activate profile)
      await profileManager.activateProfile(profileId);

      logger.info(`Opened browser for profile ${profile.name}`);
      res.json({ success: true, message: 'Browser opened successfully' });
    } catch (error) {
      logger.error('Error opening browser:', error);
      res.status(500).json({ error: 'Failed to open browser' });
    }
  });

  // ============================================
  // UI Inspector Routes - Auto XPath Generation
  // ============================================

  // Get UI hierarchy for profile/instance
  app.get('/api/inspector/:profileId/ui', async (req: Request, res: Response) => {
    try {
      if (!uiInspectorService) {
        return res.status(500).json({ error: 'UI Inspector Service not initialized' });
      }

      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (profile.status !== 'active') {
        return res.status(400).json({ error: 'Profile must be active to inspect UI' });
      }

      const { xml, elements } = await uiInspectorService.inspectInstance(profile.port);
      logger.info(`UI Inspector: Found ${elements.length} elements for profile ${profile.name}`);

      res.json({
        success: true,
        xml,
        elements,
        count: elements.length
      });
    } catch (error) {
      logger.error('Error getting UI hierarchy:', error);
      res.status(500).json({ error: 'Failed to get UI hierarchy' });
    }
  });

  // Get XPath suggestions at coordinates
  app.post('/api/inspector/:profileId/xpath', async (req: Request, res: Response) => {
    try {
      if (!uiInspectorService) {
        return res.status(500).json({ error: 'UI Inspector Service not initialized' });
      }

      const profileId = parseInt(req.params.profileId);
      const { x, y } = req.body;

      if (x === undefined || y === undefined) {
        return res.status(400).json({ error: 'x and y coordinates are required' });
      }

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (profile.status !== 'active') {
        return res.status(400).json({ error: 'Profile must be active to inspect UI' });
      }

      const { element, suggestions } = await uiInspectorService.getXPathAtPosition(
        profile.port,
        x,
        y
      );

      if (!element) {
        return res.json({
          success: true,
          element: null,
          suggestions: [],
          message: 'No element found at the specified coordinates'
        });
      }

      logger.info(`UI Inspector: Generated ${suggestions.length} XPath suggestions for profile ${profile.name} at (${x}, ${y})`);

      res.json({
        success: true,
        element,
        suggestions
      });
    } catch (error) {
      logger.error('Error getting XPath at position:', error);
      res.status(500).json({ error: 'Failed to get XPath at position' });
    }
  });

  // Smart search for elements (auto-find by text, resource-id, class)
  app.post('/api/inspector/:profileId/search', async (req: Request, res: Response) => {
    try {
      if (!uiInspectorService) {
        return res.status(500).json({ error: 'UI Inspector Service not initialized' });
      }

      const profileId = parseInt(req.params.profileId);
      const { query, searchText, searchResourceId, searchClass, onlyClickable } = req.body;

      if (!query || query.trim() === '') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const profile = profileManager.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (profile.status !== 'active') {
        return res.status(400).json({ error: 'Profile must be active to search elements' });
      }

      // Smart search with options
      const result = await uiInspectorService.smartSearch(
        profile.port,
        query,
        {
          searchText: searchText !== false,
          searchResourceId: searchResourceId !== false,
          searchClass: searchClass !== false,
          onlyClickable: onlyClickable === true
        }
      );

      logger.info(`Smart search for "${query}" found ${result.count} elements in profile ${profile.name}`);

      res.json({
        success: true,
        query,
        elements: result.elements,
        count: result.count
      });
    } catch (error) {
      logger.error('Error searching elements:', error);
      res.status(500).json({ error: 'Failed to search elements' });
    }
  });

  // Get all interactive elements (buttons, inputs, etc.)
  app.get('/api/inspector/:profileId/interactive', async (req: Request, res: Response) => {
    try {
      if (!uiInspectorService) {
        return res.status(500).json({ error: 'UI Inspector Service not initialized' });
      }

      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (profile.status !== 'active') {
        return res.status(400).json({ error: 'Profile must be active to get interactive elements' });
      }

      const result = await uiInspectorService.getInteractiveElements(profile.port);

      logger.info(`Found ${result.count} interactive elements in profile ${profile.name}`);

      res.json({
        success: true,
        elements: result.elements,
        count: result.count
      });
    } catch (error) {
      logger.error('Error getting interactive elements:', error);
      res.status(500).json({ error: 'Failed to get interactive elements' });
    }
  });

  // Get screenshot for UI inspection
  app.get('/api/inspector/:profileId/screenshot', async (req: Request, res: Response) => {
    try {
      const profileId = parseInt(req.params.profileId);
      const profile = profileManager.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      if (profile.status !== 'active') {
        return res.status(400).json({ error: 'Profile must be active to get screenshot' });
      }

      // Take screenshot via ADB
      const deviceSerial = await ldPlayerController.resolveAdbSerial(profile.port);
      const timestamp = Date.now();
      const tempPath = `/sdcard/inspector_screenshot_${timestamp}.png`;
      const localPath = path.join(process.cwd(), 'temp', `screenshot_${profileId}_${timestamp}.png`);

      // Ensure temp directory exists
      const fs = await import('fs/promises');
      await fs.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });

      // Take screenshot
      await ldPlayerController.executeAdbCommand(deviceSerial, `shell screencap -p ${tempPath}`);
      await ldPlayerController.executeAdbCommand(deviceSerial, `pull ${tempPath} "${localPath}"`);
      await ldPlayerController.executeAdbCommand(deviceSerial, `shell rm ${tempPath}`);

      // Read screenshot and convert to base64
      const imageBuffer = await fs.readFile(localPath);
      const base64Image = imageBuffer.toString('base64');

      // Clean up temp file
      await fs.unlink(localPath).catch(() => {});

      logger.info(`Screenshot captured for profile ${profile.name}`);

      res.json({
        success: true,
        image: `data:image/png;base64,${base64Image}`,
        timestamp
      });
    } catch (error) {
      logger.error('Error getting screenshot:', error);
      res.status(500).json({ error: 'Failed to get screenshot' });
    }
  });

  // ============================================
  // Batch Operations with Resource Management
  // ============================================

  /**
   * Batch launch multiple profiles with resource pooling
   * Uses ResourceManager to limit concurrent launches
   */
  app.post('/api/profiles/batch-launch', async (req: Request, res: Response) => {
    try {
      const { profileIds } = req.body;

      if (!Array.isArray(profileIds) || profileIds.length === 0) {
        return res.status(400).json({ error: 'profileIds must be a non-empty array' });
      }

      logger.info(`[BATCH LAUNCH] Starting batch launch for ${profileIds.length} profiles`);

      // Import ResourceManager
      const { resourceManager } = await import('../services/ResourceManager.js');

      // Prepare launch items
      const launchItems = profileIds.map(id => ({
        id: `profile_${id}`,
        launchFn: async () => {
          const profile = profileManager.getProfile(id);
          if (!profile) {
            throw new Error(`Profile ${id} not found`);
          }

          // Skip if already active
          if (profile.status === 'active') {
            logger.info(`[BATCH LAUNCH] Profile ${id} already active, skipping`);
            return { profileId: id, alreadyActive: true };
          }

          // Launch instance only (no scripts)
          await profileManager.launchInstanceOnly(id);
          logger.info(`[BATCH LAUNCH] Profile ${id} launched successfully`);
          return { profileId: id, alreadyActive: false };
        }
      }));

      // Execute batch launch with resource management
      const results = await resourceManager.batchLaunch(launchItems);

      // Format results
      const formattedResults = results.map(r => ({
        profileId: parseInt(r.id.replace('profile_', '')),
        success: r.success,
        error: r.error?.message,
        alreadyActive: r.result?.alreadyActive || false
      }));

      const successCount = formattedResults.filter(r => r.success).length;
      const failCount = formattedResults.filter(r => !r.success).length;

      logger.info(`[BATCH LAUNCH] Completed: ${successCount} success, ${failCount} failed`);

      // Force refresh all profile statuses to ensure accurate status reporting
      await profileManager.refreshAllProfileStatuses();
      logger.info(`[BATCH LAUNCH] Profile statuses refreshed after batch launch`);

      res.json({
        success: true,
        total: profileIds.length,
        successCount,
        failCount,
        results: formattedResults
      });
    } catch (error) {
      logger.error('[BATCH LAUNCH] Error:', error);
      res.status(500).json({ error: 'Failed to batch launch profiles' });
    }
  });

  /**
   * Batch execute scripts on multiple profiles with concurrency control
   * Uses ResourceManager to limit concurrent script executions
   */
  app.post('/api/profiles/batch-execute-scripts', async (req: Request, res: Response) => {
    try {
      const { profileIds } = req.body;

      if (!Array.isArray(profileIds) || profileIds.length === 0) {
        return res.status(400).json({ error: 'profileIds must be a non-empty array' });
      }

      if (!directScriptService) {
        return res.status(500).json({ error: 'Direct Script Service not initialized' });
      }

      logger.info(`[BATCH SCRIPT] Starting batch script execution for ${profileIds.length} profiles`);

      // Import ResourceManager
      const { resourceManager } = await import('../services/ResourceManager.js');

      // Prepare script execution items
      const scriptItems = profileIds.map(id => ({
        id: `script_${id}`,
        scriptFn: async () => {
          const profile = profileManager.getProfile(id);
          if (!profile) {
            throw new Error(`Profile ${id} not found`);
          }

          const scriptContent = profile.metadata?.scriptContent;
          if (!scriptContent || scriptContent.trim() === '') {
            logger.info(`[BATCH SCRIPT] Profile ${id} has no script, skipping`);
            return { profileId: id, hasScript: false };
          }

          // Queue script for execution
          const task = await directScriptService.queueScript(scriptContent, id);
          logger.info(`[BATCH SCRIPT] Script queued for profile ${id}: taskId=${task.id}`);
          return { profileId: id, hasScript: true, taskId: task.id };
        }
      }));

      // Execute batch scripts with resource management
      const results = await resourceManager.batchExecuteScripts(scriptItems);

      // Format results
      const formattedResults = results.map(r => ({
        profileId: parseInt(r.id.replace('script_', '')),
        success: r.success,
        error: r.error?.message,
        hasScript: r.result?.hasScript || false,
        taskId: r.result?.taskId
      }));

      const successCount = formattedResults.filter(r => r.success && r.hasScript).length;
      const failCount = formattedResults.filter(r => !r.success).length;
      const noScriptCount = formattedResults.filter(r => r.success && !r.hasScript).length;

      logger.info(`[BATCH SCRIPT] Completed: ${successCount} scripts executed, ${noScriptCount} no script, ${failCount} failed`);

      res.json({
        success: true,
        total: profileIds.length,
        successCount,
        failCount,
        noScriptCount,
        results: formattedResults
      });
    } catch (error) {
      logger.error('[BATCH SCRIPT] Error:', error);
      res.status(500).json({ error: 'Failed to batch execute scripts' });
    }
  });

  /**
   * Get resource manager status
   */
  app.get('/api/resources/status', async (req: Request, res: Response) => {
    try {
      const { resourceManager } = await import('../services/ResourceManager.js');
      const status = resourceManager.getStatus();

      res.json({
        success: true,
        ...status,
        limits: {
          maxConcurrentLaunches: parseInt(process.env.MAX_CONCURRENT_LAUNCHES || '3'),
          maxConcurrentScripts: parseInt(process.env.MAX_CONCURRENT_SCRIPTS || '7')
        }
      });
    } catch (error) {
      logger.error('Error getting resource status:', error);
      res.status(500).json({ error: 'Failed to get resource status' });
    }
  });

  // ============================================
  // Device Monitoring Routes
  // ============================================

  /**
   * Get all device statuses
   */
  app.get('/api/monitor/devices', (req: Request, res: Response) => {
    try {
      if (!deviceMonitor) {
        return res.status(500).json({ error: 'Device Monitor not initialized' });
      }

      const statuses = deviceMonitor.getDeviceStatuses();
      const statistics = deviceMonitor.getStatistics();

      res.json({
        success: true,
        devices: statuses,
        statistics,
        isMonitoring: deviceMonitor.isRunning()
      });
    } catch (error) {
      logger.error('Error getting device statuses:', error);
      res.status(500).json({ error: 'Failed to get device statuses' });
    }
  });

  /**
   * Get specific device status
   */
  app.get('/api/monitor/devices/:instanceName', (req: Request, res: Response) => {
    try {
      if (!deviceMonitor) {
        return res.status(500).json({ error: 'Device Monitor not initialized' });
      }

      const { instanceName } = req.params;
      const status = deviceMonitor.getDeviceStatus(instanceName);

      if (!status) {
        return res.status(404).json({ error: 'Device not found' });
      }

      res.json({
        success: true,
        device: status
      });
    } catch (error) {
      logger.error('Error getting device status:', error);
      res.status(500).json({ error: 'Failed to get device status' });
    }
  });

  /**
   * Read logcat for a device
   */
  app.get('/api/monitor/devices/:instanceName/logcat', async (req: Request, res: Response) => {
    try {
      if (!deviceMonitor) {
        return res.status(500).json({ error: 'Device Monitor not initialized' });
      }

      const { instanceName } = req.params;
      const lines = parseInt(req.query.lines as string) || 100;

      const logContent = await deviceMonitor.readLogcat(instanceName, lines);

      res.json({
        success: true,
        instanceName,
        content: logContent,
        lines
      });
    } catch (error) {
      logger.error('Error reading logcat:', error);
      res.status(500).json({ error: 'Failed to read logcat' });
    }
  });

  /**
   * Clear logcat for a device
   */
  app.post('/api/monitor/devices/:instanceName/logcat/clear', async (req: Request, res: Response) => {
    try {
      if (!deviceMonitor) {
        return res.status(500).json({ error: 'Device Monitor not initialized' });
      }

      const { instanceName } = req.params;
      await deviceMonitor.clearLogcat(instanceName);

      res.json({
        success: true,
        message: `Logcat cleared for ${instanceName}`
      });
    } catch (error) {
      logger.error('Error clearing logcat:', error);
      res.status(500).json({ error: 'Failed to clear logcat' });
    }
  });

  /**
   * Get monitor statistics
   */
  app.get('/api/monitor/statistics', (req: Request, res: Response) => {
    try {
      if (!deviceMonitor) {
        return res.status(500).json({ error: 'Device Monitor not initialized' });
      }

      const statistics = deviceMonitor.getStatistics();

      res.json({
        success: true,
        statistics,
        isMonitoring: deviceMonitor.isRunning()
      });
    } catch (error) {
      logger.error('Error getting monitor statistics:', error);
      res.status(500).json({ error: 'Failed to get monitor statistics' });
    }
  });

  /**
   * Start monitoring
   */
  app.post('/api/monitor/start', async (req: Request, res: Response) => {
    try {
      if (!deviceMonitor) {
        return res.status(500).json({ error: 'Device Monitor not initialized' });
      }

      await deviceMonitor.start();

      res.json({
        success: true,
        message: 'Device monitoring started',
        isMonitoring: true
      });
    } catch (error) {
      logger.error('Error starting monitor:', error);
      res.status(500).json({ error: 'Failed to start monitor' });
    }
  });

  /**
   * Stop monitoring
   */
  app.post('/api/monitor/stop', async (req: Request, res: Response) => {
    try {
      if (!deviceMonitor) {
        return res.status(500).json({ error: 'Device Monitor not initialized' });
      }

      await deviceMonitor.stop();

      res.json({
        success: true,
        message: 'Device monitoring stopped',
        isMonitoring: false
      });
    } catch (error) {
      logger.error('Error stopping monitor:', error);
      res.status(500).json({ error: 'Failed to stop monitor' });
    }
  });

  // ============================================
  // Fingerprint Randomization Routes (GemLogin-like)
  // ============================================

  /**
   * Generate random fingerprint
   */
  app.post('/api/fingerprint/generate', async (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { brand, includePhoneNumber } = req.body;
      const { FingerprintGenerator } = await import('../services/FingerprintGenerator.js');

      const fingerprint = FingerprintGenerator.generateFingerprint({ brand, includePhoneNumber });

      res.json({
        success: true,
        fingerprint
      });
    } catch (error) {
      logger.error('Error generating fingerprint:', error);
      res.status(500).json({ error: 'Failed to generate fingerprint' });
    }
  });

  /**
   * Apply fingerprint to instance
   */
  app.post('/api/fingerprint/apply/:instanceName', async (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { instanceName } = req.params;
      const { fingerprint, method, requireRestart } = req.body;

      const appliedFingerprint = await fingerprintService.applyFingerprint(
        instanceName,
        fingerprint,
        { method, requireRestart }
      );

      res.json({
        success: true,
        instanceName,
        fingerprint: appliedFingerprint,
        message: 'Fingerprint applied successfully'
      });
    } catch (error) {
      logger.error('Error applying fingerprint:', error);
      res.status(500).json({ error: 'Failed to apply fingerprint' });
    }
  });

  /**
   * Apply fingerprint to multiple instances (batch)
   */
  app.post('/api/fingerprint/apply-batch', async (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { instanceNames, useSameBrand, brand, method } = req.body;

      if (!Array.isArray(instanceNames) || instanceNames.length === 0) {
        return res.status(400).json({ error: 'instanceNames must be a non-empty array' });
      }

      const results = await fingerprintService.applyFingerprintBatch(
        instanceNames,
        { useSameBrand, brand, method }
      );

      const formattedResults = Array.from(results.entries()).map(([name, fp]) => ({
        instanceName: name,
        fingerprint: fp
      }));

      res.json({
        success: true,
        total: instanceNames.length,
        successCount: formattedResults.length,
        results: formattedResults
      });
    } catch (error) {
      logger.error('Error applying fingerprints in batch:', error);
      res.status(500).json({ error: 'Failed to apply fingerprints in batch' });
    }
  });

  /**
   * Get current fingerprint from instance
   */
  app.get('/api/fingerprint/:instanceName', async (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { instanceName } = req.params;
      const fingerprint = await fingerprintService.getCurrentFingerprint(instanceName);

      res.json({
        success: true,
        instanceName,
        fingerprint
      });
    } catch (error) {
      logger.error('Error getting fingerprint:', error);
      res.status(500).json({ error: 'Failed to get fingerprint' });
    }
  });

  /**
   * Get cached fingerprint
   */
  app.get('/api/fingerprint/cache/:instanceName', (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { instanceName } = req.params;
      const fingerprint = fingerprintService.getCachedFingerprint(instanceName);

      if (!fingerprint) {
        return res.status(404).json({ error: 'No cached fingerprint found for instance' });
      }

      res.json({
        success: true,
        instanceName,
        fingerprint
      });
    } catch (error) {
      logger.error('Error getting cached fingerprint:', error);
      res.status(500).json({ error: 'Failed to get cached fingerprint' });
    }
  });

  /**
   * Verify fingerprint
   */
  app.post('/api/fingerprint/verify/:instanceName', async (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { instanceName } = req.params;
      const { expectedFingerprint } = req.body;

      if (!expectedFingerprint) {
        return res.status(400).json({ error: 'expectedFingerprint is required' });
      }

      const isValid = await fingerprintService.verifyFingerprint(instanceName, expectedFingerprint);

      res.json({
        success: true,
        instanceName,
        isValid,
        message: isValid ? 'Fingerprint verified' : 'Fingerprint mismatch'
      });
    } catch (error) {
      logger.error('Error verifying fingerprint:', error);
      res.status(500).json({ error: 'Failed to verify fingerprint' });
    }
  });

  /**
   * Export fingerprint to JSON
   */
  app.get('/api/fingerprint/export/:instanceName', (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { instanceName } = req.params;
      const fingerprintJson = fingerprintService.exportFingerprint(instanceName);

      res.header('Content-Type', 'application/json');
      res.header('Content-Disposition', `attachment; filename="${instanceName}_fingerprint.json"`);
      res.send(fingerprintJson);
    } catch (error) {
      logger.error('Error exporting fingerprint:', error);
      res.status(500).json({ error: 'Failed to export fingerprint' });
    }
  });

  /**
   * Import fingerprint from JSON
   */
  app.post('/api/fingerprint/import/:instanceName', async (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { instanceName } = req.params;
      const { fingerprintJson } = req.body;

      if (!fingerprintJson) {
        return res.status(400).json({ error: 'fingerprintJson is required' });
      }

      await fingerprintService.importFingerprint(instanceName, fingerprintJson);

      res.json({
        success: true,
        instanceName,
        message: 'Fingerprint imported and applied successfully'
      });
    } catch (error) {
      logger.error('Error importing fingerprint:', error);
      res.status(500).json({ error: 'Failed to import fingerprint' });
    }
  });

  /**
   * Get available device brands
   */
  app.get('/api/fingerprint/brands', async (req: Request, res: Response) => {
    try {
      const { FingerprintGenerator } = await import('../services/FingerprintGenerator.js');
      const brands = FingerprintGenerator.getAvailableBrands();

      res.json({
        success: true,
        brands,
        count: brands.length
      });
    } catch (error) {
      logger.error('Error getting available brands:', error);
      res.status(500).json({ error: 'Failed to get available brands' });
    }
  });

  /**
   * Get all device templates
   */
  app.get('/api/fingerprint/templates', async (req: Request, res: Response) => {
    try {
      const { FingerprintGenerator } = await import('../services/FingerprintGenerator.js');
      const templates = FingerprintGenerator.getAllDeviceTemplates();

      res.json({
        success: true,
        templates,
        count: templates.length
      });
    } catch (error) {
      logger.error('Error getting device templates:', error);
      res.status(500).json({ error: 'Failed to get device templates' });
    }
  });

  /**
   * Get fingerprint service statistics
   */
  app.get('/api/fingerprint/stats', (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const stats = fingerprintService.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting fingerprint stats:', error);
      res.status(500).json({ error: 'Failed to get fingerprint stats' });
    }
  });

  /**
   * Clear fingerprint cache
   */
  app.delete('/api/fingerprint/cache/:instanceName?', (req: Request, res: Response) => {
    try {
      if (!fingerprintService) {
        return res.status(500).json({ error: 'Fingerprint Service not initialized' });
      }

      const { instanceName } = req.params;
      fingerprintService.clearCache(instanceName);

      res.json({
        success: true,
        message: instanceName
          ? `Cache cleared for ${instanceName}`
          : 'All fingerprint cache cleared'
      });
    } catch (error) {
      logger.error('Error clearing fingerprint cache:', error);
      res.status(500).json({ error: 'Failed to clear fingerprint cache' });
    }
  });
}