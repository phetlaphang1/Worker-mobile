import { remote, Browser, Element } from 'webdriverio';
import LDPlayerController from '../core/LDPlayerController.js';
import ProfileManager, { MobileProfile } from './ProfileManager.js';
import { logger } from '../utils/logger.js';

export interface AppiumScriptTask {
  id: string;
  profileId: string;
  scriptCode: string; // JavaScript code từ frontend
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  logs?: string[];
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Appium Script Service - Execute JavaScript scripts on mobile instances
 * Giống như Puppeteer cho browser, nhưng dành cho mobile
 */
export class AppiumScriptService {
  private controller: LDPlayerController;
  private profileManager: ProfileManager;
  private activeSessions: Map<string, Browser> = new Map();
  private scriptQueue: AppiumScriptTask[] = [];
  private runningScripts: Map<string, Promise<any>> = new Map();

  constructor(controller: LDPlayerController, profileManager: ProfileManager) {
    this.controller = controller;
    this.profileManager = profileManager;
  }

  /**
   * Tạo Appium session cho LDPlayer instance
   */
  private async createAppiumSession(profile: MobileProfile): Promise<Browser> {
    const port = profile.port;

    const capabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': profile.instanceName,
      'appium:udid': `127.0.0.1:${port}`,
      'appium:systemPort': 8200 + parseInt(profile.port.toString().slice(-2)), // Dynamic system port
      'appium:adbExecTimeout': 30000,
      'appium:newCommandTimeout': 300,
      'appium:noReset': true,
      'appium:fullReset': false,
    };

    logger.info(`Creating Appium session for ${profile.name} on port ${port}`);

    const browser = await remote({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: 4723, // Appium server port
      path: '/',
      capabilities,
      logLevel: 'info',
    });

    this.activeSessions.set(profile.id, browser);
    logger.info(`Appium session created for ${profile.name}`);

    return browser;
  }

  /**
   * Lấy hoặc tạo Appium session
   */
  private async getOrCreateSession(profileId: string): Promise<Browser> {
    const profile = this.profileManager.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Activate profile nếu chưa active
    if (profile.status !== 'active') {
      logger.info(`Activating profile ${profile.name} for Appium session`);
      await this.profileManager.activateProfile(profile.id);
    }

    // Return existing session nếu có
    if (this.activeSessions.has(profileId)) {
      const session = this.activeSessions.get(profileId)!;
      try {
        // Test session còn hoạt động không
        await session.getTitle();
        return session;
      } catch (error) {
        // Session đã chết, tạo mới
        logger.warn(`Existing session for ${profile.name} is dead, creating new one`);
        this.activeSessions.delete(profileId);
      }
    }

    // Tạo session mới
    return await this.createAppiumSession(profile);
  }

  /**
   * Execute JavaScript code trên mobile instance
   * Code sẽ có access đến: driver, $, $$, và các helpers
   */
  async executeScript(task: AppiumScriptTask): Promise<any> {
    const profile = this.profileManager.getProfile(task.profileId);
    if (!profile) {
      throw new Error(`Profile ${task.profileId} not found`);
    }

    const logs: string[] = [];
    const log = (message: string) => {
      logs.push(message);
      logger.info(`[Script ${task.id}] ${message}`);
    };

    try {
      log(`Starting script execution for ${profile.name}`);

      // Get Appium session
      const driver = await this.getOrCreateSession(task.profileId);

      // Helper functions để user dùng trong script
      const helpers = {
        // Giống Puppeteer page.waitForSelector
        waitForElement: async (selector: string, timeout = 10000) => {
          log(`Waiting for element: ${selector}`);
          const element = await driver.$(selector);
          await element.waitForExist({ timeout });
          return element;
        },

        // Tap vào element
        tap: async (selector: string) => {
          log(`Tapping: ${selector}`);
          const element = await driver.$(selector);
          await element.click();
        },

        // Tap vào tọa độ
        tapAt: async (x: number, y: number) => {
          log(`Tapping at (${x}, ${y})`);
          await driver.touchPerform([
            { action: 'tap', options: { x, y } }
          ]);
        },

        // Input text
        type: async (selector: string, text: string) => {
          log(`Typing "${text}" into ${selector}`);
          const element = await driver.$(selector);
          await element.setValue(text);
        },

        // Swipe
        swipe: async (x1: number, y1: number, x2: number, y2: number, duration = 500) => {
          log(`Swiping from (${x1}, ${y1}) to (${x2}, ${y2})`);
          await driver.touchPerform([
            { action: 'press', options: { x: x1, y: y1 } },
            { action: 'wait', options: { ms: duration } },
            { action: 'moveTo', options: { x: x2, y: y2 } },
            { action: 'release' }
          ]);
        },

        // Scroll down
        scrollDown: async (distance = 400) => {
          const { width, height } = await driver.getWindowSize();
          const centerX = width / 2;
          const startY = height * 0.8;
          const endY = height * 0.2;
          await helpers.swipe(centerX, startY, centerX, endY, 500);
        },

        // Scroll up
        scrollUp: async (distance = 400) => {
          const { width, height } = await driver.getWindowSize();
          const centerX = width / 2;
          const startY = height * 0.2;
          const endY = height * 0.8;
          await helpers.swipe(centerX, startY, centerX, endY, 500);
        },

        // Launch app
        launchApp: async (packageName: string, activityName: string) => {
          log(`Launching app: ${packageName}`);
          await driver.execute('mobile: activateApp', { appId: packageName });
          await helpers.sleep(2000);
        },

        // Terminate app
        terminateApp: async (packageName: string) => {
          log(`Terminating app: ${packageName}`);
          await driver.execute('mobile: terminateApp', { appId: packageName });
        },

        // Press Android key
        pressKey: async (keyCode: string) => {
          log(`Pressing key: ${keyCode}`);
          await driver.pressKeyCode(this.getKeyCode(keyCode));
        },

        // Take screenshot
        screenshot: async () => {
          log('Taking screenshot');
          return await driver.takeScreenshot();
        },

        // Sleep/wait
        sleep: async (ms: number) => {
          log(`Sleeping for ${ms}ms`);
          await new Promise(resolve => setTimeout(resolve, ms));
        },

        // Get all elements
        findElements: async (selector: string) => {
          log(`Finding elements: ${selector}`);
          return await driver.$$(selector);
        },

        // Get element text
        getText: async (selector: string) => {
          const element = await driver.$(selector);
          return await element.getText();
        },

        // Check if element exists
        exists: async (selector: string) => {
          const element = await driver.$(selector);
          return await element.isExisting();
        },

        // Console.log trong script
        log: (message: string) => {
          log(`[User Script] ${message}`);
        }
      };

      // Execute user script với access đến driver và helpers
      // Wrap trong async function để support await
      const scriptFunction = new Function(
        'driver',
        'helpers',
        '$',
        '$$',
        'log',
        `return (async () => {
          ${task.scriptCode}
        })();`
      );

      log('Executing user script...');
      const result = await scriptFunction(
        driver,
        helpers,
        (selector: string) => driver.$(selector),
        (selector: string) => driver.$$(selector),
        log
      );

      log('Script execution completed successfully');
      task.logs = logs;
      return result;

    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      log(`Script execution failed: ${errorMsg}`);
      task.logs = logs;
      throw error;
    }
  }

  /**
   * Queue script để execute
   */
  async queueScript(scriptCode: string, profileId: string): Promise<AppiumScriptTask> {
    const task: AppiumScriptTask = {
      id: this.generateTaskId(),
      profileId,
      scriptCode,
      status: 'pending',
      logs: []
    };

    this.scriptQueue.push(task);
    logger.info(`Script queued: ${task.id} for profile ${profileId}`);

    // Start execution
    this.processQueue();

    return task;
  }

  /**
   * Process script queue
   */
  private async processQueue() {
    const pendingTasks = this.scriptQueue.filter(t => t.status === 'pending');

    for (const task of pendingTasks) {
      if (this.runningScripts.has(task.id)) {
        continue;
      }

      task.status = 'running';
      task.startedAt = new Date();

      const execution = this.executeScript(task)
        .then(result => {
          task.status = 'completed';
          task.result = result;
          task.completedAt = new Date();
          logger.info(`Script ${task.id} completed`);
        })
        .catch(error => {
          task.status = 'failed';
          task.error = error.message;
          task.completedAt = new Date();
          logger.error(`Script ${task.id} failed`, error);
        })
        .finally(() => {
          this.runningScripts.delete(task.id);
        });

      this.runningScripts.set(task.id, execution);
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): AppiumScriptTask | undefined {
    return this.scriptQueue.find(t => t.id === taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): AppiumScriptTask[] {
    return this.scriptQueue;
  }

  /**
   * Get tasks for specific profile
   */
  getTasksForProfile(profileId: string): AppiumScriptTask[] {
    return this.scriptQueue.filter(t => t.profileId === profileId);
  }

  /**
   * Close session cho profile
   */
  async closeSession(profileId: string) {
    const session = this.activeSessions.get(profileId);
    if (session) {
      try {
        await session.deleteSession();
      } catch (error) {
        logger.error(`Failed to close session for ${profileId}`, error);
      }
      this.activeSessions.delete(profileId);
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions() {
    for (const [profileId, session] of this.activeSessions) {
      try {
        await session.deleteSession();
      } catch (error) {
        logger.error(`Failed to close session for ${profileId}`, error);
      }
    }
    this.activeSessions.clear();
  }

  /**
   * Clear completed tasks
   */
  clearCompletedTasks() {
    this.scriptQueue = this.scriptQueue.filter(
      t => t.status !== 'completed' && t.status !== 'failed'
    );
  }

  /**
   * Convert key name to Android key code
   */
  private getKeyCode(keyName: string): number {
    const keyCodes: Record<string, number> = {
      'HOME': 3,
      'BACK': 4,
      'MENU': 82,
      'ENTER': 66,
      'DELETE': 67,
      'TAB': 61,
      'SPACE': 62,
      'VOLUME_UP': 24,
      'VOLUME_DOWN': 25,
      'POWER': 26,
      'CAMERA': 27,
    };

    return keyCodes[keyName.toUpperCase()] || 0;
  }

  private generateTaskId(): string {
    return `appium_script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default AppiumScriptService;
