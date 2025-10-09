import LDPlayerController from '../core/LDPlayerController.js';
import TwitterMobileAutomation from '../automation/TwitterMobileAutomation.js';
import TwitterAppManager from './TwitterAppManager.js';
import ProfileManager, { MobileProfile } from './ProfileManager.js';
import AppiumScriptService from './AppiumScriptService.js';
import DirectMobileScriptService from './DirectMobileScriptService.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

// WebSocket broadcast function (will be injected from server)
export type BroadcastFunction = (type: string, data: any) => void;

export interface Task {
  id: string;
  type: 'twitter_like' | 'twitter_follow' | 'twitter_retweet' | 'twitter_comment' | 'twitter_post' | 'custom' | 'appium_script';
  profileId: number | '';
  data: Record<string, any>;
  scriptCode?: string; // For appium_script type - JavaScript code to execute
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  logs?: string[]; // Execution logs
  source?: 'task_center' | 'api' | 'manual'; // Track where task came from
}

export interface TaskExecutorConfig {
  taskCenterUrl?: string;
  taskCenterApiKey?: string;
  taskCenterUserId?: string;
  maxConcurrentTasks?: number;
  taskCheckInterval?: number;
}

export class TaskExecutor {
  private controller: LDPlayerController;
  private profileManager: ProfileManager;
  private twitterAppManager: TwitterAppManager;
  private appiumScriptService?: AppiumScriptService | DirectMobileScriptService;
  private tasks: Map<string, Task> = new Map();
  private runningTasks: Map<string, Promise<void>> = new Map();
  private config: TaskExecutorConfig;
  private isRunning: boolean = false;
  private taskCheckInterval?: NodeJS.Timeout;
  private broadcast?: BroadcastFunction;

  constructor(
    controller: LDPlayerController,
    profileManager: ProfileManager,
    config: TaskExecutorConfig = {},
    appiumScriptService?: AppiumScriptService | DirectMobileScriptService
  ) {
    this.controller = controller;
    this.profileManager = profileManager;
    this.twitterAppManager = new TwitterAppManager(controller);
    this.appiumScriptService = appiumScriptService;
    this.config = {
      maxConcurrentTasks: 3,
      taskCheckInterval: 30000, // 30 seconds
      ...config
    };
  }

  // Set broadcast function for WebSocket updates
  setBroadcast(broadcast: BroadcastFunction) {
    this.broadcast = broadcast;
  }

  // Start task executor
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Task executor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Task executor started');

    // Start task processing loop
    this.processTaskQueue();

    // Start fetching tasks from Task Center if configured
    if (this.config.taskCenterUrl) {
      this.startTaskCenterPolling();
    }
  }

  // Stop task executor
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.taskCheckInterval) {
      clearInterval(this.taskCheckInterval);
    }

    // Wait for running tasks to complete
    await Promise.all(this.runningTasks.values());

    // Shutdown Twitter app manager
    await this.twitterAppManager.shutdown();

    logger.info('Task executor stopped');
  }

  // Add task to queue
  async addTask(task: Omit<Task, 'id' | 'status' | 'createdAt' | 'retryCount'>): Promise<Task> {
    const newTask: Task = {
      ...task,
      id: this.generateTaskId(),
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: task.maxRetries || 3
    };

    this.tasks.set(newTask.id, newTask);
    logger.info(`Task ${newTask.id} added to queue: ${newTask.type}`);

    return newTask;
  }

  // Process task queue
  private async processTaskQueue(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check for available task slots
        const runningCount = this.runningTasks.size;
        const availableSlots = (this.config.maxConcurrentTasks || 3) - runningCount;

        if (availableSlots > 0) {
          // Get pending tasks sorted by priority
          const pendingTasks = Array.from(this.tasks.values())
            .filter(t => t.status === 'pending')
            .sort((a, b) => b.priority - a.priority)
            .slice(0, availableSlots);

          // Start execution for each pending task
          for (const task of pendingTasks) {
            const execution = this.executeTask(task);
            this.runningTasks.set(task.id, execution);

            // Clean up when done
            execution.finally(() => {
              this.runningTasks.delete(task.id);
            });
          }
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error('Error in task processing loop:', error);
      }
    }
  }

  // Execute individual task
  private async executeTask(task: Task): Promise<void> {
    try {
      // Update task status
      task.status = 'running';
      task.startedAt = new Date();
      logger.info(`Starting task ${task.id}: ${task.type}`);

      // Broadcast task started
      this.broadcastTaskUpdate(task, 'task_started');

      // Check profileId
      if (!task.profileId) {
        throw new Error(`Task ${task.id} has no profile assigned`);
      }

      // Get profile
      const profile = this.profileManager.getProfile(task.profileId);
      if (!profile) {
        throw new Error(`Profile ${task.profileId} not found`);
      }

      // Activate profile if not active
      if (profile.status !== 'active') {
        await this.profileManager.activateProfile(profile.id);
      }

      // Execute task based on type
      let result: any;

      switch (task.type) {
        case 'twitter_like':
          result = await this.executeTwitterLike(profile, task.data);
          break;

        case 'twitter_follow':
          result = await this.executeTwitterFollow(profile, task.data);
          break;

        case 'twitter_retweet':
          result = await this.executeTwitterRetweet(profile, task.data);
          break;

        case 'twitter_comment':
          result = await this.executeTwitterComment(profile, task.data);
          break;

        case 'twitter_post':
          result = await this.executeTwitterPost(profile, task.data);
          break;

        case 'appium_script':
          result = await this.executeAppiumScript(profile, task);
          break;

        case 'custom':
          result = await this.executeCustomTask(profile, task.data);
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Update task on success
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      logger.info(`Task ${task.id} completed successfully`);

      // Broadcast task completed
      this.broadcastTaskUpdate(task, 'task_completed');

      // Report to Task Center if configured
      if (this.config.taskCenterUrl) {
        await this.reportTaskCompletion(task);
      }

    } catch (error) {
      logger.error(`Task ${task.id} failed:`, error);

      // Handle retry logic
      task.retryCount++;

      if (task.retryCount < task.maxRetries) {
        task.status = 'pending'; // Retry
        logger.info(`Task ${task.id} will be retried (${task.retryCount}/${task.maxRetries})`);
        this.broadcastTaskUpdate(task, 'task_retry');
      } else {
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = error instanceof Error ? error.message : String(error);
        this.broadcastTaskUpdate(task, 'task_failed');
      }
    }
  }

  // Broadcast task updates via WebSocket
  private broadcastTaskUpdate(task: Task, event: string) {
    if (this.broadcast) {
      this.broadcast(event, {
        id: task.id,
        type: task.type,
        profileId: task.profileId,
        status: task.status,
        progress: task.status === 'running' ? 50 : task.status === 'completed' ? 100 : 0,
        result: task.result,
        error: task.error,
        logs: task.logs,
        source: task.source,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt
      });
    }
  }

  // Twitter task implementations (using TwitterAppManager for speed)
  private async executeTwitterLike(profile: MobileProfile, data: any): Promise<any> {
    // ⚡ Use TwitterAppManager - app already running, super fast!
    return await this.twitterAppManager.executeWithSession(profile, async (twitter) => {
      // Search for tweet or navigate to URL
      if (data.tweetUrl) {
        logger.warn('Direct tweet URL navigation not implemented yet');
      } else if (data.searchQuery) {
        await twitter.search(data.searchQuery);
      }

      // Like tweets
      const likeCount = data.likeCount || 1;
      return await twitter.likeRandomTweets(likeCount);
    });
  }

  private async executeTwitterFollow(profile: MobileProfile, data: any): Promise<any> {
    return await this.twitterAppManager.executeWithSession(profile, async (twitter) => {
      return await twitter.followUser(data.targetUsername);
    });
  }

  private async executeTwitterRetweet(profile: MobileProfile, data: any): Promise<any> {
    return await this.twitterAppManager.executeWithSession(profile, async (twitter) => {
      if (data.searchQuery) {
        await twitter.search(data.searchQuery);
      }
      return await twitter.retweet(400, data.comment || '');
    });
  }

  private async executeTwitterComment(profile: MobileProfile, data: any): Promise<any> {
    return await this.twitterAppManager.executeWithSession(profile, async (twitter) => {
      if (data.searchQuery) {
        await twitter.search(data.searchQuery);
      }
      return await twitter.commentOnTweet(400, data.comment);
    });
  }

  private async executeTwitterPost(profile: MobileProfile, data: any): Promise<any> {
    return await this.twitterAppManager.executeWithSession(profile, async (twitter) => {
      return await twitter.postTweet(data.text, {
        media: data.media,
        poll: data.poll
      });
    });
  }

  private async executeAppiumScript(profile: MobileProfile, task: Task): Promise<any> {
    if (!this.appiumScriptService) {
      throw new Error('AppiumScriptService not initialized');
    }

    if (!task.scriptCode) {
      throw new Error('No script code provided for appium_script task');
    }

    logger.info(`Executing Appium script for profile ${profile.name}`);

    // Create Appium script task
    const appiumTask = await this.appiumScriptService.queueScript(task.scriptCode, profile.id);

    // Wait for script execution to complete
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const currentTask = this.appiumScriptService!.getTask(appiumTask.id);

        if (currentTask?.status === 'completed') {
          clearInterval(checkInterval);
          task.logs = currentTask.logs;
          resolve(currentTask.result);
        } else if (currentTask?.status === 'failed') {
          clearInterval(checkInterval);
          task.logs = currentTask.logs;
          reject(new Error(currentTask.error || 'Script execution failed'));
        }
      }, 500);

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Script execution timeout'));
      }, 600000);
    });
  }

  private async executeCustomTask(profile: MobileProfile, data: any): Promise<any> {
    // Custom task implementation
    logger.info(`Executing custom task for profile ${profile.name}`);

    // This would be implemented based on specific requirements
    // Could involve running custom scripts, automation sequences, etc.

    return { success: true, message: 'Custom task executed' };
  }

  // Task Center integration
  private startTaskCenterPolling(): void {
    this.taskCheckInterval = setInterval(async () => {
      try {
        await this.fetchTasksFromCenter();
      } catch (error) {
        logger.error('Failed to fetch tasks from Task Center:', error);
      }
    }, this.config.taskCheckInterval || 30000);

    // Initial fetch
    this.fetchTasksFromCenter();
  }

  private async fetchTasksFromCenter(): Promise<void> {
    if (!this.config.taskCenterUrl || !this.config.taskCenterApiKey) {
      return;
    }

    try {
      const response = await axios.get(`${this.config.taskCenterUrl}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${this.config.taskCenterApiKey}`,
          'User-Id': this.config.taskCenterUserId || ''
        },
        params: {
          status: 'pending',
          limit: 10
        }
      });

      const tasks = response.data.tasks || [];

      for (const taskData of tasks) {
        // Map Task Center task to internal task format
        await this.addTask({
          type: taskData.type,
          profileId: taskData.profileId || this.getAvailableProfile(),
          data: taskData.data,
          priority: taskData.priority || 5,
          maxRetries: taskData.maxRetries || 3
        });
      }

      logger.info(`Fetched ${tasks.length} tasks from Task Center`);
    } catch (error) {
      logger.error('Error fetching tasks from Task Center:', error);
    }
  }

  private async reportTaskCompletion(task: Task): Promise<void> {
    if (!this.config.taskCenterUrl || !this.config.taskCenterApiKey) {
      return;
    }

    try {
      // Prepare payload with comprehensive task data
      const payload = {
        status: task.status,
        result: task.result,
        error: task.error,
        logs: task.logs,
        completedAt: task.completedAt,
        startedAt: task.startedAt,
        duration: task.completedAt && task.startedAt
          ? task.completedAt.getTime() - task.startedAt.getTime()
          : null,
        retryCount: task.retryCount,
        profileId: task.profileId,
        type: task.type,
        source: task.source
      };

      await axios.post(
        `${this.config.taskCenterUrl}/api/tasks/${task.id}/complete`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.config.taskCenterApiKey}`,
            'User-Id': this.config.taskCenterUserId || ''
          }
        }
      );

      logger.info(`Reported task ${task.id} completion to Task Center`);
    } catch (error) {
      logger.error('Error reporting task completion:', error);
    }
  }

  // Helper methods
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAvailableProfile(): number | '' {
    // Get first inactive profile or create a new one
    const profiles = this.profileManager.getAllProfiles();
    const inactiveProfile = profiles.find(p => p.status === 'inactive');

    return inactiveProfile?.id || profiles[0]?.id || '';
  }

  // Get task status
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getPendingTasks(): Task[] {
    return this.getAllTasks().filter(t => t.status === 'pending');
  }

  getRunningTasks(): Task[] {
    return this.getAllTasks().filter(t => t.status === 'running');
  }

  // Cancel task
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') {
      return false;
    }

    task.status = 'failed';
    task.error = 'Cancelled by user';
    task.completedAt = new Date();

    return true;
  }

  // Clear completed tasks
  clearCompletedTasks(): void {
    const completedTasks = this.getAllTasks().filter(
      t => t.status === 'completed' || t.status === 'failed'
    );

    for (const task of completedTasks) {
      this.tasks.delete(task.id);
    }

    logger.info(`Cleared ${completedTasks.length} completed tasks`);
  }
}

export default TaskExecutor;