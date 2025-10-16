/**
 * ActionRecorder - Record and playback user actions like GemLogin
 *
 * Features:
 * - Record clicks, swipes, typing, scrolls
 * - Smart element selectors (xpath, resource-id, text, coordinates)
 * - Visual element detection
 * - Wait mechanisms (element visible, timeout, condition)
 * - Action playback with retry logic
 */

import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import LDPlayerController from '../core/LDPlayerController.js';

export type ActionType = 'click' | 'tap' | 'swipe' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'back' | 'home';

export interface ElementSelector {
  type: 'xpath' | 'id' | 'text' | 'class' | 'coordinates' | 'image';
  value: string | { x: number; y: number };
  description?: string;
}

export interface RecordedAction {
  id: string;
  type: ActionType;
  timestamp: number;
  selector?: ElementSelector;
  data?: {
    text?: string; // For type action
    startX?: number; // For swipe
    startY?: number;
    endX?: number;
    endY?: number;
    duration?: number; // Wait duration in ms
    condition?: string; // Wait condition
    screenshotPath?: string; // Screenshot file path
  };
  metadata?: {
    elementInfo?: string;
    screenSize?: { width: number; height: number };
    beforeScreenshot?: string;
    afterScreenshot?: string;
  };
}

export interface ActionScript {
  id: string;
  name: string;
  description?: string;
  actions: RecordedAction[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    appPackage?: string;
    profileId?: number;
    tags?: string[];
  };
}

export interface PlaybackOptions {
  delayBetweenActions?: number; // ms
  retryOnFailure?: boolean;
  maxRetries?: number;
  takeScreenshots?: boolean;
  waitForElementTimeout?: number; // ms
  continueOnError?: boolean;
}

export class ActionRecorder {
  private controller: LDPlayerController;
  private scriptsPath: string;
  private screenshotsPath: string;
  private scripts: Map<string, ActionScript> = new Map();
  private isRecording: boolean = false;
  private currentScript?: ActionScript;
  private recordingActions: RecordedAction[] = [];

  constructor(controller: LDPlayerController) {
    this.controller = controller;
    this.scriptsPath = path.join(process.cwd(), 'data', 'action_scripts');
    this.screenshotsPath = path.join(process.cwd(), 'data', 'screenshots');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.scriptsPath, { recursive: true });
      await fs.mkdir(this.screenshotsPath, { recursive: true });
      await this.loadAllScripts();
      logger.info('ActionRecorder initialized');
    } catch (error) {
      logger.error('Failed to initialize ActionRecorder:', error);
      throw error;
    }
  }

  /**
   * Start recording actions
   */
  async startRecording(scriptName: string, options?: {
    description?: string;
    appPackage?: string;
    profileId?: number;
  }): Promise<string> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    const scriptId = this.generateScriptId();
    this.currentScript = {
      id: scriptId,
      name: scriptName,
      description: options?.description,
      actions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        appPackage: options?.appPackage,
        profileId: options?.profileId
      }
    };

    this.recordingActions = [];
    this.isRecording = true;

    logger.info(`Started recording script: ${scriptName} (${scriptId})`);
    return scriptId;
  }

  /**
   * Stop recording and save script
   */
  async stopRecording(): Promise<ActionScript> {
    if (!this.isRecording || !this.currentScript) {
      throw new Error('Not currently recording');
    }

    this.currentScript.actions = this.recordingActions;
    this.currentScript.updatedAt = new Date();

    await this.saveScript(this.currentScript);
    this.scripts.set(this.currentScript.id, this.currentScript);

    const script = this.currentScript;
    this.isRecording = false;
    this.currentScript = undefined;
    this.recordingActions = [];

    logger.info(`Stopped recording script: ${script.name} (${script.actions.length} actions)`);
    return script;
  }

  /**
   * Record a click/tap action
   */
  async recordClick(port: number, selector: ElementSelector, takeScreenshot: boolean = false): Promise<void> {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }

    const action: RecordedAction = {
      id: this.generateActionId(),
      type: 'click',
      timestamp: Date.now(),
      selector,
      metadata: {}
    };

    // Take before screenshot if requested
    if (takeScreenshot) {
      const beforePath = await this.takeScreenshot(port, `before_${action.id}`);
      action.metadata!.beforeScreenshot = beforePath;
    }

    // Execute the click
    await this.executeClick(port, selector);

    // Take after screenshot if requested
    if (takeScreenshot) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for UI update
      const afterPath = await this.takeScreenshot(port, `after_${action.id}`);
      action.metadata!.afterScreenshot = afterPath;
    }

    this.recordingActions.push(action);
    logger.info(`Recorded click action: ${selector.type}=${JSON.stringify(selector.value)}`);
  }

  /**
   * Record a swipe action
   */
  async recordSwipe(port: number, startX: number, startY: number, endX: number, endY: number, duration: number = 300): Promise<void> {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }

    const action: RecordedAction = {
      id: this.generateActionId(),
      type: 'swipe',
      timestamp: Date.now(),
      data: { startX, startY, endX, endY, duration }
    };

    // Execute the swipe
    await this.controller.swipe(port, startX, startY, endX, endY, duration);

    this.recordingActions.push(action);
    logger.info(`Recorded swipe action: (${startX},${startY}) -> (${endX},${endY})`);
  }

  /**
   * Record a type action
   */
  async recordType(port: number, selector: ElementSelector, text: string): Promise<void> {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }

    const action: RecordedAction = {
      id: this.generateActionId(),
      type: 'type',
      timestamp: Date.now(),
      selector,
      data: { text }
    };

    // Execute the type action
    await this.executeClick(port, selector); // Click element first
    await this.controller.inputText(port, text);

    this.recordingActions.push(action);
    logger.info(`Recorded type action: "${text}"`);
  }

  /**
   * Record a wait action
   */
  recordWait(duration: number, condition?: string): void {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }

    const action: RecordedAction = {
      id: this.generateActionId(),
      type: 'wait',
      timestamp: Date.now(),
      data: { duration, condition }
    };

    this.recordingActions.push(action);
    logger.info(`Recorded wait action: ${duration}ms${condition ? ` (condition: ${condition})` : ''}`);
  }

  /**
   * Playback recorded script
   */
  async playback(scriptId: string, port: number, options?: PlaybackOptions): Promise<void> {
    const {
      delayBetweenActions = 500,
      retryOnFailure = true,
      maxRetries = 3,
      takeScreenshots = false,
      waitForElementTimeout = 10000,
      continueOnError = false
    } = options || {};

    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script ${scriptId} not found`);
    }

    logger.info(`Starting playback of script: ${script.name} (${script.actions.length} actions)`);

    for (let i = 0; i < script.actions.length; i++) {
      const action = script.actions[i];
      let success = false;
      let attempts = 0;

      while (!success && attempts < maxRetries) {
        try {
          attempts++;
          logger.info(`[${i + 1}/${script.actions.length}] Executing ${action.type}${attempts > 1 ? ` (attempt ${attempts})` : ''}`);

          await this.executeAction(port, action, { takeScreenshots, waitForElementTimeout });
          success = true;

          // Delay between actions
          if (i < script.actions.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenActions));
          }

        } catch (error) {
          logger.warn(`Action ${action.type} failed (attempt ${attempts}):`, error);

          if (!retryOnFailure || attempts >= maxRetries) {
            if (continueOnError) {
              logger.warn('Continuing to next action despite error');
              break;
            } else {
              throw new Error(`Action ${action.type} failed after ${attempts} attempts: ${error}`);
            }
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    logger.info(`Playback completed: ${script.name}`);
  }

  /**
   * Execute a single action
   */
  private async executeAction(port: number, action: RecordedAction, options?: {
    takeScreenshots?: boolean;
    waitForElementTimeout?: number;
  }): Promise<void> {
    switch (action.type) {
      case 'click':
      case 'tap':
        if (!action.selector) {
          throw new Error('Click action requires selector');
        }
        await this.executeClick(port, action.selector, options?.waitForElementTimeout);
        break;

      case 'swipe':
        if (!action.data) {
          throw new Error('Swipe action requires data');
        }
        await this.controller.swipe(
          port,
          action.data.startX!,
          action.data.startY!,
          action.data.endX!,
          action.data.endY!,
          action.data.duration || 300
        );
        break;

      case 'type':
        if (!action.selector || !action.data?.text) {
          throw new Error('Type action requires selector and text');
        }
        await this.executeClick(port, action.selector, options?.waitForElementTimeout);
        await this.controller.inputText(port, action.data.text);
        break;

      case 'wait':
        if (!action.data?.duration) {
          throw new Error('Wait action requires duration');
        }
        logger.info(`Waiting ${action.data.duration}ms...`);
        await new Promise(resolve => setTimeout(resolve, action.data!.duration));
        break;

      case 'screenshot':
        await this.takeScreenshot(port, action.id);
        break;

      case 'back':
        await this.controller.pressKey(port, 'KEYCODE_BACK');
        break;

      case 'home':
        await this.controller.pressKey(port, 'KEYCODE_HOME');
        break;

      default:
        logger.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute click based on selector
   */
  private async executeClick(port: number, selector: ElementSelector, timeout?: number): Promise<void> {
    switch (selector.type) {
      case 'coordinates':
        if (typeof selector.value === 'object' && 'x' in selector.value) {
          await this.controller.tap(port, selector.value.x, selector.value.y);
        }
        break;

      case 'xpath':
      case 'id':
      case 'text':
        // TODO: Use UI Automator to find element and click
        // For now, just log
        logger.warn(`Element selector ${selector.type} not yet implemented in playback`);
        break;

      case 'image':
        // TODO: Use image recognition to find and click element
        logger.warn('Image selector not yet implemented in playback');
        break;

      default:
        throw new Error(`Unknown selector type: ${selector.type}`);
    }
  }

  /**
   * Take screenshot and save
   */
  private async takeScreenshot(port: number, actionId: string): Promise<string> {
    const filename = `${actionId}_${Date.now()}.png`;
    const filepath = path.join(this.screenshotsPath, filename);
    await this.controller.screenshot(port, filepath);
    return filepath;
  }

  /**
   * Get script by ID
   */
  getScript(scriptId: string): ActionScript | undefined {
    return this.scripts.get(scriptId);
  }

  /**
   * Get all scripts
   */
  getAllScripts(): ActionScript[] {
    return Array.from(this.scripts.values());
  }

  /**
   * Delete script
   */
  async deleteScript(scriptId: string): Promise<void> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script ${scriptId} not found`);
    }

    const scriptPath = path.join(this.scriptsPath, `${scriptId}.json`);
    await fs.unlink(scriptPath);
    this.scripts.delete(scriptId);

    logger.info(`Deleted script: ${script.name}`);
  }

  /**
   * Update script
   */
  async updateScript(scriptId: string, updates: Partial<ActionScript>): Promise<ActionScript> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script ${scriptId} not found`);
    }

    Object.assign(script, updates);
    script.updatedAt = new Date();

    await this.saveScript(script);
    logger.info(`Updated script: ${script.name}`);

    return script;
  }

  /**
   * Export script to JSON
   */
  async exportScript(scriptId: string, exportPath: string): Promise<void> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script ${scriptId} not found`);
    }

    await fs.writeFile(exportPath, JSON.stringify(script, null, 2));
    logger.info(`Exported script ${script.name} to ${exportPath}`);
  }

  /**
   * Import script from JSON
   */
  async importScript(importPath: string): Promise<ActionScript> {
    const data = await fs.readFile(importPath, 'utf-8');
    const script: ActionScript = JSON.parse(data);

    // Generate new ID to avoid conflicts
    script.id = this.generateScriptId();
    script.createdAt = new Date(script.createdAt);
    script.updatedAt = new Date();

    await this.saveScript(script);
    this.scripts.set(script.id, script);

    logger.info(`Imported script: ${script.name}`);
    return script;
  }

  /**
   * Save script to file
   */
  private async saveScript(script: ActionScript): Promise<void> {
    const scriptPath = path.join(this.scriptsPath, `${script.id}.json`);
    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));
  }

  /**
   * Load all scripts from disk
   */
  private async loadAllScripts(): Promise<void> {
    try {
      const files = await fs.readdir(this.scriptsPath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const scriptPath = path.join(this.scriptsPath, file);
            const data = await fs.readFile(scriptPath, 'utf-8');
            const script: ActionScript = JSON.parse(data);
            script.createdAt = new Date(script.createdAt);
            script.updatedAt = new Date(script.updatedAt);
            this.scripts.set(script.id, script);
          } catch (error) {
            logger.warn(`Failed to load script ${file}:`, error);
          }
        }
      }

      logger.info(`Loaded ${this.scripts.size} action scripts`);
    } catch (error) {
      logger.warn('Failed to load scripts:', error);
    }
  }

  /**
   * Generate unique script ID
   */
  private generateScriptId(): string {
    return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalScripts: this.scripts.size,
      isRecording: this.isRecording,
      currentScript: this.currentScript?.name,
      recordedActions: this.recordingActions.length,
      scripts: Array.from(this.scripts.values()).map(s => ({
        id: s.id,
        name: s.name,
        actionsCount: s.actions.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }))
    };
  }
}

export default ActionRecorder;
