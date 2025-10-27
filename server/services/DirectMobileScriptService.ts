import LDPlayerController from '../core/LDPlayerController.js';
import ProfileManager, { MobileProfile } from './ProfileManager.js';
import { logger } from '../utils/logger.js';
import * as xpath from 'xpath';
import { DOMParser } from 'xmldom';
import { MobileImposter } from '../antidetect/MobileImposter.js';
import { CloudflareDetector } from './CloudflareDetector.js';
import { CaptchaSolver } from './CaptchaSolver.js';
import { SessionPersistence } from './SessionPersistence.js';

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
  private broadcastStatus?: (type: string, data: any) => void;

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
   * Set broadcast function for profile status updates
   */
  setBroadcastStatus(broadcastStatusFn: (type: string, data: any) => void) {
    this.broadcastStatus = broadcastStatusFn;
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
        // Tap vào tọa độ (ADB command) with "fat finger" mode for better accuracy
        tap: async (x: number, y: number, options?: {
          tolerance?: number; // Tap radius in pixels (default: 0 = single tap)
          multiTap?: boolean; // Tap multiple points around target (default: false)
        }) => {
          const tolerance = options?.tolerance ?? 15; // Default 15px radius for better hit rate
          const multiTap = options?.multiTap ?? false;

          if (tolerance > 0 && multiTap) {
            // Multi-tap mode: tap 5 points (center + 4 corners of square)
            log(`Multi-tapping at (${x}, ${y}) with ${tolerance}px tolerance (5 points)`);
            const points = [
              { x: x, y: y }, // Center
              { x: x - tolerance, y: y - tolerance }, // Top-left
              { x: x + tolerance, y: y - tolerance }, // Top-right
              { x: x - tolerance, y: y + tolerance }, // Bottom-left
              { x: x + tolerance, y: y + tolerance }, // Bottom-right
            ];

            for (const point of points) {
              try {
                await this.controller.executeAdbCommand(deviceSerial, `shell input tap ${point.x} ${point.y}`);
                await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay between taps
              } catch (error: any) {
                // Ignore individual tap failures, continue with next point
              }
            }
            log(`Multi-tap completed`);
          } else if (tolerance > 0) {
            // Single tap with random offset within tolerance radius for better hit rate
            const randomOffsetX = Math.floor((Math.random() - 0.5) * tolerance);
            const randomOffsetY = Math.floor((Math.random() - 0.5) * tolerance);
            const targetX = x + randomOffsetX;
            const targetY = y + randomOffsetY;

            log(`Tapping at (${x}, ${y}) with tolerance ${tolerance}px → actual (${targetX}, ${targetY})`);
            try {
              await this.controller.executeAdbCommand(deviceSerial, `shell input tap ${targetX} ${targetY}`);
              log(`Tap successful`);
            } catch (error: any) {
              log(`Tap failed: ${error.message}`);
              throw error;
            }
          } else {
            // Exact tap (no tolerance)
            log(`Tapping at (${x}, ${y})`);
            try {
              await this.controller.executeAdbCommand(deviceSerial, `shell input tap ${x} ${y}`);
              log(`Tap successful`);
            } catch (error: any) {
              log(`Tap failed: ${error.message}`);
              throw error;
            }
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
        tapByText: async (text: string, options?: { partialMatch?: boolean; caseSensitive?: boolean }) => {
          const partialMatch = options?.partialMatch ?? false;
          const caseSensitive = options?.caseSensitive ?? true;

          log(`Tapping element with text: "${text}" (partial: ${partialMatch}, caseSensitive: ${caseSensitive})`);

          if (partialMatch || !caseSensitive) {
            // Use XPath for advanced matching
            const caseFlag = caseSensitive ? '' : 'translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")';
            const textToMatch = caseSensitive ? text : text.toLowerCase();

            let xpath = '';
            if (partialMatch && !caseSensitive) {
              xpath = `//*[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "${textToMatch}")]`;
            } else if (partialMatch) {
              xpath = `//*[contains(text(), "${textToMatch}")]`;
            } else if (!caseSensitive) {
              xpath = `//*[translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="${textToMatch}"]`;
            }

            const element = await helpers.findByXPath(xpath);
            await helpers.tap(element.x, element.y);
          } else {
            // Exact match (default)
            const element = await helpers.findElement(text, 'text');
            await helpers.tap(element.x, element.y);
          }
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

        // Wait for text to appear (alias for waitForElement with type='text')
        // Compatible with generated scripts
        waitForText: async (text: string, options: { timeout?: number } = {}) => {
          const timeout = options.timeout || 10000;
          log(`Waiting for text: "${text}" (timeout: ${timeout}ms)`);
          return await helpers.waitForElement(text, 'text', timeout);
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

        // Execute ADB shell command (alias for adb with shell prefix)
        adbShell: async (command: string) => {
          log(`Executing ADB shell: ${command}`);
          return await this.controller.executeAdbCommand(deviceSerial, `shell ${command}`);
        },

        // Tap at relative position (percentage of screen)
        // Enhanced with aspect ratio compensation for better cross-device accuracy
        tapRel: async (xPercent: number, yPercent: number, options?: {
          baseWidth?: number;
          baseHeight?: number;
          anchor?: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
          tolerance?: number; // Tap tolerance in pixels (default: 20px)
          multiTap?: boolean; // Tap 5 points for better accuracy (default: false)
        }) => {
          const size = await helpers.getScreenSize();

          // Base resolution (from recording device)
          const baseWidth = options?.baseWidth || 1080;
          const baseHeight = options?.baseHeight || 2400;

          // Calculate aspect ratios
          const baseAspect = baseWidth / baseHeight;
          const currentAspect = size.width / size.height;

          let x: number, y: number;

          if (options?.anchor) {
            // Use anchor-based positioning for better accuracy
            const anchor = options.anchor;

            // Calculate offset from anchor point
            let anchorX = 0, anchorY = 0;
            if (anchor.includes('center')) anchorX = size.width / 2;
            else if (anchor.includes('right')) anchorX = size.width;

            if (anchor.includes('center') && !anchor.includes('top') && !anchor.includes('bottom')) anchorY = size.height / 2;
            else if (anchor.includes('bottom')) anchorY = size.height;

            // Convert % to offset from anchor
            const offsetX = (size.width * xPercent) / 100 - (baseWidth * xPercent) / 100;
            const offsetY = (size.height * yPercent) / 100 - (baseHeight * yPercent) / 100;

            x = Math.floor(anchorX + offsetX);
            y = Math.floor(anchorY + offsetY);
          } else {
            // Standard percentage-based tap with aspect ratio compensation
            // If aspect ratios differ significantly, adjust Y coordinate
            if (Math.abs(currentAspect - baseAspect) > 0.05) {
              // Device is narrower/wider than base
              const aspectRatio = currentAspect / baseAspect;

              // Compensate Y position based on aspect ratio
              // Elements typically shift vertically when aspect changes
              const compensatedYPercent = yPercent + (yPercent - 50) * (1 - aspectRatio) * 0.3;

              x = Math.floor((size.width * xPercent) / 100);
              y = Math.floor((size.height * compensatedYPercent) / 100);

              log(`Aspect ratio compensation: ${baseAspect.toFixed(3)} -> ${currentAspect.toFixed(3)}, Y adjusted: ${yPercent}% -> ${compensatedYPercent.toFixed(1)}%`);
            } else {
              // No compensation needed
              x = Math.floor((size.width * xPercent) / 100);
              y = Math.floor((size.height * yPercent) / 100);
            }
          }

          log(`Tapping at ${xPercent}%, ${yPercent}% = (${x}, ${y}) on ${size.width}x${size.height}`);

          // Use default tolerance (20px) for better hit rate on all taps
          // Users can override by passing tolerance: 0 to disable
          const tolerance = options?.tolerance ?? 20;
          const multiTap = options?.multiTap ?? false;

          await helpers.tap(x, y, { tolerance, multiTap });
        },

        // Swipe with relative coordinates
        swipeRel: async (x1Percent: number, y1Percent: number, x2Percent: number, y2Percent: number, duration = 500) => {
          const size = await helpers.getScreenSize();
          const x1 = Math.floor((size.width * x1Percent) / 100);
          const y1 = Math.floor((size.height * y1Percent) / 100);
          const x2 = Math.floor((size.width * x2Percent) / 100);
          const y2 = Math.floor((size.height * y2Percent) / 100);
          log(`Swiping from ${x1Percent}%, ${y1Percent}% to ${x2Percent}%, ${y2Percent}%`);
          await helpers.swipe(x1, y1, x2, y2, duration);
        },

        // Random delay (human-like)
        randomDelay: async (min: number, max: number) => {
          const delay = Math.floor(Math.random() * (max - min + 1)) + min;
          log(`Random delay: ${delay}ms`);
          await helpers.sleep(delay);
        },

        // Console.log trong script
        log: (message: string) => {
          log(`[User Script] ${message}`);
        },

        // Get account credentials from profile metadata
        getAccount: (appName: string) => {
          log(`Getting account for: ${appName}`);
          const accounts = profile.metadata?.accounts || {};
          if (accounts[appName]) {
            log(`Found account for ${appName}`);
            return accounts[appName];
          }
          log(`No account found for ${appName}`);
          return null;
        },

        // Get all accounts
        getAllAccounts: () => {
          log(`Getting all accounts`);
          return profile.metadata?.accounts || {};
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
        },

        // ========================================
        // XPath Support (Advanced Element Finding)
        // ========================================

        /**
         * Find element by XPath query
         * @param xpathQuery - XPath expression (e.g., '//android.widget.Button[@text="Login"]')
         * @returns Element with coordinates and bounds
         */
        findByXPath: async (xpathQuery: string) => {
          log(`Finding element by XPath: ${xpathQuery}`);

          // Dump UI hierarchy to XML
          await this.controller.executeAdbCommand(
            deviceSerial,
            'shell uiautomator dump /sdcard/window_dump.xml'
          );

          // Get XML content
          const xmlString = await this.controller.executeAdbCommand(
            deviceSerial,
            'shell cat /sdcard/window_dump.xml'
          );

          try {
            // Parse XML using xmldom
            const doc = new DOMParser().parseFromString(xmlString, 'text/xml');

            // Execute XPath query
            const nodes = xpath.select(xpathQuery, doc) as any[];

            if (!nodes || nodes.length === 0) {
              throw new Error(`No element found for XPath: ${xpathQuery}`);
            }

            // Get first matching node
            const node = nodes[0];

            // Extract bounds attribute
            const boundsAttr = node.getAttribute ? node.getAttribute('bounds') : null;

            if (!boundsAttr) {
              throw new Error(`Element found but has no bounds attribute`);
            }

            // Parse bounds: "[x1,y1][x2,y2]"
            const boundsMatch = boundsAttr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
            if (!boundsMatch) {
              throw new Error(`Invalid bounds format: ${boundsAttr}`);
            }

            const [, x1, y1, x2, y2] = boundsMatch.map(Number);
            const centerX = Math.floor((x1 + x2) / 2);
            const centerY = Math.floor((y1 + y2) / 2);

            log(`Found element at (${centerX}, ${centerY}), bounds: ${boundsAttr}`);

            return {
              x: centerX,
              y: centerY,
              bounds: { x1, y1, x2, y2 },
              node: node,
              text: node.getAttribute ? node.getAttribute('text') : '',
              resourceId: node.getAttribute ? node.getAttribute('resource-id') : '',
              className: node.getAttribute ? node.getAttribute('class') : ''
            };
          } catch (error: any) {
            log(`XPath query failed: ${error.message}`);
            throw new Error(`XPath error: ${error.message}`);
          }
        },

        /**
         * Find multiple elements by XPath query
         * @param xpathQuery - XPath expression
         * @returns Array of elements with coordinates
         */
        findAllByXPath: async (xpathQuery: string) => {
          log(`Finding all elements by XPath: ${xpathQuery}`);

          // Dump UI hierarchy
          await this.controller.executeAdbCommand(
            deviceSerial,
            'shell uiautomator dump /sdcard/window_dump.xml'
          );

          const xmlString = await this.controller.executeAdbCommand(
            deviceSerial,
            'shell cat /sdcard/window_dump.xml'
          );

          try {
            const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
            const nodes = xpath.select(xpathQuery, doc) as any[];

            if (!nodes || nodes.length === 0) {
              log(`No elements found for XPath: ${xpathQuery}`);
              return [];
            }

            const elements = nodes.map((node, index) => {
              const boundsAttr = node.getAttribute ? node.getAttribute('bounds') : null;
              if (!boundsAttr) return null;

              const boundsMatch = boundsAttr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
              if (!boundsMatch) return null;

              const [, x1, y1, x2, y2] = boundsMatch.map(Number);
              const centerX = Math.floor((x1 + x2) / 2);
              const centerY = Math.floor((y1 + y2) / 2);

              return {
                x: centerX,
                y: centerY,
                bounds: { x1, y1, x2, y2 },
                text: node.getAttribute ? node.getAttribute('text') : '',
                resourceId: node.getAttribute ? node.getAttribute('resource-id') : '',
                className: node.getAttribute ? node.getAttribute('class') : '',
                index: index
              };
            }).filter(Boolean);

            log(`Found ${elements.length} elements`);
            return elements;
          } catch (error: any) {
            log(`XPath query failed: ${error.message}`);
            return [];
          }
        },

        /**
         * Tap element found by XPath
         * @param xpathQuery - XPath expression
         */
        tapByXPath: async (xpathQuery: string) => {
          log(`Tapping element by XPath: ${xpathQuery}`);
          const element = await helpers.findByXPath(xpathQuery);
          await helpers.tap(element.x, element.y);
          log(`Tapped element at (${element.x}, ${element.y})`);
        },

        /**
         * Type text into element found by XPath
         * @param xpathQuery - XPath expression
         * @param text - Text to type
         */
        typeByXPath: async (xpathQuery: string, text: string) => {
          log(`Typing into element by XPath: ${xpathQuery}`);
          const element = await helpers.findByXPath(xpathQuery);
          await helpers.tap(element.x, element.y);
          await helpers.sleep(300);
          await helpers.type(text);
          log(`Typed "${text}" into element`);
        },

        /**
         * Wait for element to appear by XPath
         * @param xpathQuery - XPath expression
         * @param timeout - Timeout in milliseconds (default: 10000)
         */
        waitForXPath: async (xpathQuery: string, timeout = 10000) => {
          log(`Waiting for XPath element: ${xpathQuery} (timeout: ${timeout}ms)`);
          const startTime = Date.now();

          while (Date.now() - startTime < timeout) {
            try {
              const element = await helpers.findByXPath(xpathQuery);
              log(`XPath element found after ${Date.now() - startTime}ms`);
              return element;
            } catch (error) {
              // Element not found yet, continue waiting
              await helpers.sleep(500);
            }
          }

          throw new Error(`XPath element not found after ${timeout}ms: ${xpathQuery}`);
        },

        /**
         * Check if element exists by XPath
         * @param xpathQuery - XPath expression
         * @returns true if element exists, false otherwise
         */
        existsByXPath: async (xpathQuery: string) => {
          try {
            await helpers.findByXPath(xpathQuery);
            return true;
          } catch (error) {
            return false;
          }
        },

        /**
         * Get text content of element found by XPath
         * @param xpathQuery - XPath expression
         * @returns Text content
         */
        getTextByXPath: async (xpathQuery: string) => {
          log(`Getting text by XPath: ${xpathQuery}`);
          const element = await helpers.findByXPath(xpathQuery);
          log(`Text: "${element.text}"`);
          return element.text;
        }
      };

      // ========================================
      // 🚀 MOBILE IMPOSTER - Human-like Behaviors
      // ========================================

      const imposter = new MobileImposter();

      const humanHelpers = {
        /**
         * Human-like tap with random offset and delays
         * Usage: await human.tap(x, y)
         */
        tap: async (x: number, y: number, options?: {
          preTapDelay?: [number, number];
          postTapDelay?: [number, number];
          offsetRange?: number;
        }) => {
          log(`[HUMAN] Tapping at (${x}, ${y}) with human-like behavior`);
          await imposter.humanTap(helpers, x, y, options);
        },

        /**
         * Human-like typing with variable speed
         * Usage: await human.type('hello world')
         */
        type: async (text: string, options?: {
          charDelay?: [number, number];
          pauseChance?: number;
        }) => {
          log(`[HUMAN] Typing "${text}" with human-like speed`);
          await imposter.humanType(helpers, text, options);
        },

        /**
         * Human-like swipe with Bézier curve
         * Usage: await human.swipe(x1, y1, x2, y2)
         */
        swipe: async (x1: number, y1: number, x2: number, y2: number, options?: {
          addCurve?: boolean;
          wobble?: boolean;
        }) => {
          log(`[HUMAN] Swiping from (${x1}, ${y1}) to (${x2}, ${y2}) with curve`);
          await imposter.humanSwipe(helpers, x1, y1, x2, y2, options);
        },

        /**
         * Human-like scroll
         * Usage: await human.scroll(300) // scroll down 300px
         */
        scroll: async (distance: number, options?: {
          centerX?: number;
          startY?: number;
        }) => {
          log(`[HUMAN] Scrolling ${distance}px with human-like behavior`);
          await imposter.humanScroll(helpers, distance, options);
        },

        /**
         * Quick tap (less delay)
         */
        quickTap: async (x: number, y: number) => {
          log(`[HUMAN] Quick tap at (${x}, ${y})`);
          await imposter.quickTap(helpers, x, y);
        },

        /**
         * Slow tap (more careful)
         */
        slowTap: async (x: number, y: number) => {
          log(`[HUMAN] Slow tap at (${x}, ${y})`);
          await imposter.slowTap(helpers, x, y);
        },

        /**
         * Thinking delay (800-2000ms)
         */
        think: async () => {
          log(`[HUMAN] Thinking...`);
          await imposter.thinkingDelay();
        },

        /**
         * Reading delay based on text length
         */
        read: async (textLength: number) => {
          log(`[HUMAN] Reading ${textLength} characters...`);
          await imposter.readingDelay(textLength);
        },

        /**
         * Random delay with Gaussian distribution
         */
        delay: async (min: number, max: number) => {
          log(`[HUMAN] Random delay ${min}-${max}ms`);
          await imposter.humanDelay(min, max);
        },

        /**
         * Random offset
         */
        randomOffset: (min: number, max: number) => {
          return imposter.randomOffset(min, max);
        },

        /**
         * Idle behavior (random movements)
         */
        idle: async (duration: number = 3000) => {
          log(`[HUMAN] Idle behavior for ${duration}ms`);
          await imposter.idleBehavior(helpers, duration);
        }
      };

      // ========================================
      // 🛡️ CLOUDFLARE & CAPTCHA HELPERS
      // ========================================

      const captchaSolver = new CaptchaSolver('2captcha'); // Default to 2Captcha

      const cloudflare = {
        /**
         * Detect Cloudflare challenge
         * Usage: const challenge = await cloudflare.detect()
         */
        detect: async () => {
          log(`[CLOUDFLARE] Detecting challenge...`);
          const challenge = await CloudflareDetector.detectInScript(helpers);

          if (challenge.detected) {
            log(`[CLOUDFLARE] ⚠️ ${challenge.type} challenge detected!`);
          } else {
            log(`[CLOUDFLARE] ✅ No challenge detected`);
          }

          return challenge;
        },

        /**
         * Wait for Cloudflare JS challenge to auto-pass
         * Usage: await cloudflare.wait()
         */
        wait: async (timeout: number = 30000) => {
          log(`[CLOUDFLARE] Waiting for challenge to pass (timeout: ${timeout}ms)...`);
          const passed = await CloudflareDetector.waitForChallengePass(helpers, { timeout });

          if (passed) {
            log(`[CLOUDFLARE] ✅ Challenge passed!`);
          } else {
            log(`[CLOUDFLARE] ⏰ Timeout - challenge still present`);
          }

          return passed;
        },

        /**
         * Solve Cloudflare Turnstile captcha via API
         * Usage: const solution = await cloudflare.solve({ sitekey, pageurl })
         */
        solve: async (options: { sitekey?: string; pageurl?: string; type?: string }) => {
          log(`[CLOUDFLARE] Solving captcha via API...`);

          const result = await captchaSolver.solve({
            type: (options.type as any) || 'turnstile',
            sitekey: options.sitekey,
            pageurl: options.pageurl
          });

          if (result.success) {
            log(`[CLOUDFLARE] ✅ Captcha solved! Token: ${result.solution?.substring(0, 20)}...`);
            log(`[CLOUDFLARE] Cost: $${result.cost}, Time: ${result.solveTime}ms`);
          } else {
            log(`[CLOUDFLARE] ❌ Solve failed: ${result.error}`);
          }

          return result;
        },

        /**
         * Auto-handle Cloudflare challenge
         * Detects challenge type and handles automatically
         * Usage: await cloudflare.handle()
         * Note: solveIfNeeded defaults to FALSE (free mode)
         *       Set to TRUE to use paid API solving
         */
        handle: async (options?: { timeout?: number; solveIfNeeded?: boolean }) => {
          const { timeout = 30000, solveIfNeeded = false } = options || {};  // ⭐ Default FALSE = FREE!

          log(`[CLOUDFLARE] Auto-handling challenge...`);

          // Step 1: Detect
          const challenge = await CloudflareDetector.detectInScript(helpers);

          if (!challenge.detected) {
            log(`[CLOUDFLARE] No challenge detected, continuing...`);
            return { success: true, action: 'none' };
          }

          log(`[CLOUDFLARE] Detected: ${challenge.type}`);

          // Step 2: Handle based on type
          if (challenge.type === 'javascript') {
            // JavaScript challenge - wait for auto-pass
            log(`[CLOUDFLARE] JavaScript challenge - waiting for auto-pass...`);
            const passed = await CloudflareDetector.waitForChallengePass(helpers, { timeout });

            return {
              success: passed,
              action: 'waited',
              type: 'javascript'
            };

          } else if (challenge.type === 'turnstile' && solveIfNeeded) {
            // Turnstile captcha - solve via API
            log(`[CLOUDFLARE] Turnstile captcha - solving via API...`);

            if (!challenge.sitekey) {
              log(`[CLOUDFLARE] ❌ Cannot solve - no sitekey found`);
              return { success: false, action: 'failed', error: 'No sitekey' };
            }

            const result = await captchaSolver.solve({
              type: 'turnstile',
              sitekey: challenge.sitekey,
              pageurl: challenge.url || 'https://twitter.com'
            });

            if (result.success) {
              log(`[CLOUDFLARE] ✅ Captcha solved! Apply token manually or reload page.`);
              return {
                success: true,
                action: 'solved',
                type: 'turnstile',
                solution: result.solution
              };
            } else {
              log(`[CLOUDFLARE] ❌ Solve failed: ${result.error}`);
              return {
                success: false,
                action: 'failed',
                error: result.error
              };
            }

          } else if (challenge.type === 'blocked') {
            log(`[CLOUDFLARE] ❌ Blocked by Cloudflare - cannot bypass automatically`);
            return {
              success: false,
              action: 'blocked',
              type: 'blocked'
            };
          }

          return { success: false, action: 'unknown' };
        },

        /**
         * Check API balance
         */
        getBalance: async () => {
          const balance = await captchaSolver.getBalance();
          log(`[CLOUDFLARE] API Balance: $${balance}`);
          return balance;
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
        // Execute script with helpers, human, cloudflare, log, and profile context (use sanitized version)
        const scriptFunction = new AsyncFunction('helpers', 'human', 'cloudflare', 'log', 'profile', sanitizedScript);
        const result = await scriptFunction(helpers, humanHelpers, cloudflare, log, profile);
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
   * Clear all pending and running tasks (for server restart)
   */
  clearAllTasks(): void {
    logger.info('[DirectScriptService] Clearing all tasks');
    this.scriptQueue = [];
    this.runningScripts.clear();
  }

  /**
   * Queue script để execute
   * Auto-clears old completed/failed tasks for the same profile before queueing new task
   */
  async queueScript(scriptCode: string, profileId: number): Promise<DirectScriptTask> {
    // IMPORTANT: Clear old completed/failed tasks for this profile to prevent UI confusion
    // Keep only pending/running tasks for this profile
    const oldCompletedCount = this.scriptQueue.filter(
      t => t.profileId === profileId && (t.status === 'completed' || t.status === 'failed')
    ).length;

    if (oldCompletedCount > 0) {
      this.scriptQueue = this.scriptQueue.filter(
        t => !(t.profileId === profileId && (t.status === 'completed' || t.status === 'failed'))
      );
      logger.info(`Cleared ${oldCompletedCount} old tasks for profile ${profileId} before queueing new task`);
    }

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
   * Process script queue - PARALLEL EXECUTION
   * Execute ALL pending tasks simultaneously (not sequentially)
   */
  private async processQueue() {
    const pendingTasks = this.scriptQueue.filter(t => t.status === 'pending');

    console.log(`[DEBUG] Processing queue: ${pendingTasks.length} pending tasks`);
    logger.info(`Processing queue: ${pendingTasks.length} pending, ${this.runningScripts.size} running`);

    // ⚡ IMPORTANT: Start ALL pending tasks in PARALLEL (not for loop)
    const executionPromises = pendingTasks.map(task => {
      if (this.runningScripts.has(task.id)) {
        console.log(`[DEBUG] Task ${task.id} already running, skipping`);
        return Promise.resolve();
      }

      task.status = 'running';
      task.startedAt = new Date();
      task.logs?.push(`Script execution started at ${task.startedAt.toISOString()}`);

      console.log(`[DEBUG] Starting PARALLEL execution for task ${task.profileId}`);
      logger.info(`Starting PARALLEL execution for task ${task.id}, profile ${task.profileId}`);

      // ✅ UPDATE PROFILE STATUS TO 'running' FIRST (MUST AWAIT!)
      console.log(`[DEBUG] About to update profile ${task.profileId} status to 'running'`);

      const execution = (async () => {
        // ⚠️ NO LONGER UPDATE PROFILE STATUS - Task status is now separate from Instance status
        console.log(`[DEBUG] Starting script execution for task ${task.id}, profile ${task.profileId}`);
        return await this.executeScript(task);
      })()
        .then(async result => {
          task.status = 'completed';
          task.result = result;
          task.completedAt = new Date();
          task.logs?.push(`Script completed at ${task.completedAt.toISOString()}`);

          console.log(`[DEBUG] Task ${task.id} (profile ${task.profileId}) completed successfully`);
          logger.info(`Script ${task.id} (profile ${task.profileId}) completed successfully`);

          // Save logs to profile for View Log UI
          await this.saveLogsToProfile(task);

          // ⚠️ NO LONGER UPDATE PROFILE STATUS - Task status is now independent
        })
        .catch(async error => {
          task.status = 'failed';
          task.error = error.message;
          task.completedAt = new Date();
          task.logs?.push(`Script failed at ${task.completedAt.toISOString()}: ${error.message}`);

          console.error(`[DEBUG] Task ${task.id} (profile ${task.profileId}) failed:`, error);
          logger.error(`Script ${task.id} (profile ${task.profileId}) failed: ${error.message}`, error);

          // Save logs to profile even on failure
          await this.saveLogsToProfile(task);

          // ⚠️ NO LONGER UPDATE PROFILE STATUS - Task status is now independent
        })
        .finally(() => {
          this.runningScripts.delete(task.id);
          console.log(`[DEBUG] Task ${task.id} (profile ${task.profileId}) removed from running scripts`);
        });

      this.runningScripts.set(task.id, execution);
      return execution;
    });

    // Wait for all executions to complete (parallel)
    console.log(`[DEBUG] Waiting for ${executionPromises.length} parallel executions...`);
    await Promise.allSettled(executionPromises);
    console.log(`[DEBUG] All parallel executions completed`);
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
   * Update profile status and broadcast via WebSocket
   */
  private async updateProfileStatus(profileId: number, status: 'running' | 'active' | 'inactive' | 'suspended') {
    try {
      console.log(`[DEBUG updateProfileStatus] Starting update for profile ${profileId} to status: ${status}`);

      const profile = this.profileManager.getProfile(profileId);
      if (!profile) {
        logger.warn(`Profile ${profileId} not found, cannot update status`);
        console.log(`[DEBUG updateProfileStatus] Profile ${profileId} NOT FOUND`);
        return;
      }

      console.log(`[DEBUG updateProfileStatus] Profile found, current status: ${profile.status}`);

      // Update profile status in ProfileManager
      await this.profileManager.updateProfile(profileId, { status });
      logger.info(`Updated profile ${profileId} status to: ${status}`);
      console.log(`[DEBUG updateProfileStatus] Profile status updated in DB`);

      // Broadcast status change via WebSocket
      console.log(`[DEBUG updateProfileStatus] broadcastStatus function exists: ${!!this.broadcastStatus}`);
      if (this.broadcastStatus) {
        const payload = {
          profileId,
          status,
          timestamp: new Date().toISOString()
        };
        console.log(`[DEBUG updateProfileStatus] Broadcasting payload:`, JSON.stringify(payload));
        this.broadcastStatus('profile_status_update', payload);
        logger.info(`Broadcasted status update for profile ${profileId}: ${status}`);
        console.log(`[DEBUG updateProfileStatus] Broadcast completed`);
      } else {
        console.error(`[DEBUG updateProfileStatus] broadcastStatus is NULL! Cannot broadcast!`);
      }
    } catch (error) {
      logger.error(`Failed to update profile ${profileId} status:`, error);
      console.error(`[DEBUG updateProfileStatus] ERROR:`, error);
    }
  }

  /**
   * Save logs to profile metadata for View Log UI
   * NEW: Saves execution history instead of overwriting
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

      // Create execution record
      const executionRecord = {
        taskId: task.id,
        status: task.status,
        timestamp: new Date().toISOString(),
        startedAt: task.startedAt?.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        duration: task.startedAt && task.completedAt
          ? task.completedAt.getTime() - task.startedAt.getTime()
          : 0,
        logs: task.logs || [],
        error: task.error,
        fullLog: fullLog
      };

      // Get existing execution history (or create new array)
      const executionHistory = profile.metadata?.executionHistory || [];

      // Add new execution to the BEGINNING of array (newest first)
      executionHistory.unshift(executionRecord);

      // Keep only last 20 executions to prevent file from getting too large
      const MAX_HISTORY = 20;
      if (executionHistory.length > MAX_HISTORY) {
        executionHistory.splice(MAX_HISTORY);
      }

      // Update profile with execution history
      await this.profileManager.updateProfile(task.profileId, {
        metadata: {
          ...profile.metadata,
          lastLog: fullLog, // Keep for backward compatibility
          lastExecution: {
            taskId: task.id,
            status: task.status,
            timestamp: executionRecord.timestamp,
            logs: task.logs
          },
          // NEW: Execution history array
          executionHistory: executionHistory
        }
      });

      logger.info(`Saved execution history to profile ${task.profileId} (${executionHistory.length} records)`);
    } catch (error) {
      logger.error('Failed to save logs to profile:', error);
    }
  }
}

export default DirectMobileScriptService;
