/**
 * Mobile Script Runner
 * Executes mobile scripts with TwitterAppManager for maximum speed
 *
 * Replaces browser-based script runner with mobile app automation
 */

import TwitterAppManager from '../../services/TwitterAppManager.js';
import { MobileProfile } from '../../services/ProfileManager.js';
import { logger } from '../../utils/logger.js';
import * as twitterAction from './twitterAction.js';
import * as twitterReading from './twitterReading.js';
import * as twitterInteracting from './twitterInteracting.js';

export interface MobileScriptConfig {
  profileId?: string;
  profile: MobileProfile;
  taskPath: string;
  taskId: string;
  type: string;
  task: {
    request: any;
  };
}

export interface ScriptExecutionResult {
  success: boolean;
  scriptType: string;
  result?: any;
  error?: string;
  executionTime: number;
  appWasRunning: boolean; // Key metric - was Twitter app already running?
}

export class MobileScriptRunner {
  private twitterAppManager: TwitterAppManager;

  constructor(twitterAppManager: TwitterAppManager) {
    this.twitterAppManager = twitterAppManager;
  }

  /**
   * Execute Twitter action script (post/reply)
   * ⚡ Super fast because Twitter app stays running
   */
  async executeTwitterAction(config: MobileScriptConfig): Promise<ScriptExecutionResult> {
    const startTime = Date.now();
    const appWasRunning = this.twitterAppManager.hasActiveSession(config.profile.id);

    try {
      logger.info(`[MobileScriptRunner] Executing Twitter action for ${config.profile.name}`);
      logger.info(`[MobileScriptRunner] App already running: ${appWasRunning ? 'YES ⚡' : 'NO (first run)'}`);

      const result = await this.twitterAppManager.executeWithSession(
        config.profile,
        async (twitter) => {
          return await twitterAction.execute(twitter, config);
        }
      );

      const executionTime = Date.now() - startTime;
      logger.info(`[MobileScriptRunner] Twitter action completed in ${executionTime}ms`);

      return {
        success: true,
        scriptType: 'twitterAction',
        result,
        executionTime,
        appWasRunning
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('[MobileScriptRunner] Twitter action failed:', error);

      return {
        success: false,
        scriptType: 'twitterAction',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        appWasRunning
      };
    }
  }

  /**
   * Execute Twitter reading script (timeline/profile browsing)
   */
  async executeTwitterReading(config: MobileScriptConfig): Promise<ScriptExecutionResult> {
    const startTime = Date.now();
    const appWasRunning = this.twitterAppManager.hasActiveSession(config.profile.id);

    try {
      logger.info(`[MobileScriptRunner] Executing Twitter reading for ${config.profile.name}`);
      logger.info(`[MobileScriptRunner] App already running: ${appWasRunning ? 'YES ⚡' : 'NO (first run)'}`);

      const result = await this.twitterAppManager.executeWithSession(
        config.profile,
        async (twitter) => {
          return await twitterReading.execute(twitter, config);
        }
      );

      const executionTime = Date.now() - startTime;
      logger.info(`[MobileScriptRunner] Twitter reading completed in ${executionTime}ms`);

      return {
        success: result.success,
        scriptType: 'twitterReading',
        result,
        executionTime,
        appWasRunning
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('[MobileScriptRunner] Twitter reading failed:', error);

      return {
        success: false,
        scriptType: 'twitterReading',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        appWasRunning
      };
    }
  }

  /**
   * Execute Twitter interacting script (like/retweet/comment)
   */
  async executeTwitterInteracting(config: MobileScriptConfig): Promise<ScriptExecutionResult> {
    const startTime = Date.now();
    const appWasRunning = this.twitterAppManager.hasActiveSession(config.profile.id);

    try {
      logger.info(`[MobileScriptRunner] Executing Twitter interacting for ${config.profile.name}`);
      logger.info(`[MobileScriptRunner] App already running: ${appWasRunning ? 'YES ⚡' : 'NO (first run)'}`);

      const result = await this.twitterAppManager.executeWithSession(
        config.profile,
        async (twitter) => {
          return await twitterInteracting.execute(twitter, config);
        }
      );

      const executionTime = Date.now() - startTime;
      logger.info(`[MobileScriptRunner] Twitter interacting completed in ${executionTime}ms`);

      return {
        success: result.success,
        scriptType: 'twitterInteracting',
        result,
        executionTime,
        appWasRunning
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('[MobileScriptRunner] Twitter interacting failed:', error);

      return {
        success: false,
        scriptType: 'twitterInteracting',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        appWasRunning
      };
    }
  }

  /**
   * Execute multiple scripts in batch (fastest way)
   * Twitter app stays open between all executions
   */
  async executeBatch(
    profile: MobileProfile,
    configs: MobileScriptConfig[]
  ): Promise<ScriptExecutionResult[]> {
    const results: ScriptExecutionResult[] = [];
    const batchStartTime = Date.now();

    logger.info(`[MobileScriptRunner] Starting batch execution: ${configs.length} scripts`);

    for (const config of configs) {
      let result: ScriptExecutionResult;

      // Route to appropriate script based on type
      switch (config.type) {
        case 'twitterAction':
          result = await this.executeTwitterAction(config);
          break;
        case 'twitterReading':
          result = await this.executeTwitterReading(config);
          break;
        case 'twitterInteracting':
          result = await this.executeTwitterInteracting(config);
          break;
        default:
          result = {
            success: false,
            scriptType: config.type,
            error: `Unknown script type: ${config.type}`,
            executionTime: 0,
            appWasRunning: false
          };
      }

      results.push(result);

      // Small delay between scripts
      await delay(1000, 2000);
    }

    const totalTime = Date.now() - batchStartTime;
    const successCount = results.filter(r => r.success).length;

    logger.info(`[MobileScriptRunner] Batch completed: ${successCount}/${configs.length} successful in ${totalTime}ms`);

    return results;
  }

  /**
   * Get statistics about app sessions
   */
  getSessionStats(): {
    activeSessions: number;
    profiles: string[];
  } {
    return {
      activeSessions: this.twitterAppManager.getActiveSessionsCount(),
      profiles: [] // Would need to add method to get profile list from manager
    };
  }
}

async function delay(min: number, max: number): Promise<void> {
  const delayMs = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

export default MobileScriptRunner;