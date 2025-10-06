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

interface RouteServices {
  ldPlayerController: LDPlayerController;
  profileManager: ProfileManager;
  taskExecutor: TaskExecutor;
  scriptExecutor: MobileScriptExecutor;
  appiumScriptService?: AppiumScriptService;
}

export function setupRoutes(app: Express, services: RouteServices) {
  const { ldPlayerController, profileManager, taskExecutor, scriptExecutor, appiumScriptService } = services;

  // Setup authentication routes first
  setupAuthRoutes(app);

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
          cpu: 2,
          memory: 2048,
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
      const { selectedApps, autoRunScripts, autoActivate = true, ...profileData } = req.body;

      // Validate required fields
      if (!profileData.name) {
        return res.status(400).json({ error: 'Profile name is required' });
      }

      // Apply default settings if not provided
      const defaultSettings = {
        resolution: '360,640',
        dpi: 160,
        cpu: 2,
        memory: 2048,
        androidVersion: '9'
      };

      profileData.settings = {
        ...defaultSettings,
        ...(profileData.settings || {})
      };

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
      const profile = await profileManager.updateProfile(req.params.profileId, req.body);
      res.json({ profile });
    } catch (error) {
      logger.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  app.delete('/api/profiles/:profileId', async (req: Request, res: Response) => {
    try {
      await profileManager.deleteProfile(req.params.profileId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting profile:', error);
      res.status(500).json({ error: 'Failed to delete profile' });
    }
  });

  app.post('/api/profiles/:profileId/activate', async (req: Request, res: Response) => {
    try {
      await profileManager.activateProfile(req.params.profileId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error activating profile:', error);
      res.status(500).json({ error: 'Failed to activate profile' });
    }
  });

  app.post('/api/profiles/:profileId/deactivate', async (req: Request, res: Response) => {
    try {
      await profileManager.deactivateProfile(req.params.profileId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deactivating profile:', error);
      res.status(500).json({ error: 'Failed to deactivate profile' });
    }
  });

  app.post('/api/profiles/:profileId/clone', async (req: Request, res: Response) => {
    try {
      const { newName, copyApps, launchAndSetup } = req.body;
      if (!newName) {
        return res.status(400).json({ error: 'newName is required' });
      }
      const clonedProfile = await profileManager.cloneProfile(
        req.params.profileId,
        newName,
        { copyApps, launchAndSetup }
      );
      res.json({ success: true, profile: clonedProfile });
    } catch (error) {
      logger.error('Error cloning profile:', error);
      res.status(500).json({ error: 'Failed to clone profile' });
    }
  });

  app.post('/api/profiles/:profileId/install-app', async (req: Request, res: Response) => {
    try {
      const { apkFileName } = req.body;
      if (!apkFileName) {
        return res.status(400).json({ error: 'apkFileName is required' });
      }
      await profileManager.installAppOnProfile(req.params.profileId, apkFileName);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error installing app:', error);
      res.status(500).json({ error: 'Failed to install app' });
    }
  });

  app.post('/api/profiles/:profileId/launch-app', async (req: Request, res: Response) => {
    try {
      const { packageName } = req.body;
      if (!packageName) {
        return res.status(400).json({ error: 'packageName is required' });
      }
      await profileManager.launchAppOnProfile(req.params.profileId, packageName);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error launching app:', error);
      res.status(500).json({ error: 'Failed to launch app' });
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
  app.get('/api/instances', (req: Request, res: Response) => {
    try {
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
      await ldPlayerController.stopInstance(req.params.instanceName);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error stopping instance:', error);
      res.status(500).json({ error: 'Failed to stop instance' });
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
  app.post('/api/profiles/:id/launch', async (req: Request, res: Response) => {
    try {
      const profileId = req.params.id;
      const { headless = false } = req.body;
      await profileManager.activateProfile(profileId);
      res.json({ success: true, message: 'Profile launched' });
    } catch (error) {
      logger.error('Error launching profile:', error);
      res.status(500).json({ error: 'Failed to launch profile' });
    }
  });

  app.post('/api/profiles/:id/stop', async (req: Request, res: Response) => {
    try {
      const profileId = req.params.id;
      await profileManager.deactivateProfile(profileId);
      res.json({ success: true, message: 'Profile stopped' });
    } catch (error) {
      logger.error('Error stopping profile:', error);
      res.status(500).json({ error: 'Failed to stop profile' });
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
      const profileId = req.params.id;
      const profiles = profileManager.getAllProfiles();
      const profile = profiles.find(p => String(p.id) === profileId);
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
      const { profileId } = req.params;
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

      const tasks = appiumScriptService.getTasksForProfile(req.params.profileId);
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

      await appiumScriptService.closeSession(req.params.profileId);
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
  // Profile Settings Routes (for Settings Tab in Profile)
  // ============================================

  // Get profile settings (including auto-run scripts, apps, etc.)
  app.get('/api/profiles/:profileId/settings', (req: Request, res: Response) => {
    try {
      const { profileId } = req.params;
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
      const { profileId } = req.params;
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
      const { profileId } = req.params;
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
      const { profileId } = req.params;
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
      const { profileId } = req.params;
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
      const { profileId, scriptName } = req.params;

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
}