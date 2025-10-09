import LDPlayerController from '../core/LDPlayerController.js';
import ProfileManager, { MobileProfile } from './ProfileManager.js';
import { logger } from '../utils/logger.js';

export interface DirectScriptTask {
  id: string;
  profileId: number;
  scriptCode: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  logs?: string[];
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Direct Mobile Script Service - Giống Puppeteer, KHÔNG CẦN Appium Server
 * Sử dụng ADB trực tiếp thông qua LDPlayerController
 */
export class DirectMobileScriptService {
  private controller: LDPlayerController;
  private profileManager: ProfileManager;
  private scriptQueue: DirectScriptTask[] = [];
  private runningScripts: Map<string, Promise<any>> = new Map();
  private broadcast?: (logType: 'task' | 'profile', id: number, logMessage: string, timestamp: string) => void;

  constructor(controller: LDPlayerController, profileManager: ProfileManager) {
    this.controller = controller;
    this.profileManager = profileManager;
  }

  /**
   * Set broadcast function for real-time log updates
   */
  setBroadcast(broadcastFn: (logType: 'task' | 'profile', id: number, logMessage: string, timestamp: string) => void) {
    this.broadcast = broadcastFn;
  }

  /**
   * Execute JavaScript code trên mobile instance
   * KHÔNG CẦN Appium - dùng ADB trực tiếp!
   */
  async executeScript(task: DirectScriptTask): Promise<any> {
    const profile = this.profileManager.getProfile(task.profileId);
    if (!profile) {
      throw new Error(`Profile ${task.profileId} not found`);
    }

    const logs: string[] = [];
    const log = (message: string) => {
      const timestamp = new Date().toISOString().substr(11, 8);
      const logMessage = `[${timestamp}] ${message}`;
      logs.push(logMessage);
      logger.info(`[Script ${task.id}] ${logMessage}`);
      console.log(`[DEBUG] ${logMessage}`);

      // Broadcast log to WebSocket clients in real-time
      if (this.broadcast) {
        this.broadcast('profile', task.profileId, message, timestamp);
      }
    };

    try {
      log(`Starting script execution for profile: ${profile.name} (ID: ${profile.id})`);
      log(`Instance: ${profile.instanceName}, Status: ${profile.status}`);

      // Check if instance is running
      if (profile.status !== 'active') {
        log(`WARNING: Instance status is '${profile.status}', may not be running!`);
      }

      // IMPORTANT: Always get fresh ADB port from ldconsole before execution
      log(`Resolving ADB port for instance ${profile.instanceName} from ldconsole...`);
      let actualPort: number;
      try {
        actualPort = await this.controller.getAdbPortForInstance(profile.instanceName);
        log(`Resolved ADB port: ${actualPort} (stored port was: ${profile.port})`);

        // Update profile port if it changed
        if (actualPort !== profile.port) {
          log(`Port changed from ${profile.port} to ${actualPort}, updating profile...`);
          profile.port = actualPort;
          await this.profileManager.updateProfile(profile.id, { port: actualPort });
        }
      } catch (portError: any) {
        log(`Failed to resolve ADB port: ${portError.message}`);
        throw new Error(`Cannot get ADB port for instance ${profile.instanceName}: ${portError.message}`);
      }

      // Auto-connect ADB before executing script
      log(`Connecting ADB to 127.0.0.1:${actualPort} using D:\\LDPlayer\\LDPlayer9\\adb.exe...`);
      try {
        await this.controller.connectADB(actualPort);
        log(`ADB connected successfully to port ${actualPort}`);
      } catch (connectError: any) {
        log(`ADB connect warning: ${connectError.message}`);
        log(`Attempting to continue anyway (device might already be connected)...`);
      }

      // Resolve actual ADB serial after connection
      log(`Resolving ADB serial for port ${actualPort}...`);
      let deviceSerial: string;
      try {
        deviceSerial = await this.controller.resolveAdbSerial(actualPort);
        log(`Device serial: ${deviceSerial}`);
      } catch (serialError: any) {
        log(`Failed to resolve device serial: ${serialError.message}`);
        throw new Error(`Cannot resolve device serial: ${serialError.message}`);
      }

      // Wait for device to be fully ready
      log(`Waiting for device to be fully ready...`);
      try {
        await this.controller.waitForDeviceReady(deviceSerial, 60000);
        log(`Device is ready for commands!`);
      } catch (readyError: any) {
        log(`Device ready check warning: ${readyError.message}`);
        log(`Continuing anyway, device might be usable...`);
      }

      // Helper functions sử dụng ADB trực tiếp (giống Puppeteer)
      // NOTE: Use deviceSerial instead of actualPort for all ADB commands
      const helpers = {
        // Tap vào tọa độ (ADB command)
        tap: async (x: number, y: number) => {
          log(`Tapping at (${x}, ${y})`);
          try {
            await this.controller.executeAdbCommand(deviceSerial, `shell input tap ${x} ${y}`);
            log(`Tap successful`);
          } catch (error: any) {
            log(`Tap failed: ${error.message}`);
            throw error;
          }
        },

        // Swipe gesture (ADB command)
        swipe: async (x1: number, y1: number, x2: number, y2: number, duration = 500) => {
          log(`Swiping from (${x1}, ${y1}) to (${x2}, ${y2}), duration: ${duration}ms`);
          try {
            await this.controller.executeAdbCommand(deviceSerial, `shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
            log(`Swipe successful`);
          } catch (error: any) {
            log(`Swipe failed: ${error.message}`);
            throw error;
          }
        },

        // Input text (ADB command)
        type: async (text: string) => {
          log(`Typing: "${text}"`);
          try {
            const escapedText = text.replace(/\s/g, '%s').replace(/'/g, "\\'");
            await this.controller.executeAdbCommand(deviceSerial, `shell input text '${escapedText}'`);
            log(`Text input successful`);
          } catch (error: any) {
            log(`Text input failed: ${error.message}`);
            throw error;
          }
        },

        // Take screenshot (ADB command)
        screenshot: async (savePath?: string) => {
          log('Taking screenshot');
          const path = savePath || `/sdcard/screenshot_${Date.now()}.png`;
          await this.controller.executeAdbCommand(deviceSerial, `shell screencap -p ${path}`);
          return path;
        },

        // Press Android key
        pressKey: async (keyCode: string) => {
          log(`Pressing key: ${keyCode}`);
          const keyCodes: Record<string, number> = {
            'HOME': 3,
            'BACK': 4,
            'MENU': 82,
            'ENTER': 66,
            'DELETE': 67,
          };
          const code = keyCodes[keyCode.toUpperCase()] || 0;
          await this.controller.executeAdbCommand(
            deviceSerial,
            `shell input keyevent ${code}`
          );
        },

        // Launch app by package name
        launchApp: async (packageName: string) => {
          log(`Launching app: ${packageName}`);
          try {
            const result = await this.controller.executeAdbCommand(
              deviceSerial,
              `shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
            );
            log(`App launched successfully`);
            log(`Launch output: ${result.substring(0, 100)}`);
          } catch (error: any) {
            log(`App launch failed: ${error.message}`);
            throw error;
          }
        },

        // Kill app
        killApp: async (packageName: string) => {
          log(`Killing app: ${packageName}`);
          await this.controller.executeAdbCommand(
            deviceSerial,
            `shell am force-stop ${packageName}`
          );
        },

        // Scroll down (swipe up on screen)
        scrollDown: async () => {
          // Default screen size 360x640
          const centerX = 180;
          const startY = 500;
          const endY = 200;
          await helpers.swipe(centerX, startY, centerX, endY, 500);
        },

        // Scroll up (swipe down on screen)
        scrollUp: async () => {
          const centerX = 180;
          const startY = 200;
          const endY = 500;
          await helpers.swipe(centerX, startY, centerX, endY, 500);
        },

        // Sleep/wait
        sleep: async (ms: number) => {
          log(`Sleeping for ${ms}ms...`);
          await new Promise(resolve => setTimeout(resolve, ms));
          log(`Sleep completed`);
        },

        // Dump UI hierarchy (for debugging)
        dumpUI: async () => {
          log('Dumping UI hierarchy...');
          await this.controller.executeAdbCommand(
            deviceSerial,
            'shell uiautomator dump /sdcard/window_dump.xml'
          );
          const xml = await this.controller.executeAdbCommand(
            deviceSerial,
            'shell cat /sdcard/window_dump.xml'
          );
          log('UI Hierarchy dumped successfully');
          return xml;
        },

        // Find element by text, resource-id, class, or content-desc (like Appium!)
        findElement: async (selector: string, type: 'text' | 'id' | 'class' | 'desc' = 'text') => {
          log(`Finding element by ${type}: ${selector}`);

          // Dump UI hierarchy to XML
          await this.controller.executeAdbCommand(
            deviceSerial,
            'shell uiautomator dump /sdcard/window_dump.xml'
          );

          // Get XML content
          const xml = await this.controller.executeAdbCommand(
            deviceSerial,
            'shell cat /sdcard/window_dump.xml'
          );

          // Parse XML to find element bounds
          let bounds = null;

          if (type === 'text') {
            // Find by text: text="Twitter"
            const textMatch = xml.match(new RegExp(`text="${selector}"[^>]*bounds="\\[([0-9,]+)\\]\\[([0-9,]+)\\]"`));
            if (textMatch) {
              bounds = { start: textMatch[1], end: textMatch[2] };
            }
          } else if (type === 'id') {
            // Find by resource-id: resource-id="com.twitter.android:id/icon"
            const idMatch = xml.match(new RegExp(`resource-id="[^"]*${selector}"[^>]*bounds="\\[([0-9,]+)\\]\\[([0-9,]+)\\]"`));
            if (idMatch) {
              bounds = { start: idMatch[1], end: idMatch[2] };
            }
          } else if (type === 'class') {
            // Find by class: class="android.widget.TextView"
            const classMatch = xml.match(new RegExp(`class="${selector}"[^>]*bounds="\\[([0-9,]+)\\]\\[([0-9,]+)\\]"`));
            if (classMatch) {
              bounds = { start: classMatch[1], end: classMatch[2] };
            }
          } else if (type === 'desc') {
            // Find by content-desc: content-desc="User profile"
            const descMatch = xml.match(new RegExp(`content-desc="${selector}"[^>]*bounds="\\[([0-9,]+)\\]\\[([0-9,]+)\\]"`));
            if (descMatch) {
              bounds = { start: descMatch[1], end: descMatch[2] };
            }
          }

          if (!bounds) {
            throw new Error(`Element not found: ${selector}`);
          }

          // Calculate center point
          const [x1, y1] = bounds.start.split(',').map(Number);
          const [x2, y2] = bounds.end.split(',').map(Number);
          const centerX = Math.floor((x1 + x2) / 2);
          const centerY = Math.floor((y1 + y2) / 2);

          log(`Found element at (${centerX}, ${centerY})`);
          return { x: centerX, y: centerY, bounds };
        },

        // Tap element by text (tìm và tap luôn!)
        tapByText: async (text: string) => {
          log(`Tapping element with text: ${text}`);
          const element = await helpers.findElement(text, 'text');
          await helpers.tap(element.x, element.y);
        },

        // Tap element by resource-id
        tapById: async (id: string) => {
          log(`Tapping element with id: ${id}`);
          const element = await helpers.findElement(id, 'id');
          await helpers.tap(element.x, element.y);
        },

        // Tap element by content-desc (accessibility label)
        tapByDescription: async (desc: string) => {
          log(`Tapping element with description: ${desc}`);
          const element = await helpers.findElement(desc, 'desc');
          await helpers.tap(element.x, element.y);
        },

        // Check if element exists
        exists: async (selector: string, type: 'text' | 'id' | 'class' | 'desc' = 'text') => {
          try {
            await helpers.findElement(selector, type);
            return true;
          } catch {
            return false;
          }
        },

        // Wait for element to appear (với timeout)
        waitForElement: async (selector: string, type: 'text' | 'id' | 'class' | 'desc' = 'text', timeout = 10000) => {
          log(`Waiting for element: ${selector} (timeout: ${timeout}ms)`);
          const startTime = Date.now();

          while (Date.now() - startTime < timeout) {
            const exists = await helpers.exists(selector, type);
            if (exists) {
              log(`Element found: ${selector}`);
              return true;
            }
            await helpers.sleep(500); // Check every 500ms
          }

          throw new Error(`Element not found after ${timeout}ms: ${selector}`);
        },

        // Find multiple elements (returns array)
        findElements: async (selector: string, type: 'text' | 'id' | 'class' | 'desc' = 'text') => {
          log(`Finding all elements by ${type}: ${selector}`);

          await this.controller.executeAdbCommand(
            deviceSerial,
            'shell uiautomator dump /sdcard/window_dump.xml'
          );

          const xml = await this.controller.executeAdbCommand(
            deviceSerial,
            'shell cat /sdcard/window_dump.xml'
          );

          let pattern: RegExp;
          if (type === 'text') {
            pattern = new RegExp(`text="${selector}"[^>]*bounds="\\[([0-9,]+)\\]\\[([0-9,]+)\\]"`, 'g');
          } else if (type === 'id') {
            pattern = new RegExp(`resource-id="[^"]*${selector}"[^>]*bounds="\\[([0-9,]+)\\]\\[([0-9,]+)\\]"`, 'g');
          } else if (type === 'class') {
            pattern = new RegExp(`class="${selector}"[^>]*bounds="\\[([0-9,]+)\\]\\[([0-9,]+)\\]"`, 'g');
          } else if (type === 'desc') {
            pattern = new RegExp(`content-desc="${selector}"[^>]*bounds="\\[([0-9,]+)\\]\\[([0-9,]+)\\]"`, 'g');
          } else {
            return [];
          }

          const elements = [];
          let match;
          while ((match = pattern.exec(xml)) !== null) {
            const [x1, y1] = match[1].split(',').map(Number);
            const [x2, y2] = match[2].split(',').map(Number);
            const centerX = Math.floor((x1 + x2) / 2);
            const centerY = Math.floor((y1 + y2) / 2);

            elements.push({
              x: centerX,
              y: centerY,
              bounds: { x1, y1, x2, y2 }
            });
          }

          log(`Found ${elements.length} elements`);
          return elements;
        },

        // Get element text
        getElementText: async (selector: string, type: 'text' | 'id' | 'class' = 'id') => {
          log(`Getting text from element: ${selector}`);

          await this.controller.executeAdbCommand(
            deviceSerial,
            'shell uiautomator dump /sdcard/window_dump.xml'
          );

          const xml = await this.controller.executeAdbCommand(
            deviceSerial,
            'shell cat /sdcard/window_dump.xml'
          );

          let textMatch = null;
          if (type === 'id') {
            textMatch = xml.match(new RegExp(`resource-id="[^"]*${selector}"[^>]*text="([^"]*)"`));
          } else if (type === 'class') {
            textMatch = xml.match(new RegExp(`class="${selector}"[^>]*text="([^"]*)"`));
          }

          return textMatch ? textMatch[1] : '';
        },

        // Get screen size
        getScreenSize: async () => {
          const result = await this.controller.executeAdbCommand(
            deviceSerial,
            'shell wm size'
          );
          // Parse: "Physical size: 360x640"
          const match = result.match(/(\d+)x(\d+)/);
          if (match) {
            return { width: parseInt(match[1]), height: parseInt(match[2]) };
          }
          return { width: 360, height: 640 }; // default
        },

        // Execute custom ADB command
        adb: async (command: string) => {
          log(`Executing ADB: ${command}`);
          return await this.controller.executeAdbCommand(deviceSerial, command);
        },

        // Console.log trong script
        log: (message: string) => {
          log(`[User Script] ${message}`);
        },

        // Check ADB connection
        checkConnection: async () => {
          log(`Checking ADB connection...`);
          try {
            const result = await this.controller.executeAdbCommand(
              deviceSerial,
              'shell echo "connected"'
            );
            if (result.includes('connected')) {
              log(`ADB connection OK`);
              return true;
            }
            log(`ADB connection might be unstable`);
            return false;
          } catch (error: any) {
            log(`ADB connection failed: ${error.message}`);
            return false;
          }
        },

        // Re-connect ADB if needed
        reconnect: async () => {
          log(`Reconnecting ADB to port ${actualPort}...`);
          try {
            await this.controller.connectADB(actualPort);
            // Re-resolve serial after reconnect
            deviceSerial = await this.controller.resolveAdbSerial(actualPort);
            await this.controller.waitForDeviceReady(deviceSerial);
            log(`Reconnected successfully, new serial: ${deviceSerial}`);
            return true;
          } catch (error: any) {
            log(`Reconnection failed: ${error.message}`);
            return false;
          }
        }
      };

      // Execute user script với access đến helpers
      log(`Preparing to execute user script...`);
      log(`Script length: ${task.scriptCode.length} characters`);

      // Create async function from user code
      // Use AsyncFunction constructor to properly handle async/await
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

      // Log FULL script for debugging (with proper escaping)
      log(`Full script code:\n${'-'.repeat(60)}`);
      log(task.scriptCode);
      log(`${'-'.repeat(60)}`);
      log(`Script length: ${task.scriptCode.length} characters`);

      // Show hex dump of first 50 chars to detect hidden characters
      const hexDump = Array.from(task.scriptCode.substring(0, 50))
        .map(c => `${c}[${c.charCodeAt(0)}]`)
        .join(' ');
      log(`Hex dump (first 50 chars): ${hexDump}`);

      // Sanitize script: remove BOM, zero-width chars, smart quotes, and normalize line endings
      let sanitizedScript = task.scriptCode
        .replace(/^\uFEFF/, '') // Remove BOM
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
        .replace(/[\u2018\u2019]/g, "'") // Smart single quotes → normal
        .replace(/[\u201C\u201D]/g, '"') // Smart double quotes → normal
        .replace(/\r\n/g, '\n') // Normalize Windows line endings to Unix
        .replace(/\r/g, '\n') // Normalize Mac line endings to Unix
        .replace(/\u00A0/g, ' ') // Replace non-breaking space with normal space
        .replace(/[\u2000-\u200A]/g, ' ') // Replace various unicode spaces with normal space
        .trim();

      log(`Sanitized script (length: ${sanitizedScript.length})`);

      // Log character codes of entire script for debugging
      if (sanitizedScript.length < 200) {
        const charCodes = Array.from(sanitizedScript).map((c, i) => `${i}:${c.charCodeAt(0)}`).join(',');
        log(`Character codes: ${charCodes}`);
      }

      // Validate script syntax before creating function
      log(`Validating script syntax...`);
      try {
        // Test parse by wrapping in async function
        new Function(`return (async () => {\n${sanitizedScript}\n})`);
        log(`Script syntax is valid`);
      } catch (syntaxError: any) {
        log(`Script syntax validation failed: ${syntaxError.message}`);
        log(`Syntax error details: ${JSON.stringify(syntaxError)}`);
        log(`First 200 chars of sanitized script: ${sanitizedScript.substring(0, 200)}`);

        // Show problematic characters if any
        const nonAscii = Array.from(sanitizedScript)
          .map((c, i) => ({ char: c, code: c.charCodeAt(0), index: i }))
          .filter(x => x.code > 127 || (x.code < 32 && x.code !== 10));

        if (nonAscii.length > 0) {
          log(`Found ${nonAscii.length} non-standard characters: ${JSON.stringify(nonAscii.slice(0, 10))}`);
        }

        throw new Error(`Invalid script syntax: ${syntaxError.message}. Please check your script code.`);
      }

      // Use sanitized script instead of original
      task.scriptCode = sanitizedScript;

      log(`Executing user script now...`);
      const startTime = Date.now();

      try {
        // Execute script with helpers context (use sanitized version)
        const scriptFunction = new AsyncFunction('helpers', 'log', sanitizedScript);
        const result = await scriptFunction(helpers, log);
        const duration = Date.now() - startTime;

        log(`Script execution completed successfully in ${duration}ms`);
        if (result !== undefined) {
          log(`Result: ${JSON.stringify(result)}`);
        }

        task.logs = logs;
        return result;
      } catch (scriptError: any) {
        const duration = Date.now() - startTime;
        log(`Script execution failed after ${duration}ms`);
        log(`Error: ${scriptError.message}`);
        if (scriptError.stack) {
          log(`Stack: ${scriptError.stack}`);
        }
        task.logs = logs;
        throw scriptError;
      }

    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      log(`FATAL ERROR: ${errorMsg}`);
      if (error.stack) {
        log(`Stack trace: ${error.stack}`);
      }
      task.logs = logs;
      throw error;
    }
  }

  /**
   * Queue script để execute
   */
  async queueScript(scriptCode: string, profileId: number): Promise<DirectScriptTask> {
    const task: DirectScriptTask = {
      id: this.generateTaskId(),
      profileId,
      scriptCode,
      status: 'pending',
      logs: [`Script queued at ${new Date().toISOString()}`]
    };

    this.scriptQueue.push(task);
    logger.info(`Script queued: ${task.id} for profile ${profileId}`);
    console.log(`[DEBUG] Script queued: ${task.id}, Queue size: ${this.scriptQueue.length}`);

    // Start execution
    this.processQueue();

    return task;
  }

  /**
   * Process script queue
   */
  private async processQueue() {
    const pendingTasks = this.scriptQueue.filter(t => t.status === 'pending');

    console.log(`[DEBUG] Processing queue: ${pendingTasks.length} pending tasks`);
    logger.info(`Processing queue: ${pendingTasks.length} pending, ${this.runningScripts.size} running`);

    for (const task of pendingTasks) {
      if (this.runningScripts.has(task.id)) {
        console.log(`[DEBUG] Task ${task.id} already running, skipping`);
        continue;
      }

      task.status = 'running';
      task.startedAt = new Date();
      task.logs?.push(`Script execution started at ${task.startedAt.toISOString()}`);

      console.log(`[DEBUG] Starting execution for task ${task.id}`);
      logger.info(`Starting execution for task ${task.id}`);

      const execution = this.executeScript(task)
        .then(async result => {
          task.status = 'completed';
          task.result = result;
          task.completedAt = new Date();
          task.logs?.push(`Script completed at ${task.completedAt.toISOString()}`);

          console.log(`[DEBUG] Task ${task.id} completed successfully`);
          logger.info(`Script ${task.id} completed successfully`);

          // Save logs to profile for View Log UI
          await this.saveLogsToProfile(task);
        })
        .catch(async error => {
          task.status = 'failed';
          task.error = error.message;
          task.completedAt = new Date();
          task.logs?.push(`Script failed at ${task.completedAt.toISOString()}: ${error.message}`);

          console.error(`[DEBUG] Task ${task.id} failed:`, error);
          logger.error(`Script ${task.id} failed: ${error.message}`, error);

          // Save logs to profile even on failure
          await this.saveLogsToProfile(task);
        })
        .finally(() => {
          this.runningScripts.delete(task.id);
          console.log(`[DEBUG] Task ${task.id} removed from running scripts`);
        });

      this.runningScripts.set(task.id, execution);
    }
  }

  getTask(taskId: string): DirectScriptTask | undefined {
    return this.scriptQueue.find(t => t.id === taskId);
  }

  getAllTasks(): DirectScriptTask[] {
    return this.scriptQueue;
  }

  getTasksForProfile(profileId: number): DirectScriptTask[] {
    return this.scriptQueue.filter(t => t.profileId === profileId);
  }

  clearCompletedTasks() {
    this.scriptQueue = this.scriptQueue.filter(
      t => t.status !== 'completed' && t.status !== 'failed'
    );
  }

  private generateTaskId(): string {
    return `direct_script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save logs to profile metadata for View Log UI
   */
  private async saveLogsToProfile(task: DirectScriptTask) {
    try {
      const profile = this.profileManager.getProfile(task.profileId);
      if (!profile) {
        logger.warn(`Profile ${task.profileId} not found, cannot save logs`);
        return;
      }

      // Format logs with timestamp and status
      const timestamp = new Date().toLocaleString();
      const statusPrefix = task.status === 'completed' ? '[OK]' : '[FAILED]';
      const logHeader = `${statusPrefix} Script Execution - ${timestamp}\n${'='.repeat(60)}\n`;
      const logContent = (task.logs || []).join('\n');
      const logFooter = `\n${'='.repeat(60)}\nStatus: ${task.status.toUpperCase()}${task.error ? `\nError: ${task.error}` : ''}\n`;

      const fullLog = logHeader + logContent + logFooter;

      // Update profile with log
      await this.profileManager.updateProfile(task.profileId, {
        metadata: {
          ...profile.metadata,
          lastLog: fullLog,
          lastExecution: {
            taskId: task.id,
            status: task.status,
            timestamp: new Date(),
            logs: task.logs
          }
        }
      });

      logger.info(`Saved logs to profile ${task.profileId}`);
    } catch (error) {
      logger.error('Failed to save logs to profile:', error);
    }
  }
}

export default DirectMobileScriptService;
