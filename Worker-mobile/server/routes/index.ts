import { Express, Request, Response } from 'express';
import LDPlayerController from '../core/LDPlayerController.js';
import ProfileManager from '../services/ProfileManager.js';
import TaskExecutor from '../services/TaskExecutor.js';
import MobileScriptExecutor from '../services/MobileScriptExecutor.js';
import { setupAuthRoutes } from './auth.js';
import { logger } from '../utils/logger.js';
import { mockSettings, mockStatistics } from './mockData.js';

interface RouteServices {
  ldPlayerController: LDPlayerController;
  profileManager: ProfileManager;
  taskExecutor: TaskExecutor;
  scriptExecutor: MobileScriptExecutor;
}

export function setupRoutes(app: Express, services: RouteServices) {
  const { ldPlayerController, profileManager, taskExecutor, scriptExecutor } = services;

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

  app.post('/api/profiles', async (req: Request, res: Response) => {
    try {
      const { selectedApps, autoRunScripts, ...profileData } = req.body;

      // Create profile
      const profile = await profileManager.createProfile(profileData);

      // Install selected apps if provided
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

      res.json({ profile });
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
}