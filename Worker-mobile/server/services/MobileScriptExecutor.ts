import LDPlayerController from '../core/LDPlayerController.js';
import ProfileManager, { MobileProfile } from './ProfileManager.js';
import TwitterMobileAutomation from '../automation/TwitterMobileAutomation.js';
import { logger } from '../utils/logger.js';

export interface ScriptTask {
  id: string;
  profileId: string;
  scriptType: 'twitter' | 'instagram' | 'tiktok' | 'custom';
  scriptName: string;
  scriptData: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Mobile Script Executor - Execute scripts on LDPlayer instances
 * Similar to browser script execution but for mobile
 */
export class MobileScriptExecutor {
  private controller: LDPlayerController;
  private profileManager: ProfileManager;
  private runningScripts: Map<string, Promise<any>> = new Map();
  private scriptQueue: ScriptTask[] = [];

  constructor(controller: LDPlayerController, profileManager: ProfileManager) {
    this.controller = controller;
    this.profileManager = profileManager;
  }

  /**
   * Execute a script on a mobile profile (similar to browser profile script execution)
   */
  async executeScript(task: ScriptTask): Promise<any> {
    const profile = this.profileManager.getProfile(task.profileId);
    if (!profile) {
      throw new Error(`Profile ${task.profileId} not found`);
    }

    // Activate profile if not active
    if (profile.status !== 'active') {
      logger.info(`Activating profile ${profile.name} for script execution`);
      await this.profileManager.activateProfile(profile.id);
    }

    // Execute script based on type
    switch (task.scriptType) {
      case 'twitter':
        return await this.executeTwitterScript(profile, task);

      case 'instagram':
        return await this.executeInstagramScript(profile, task);

      case 'tiktok':
        return await this.executeTikTokScript(profile, task);

      case 'custom':
        return await this.executeCustomScript(profile, task);

      default:
        throw new Error(`Unknown script type: ${task.scriptType}`);
    }
  }

  /**
   * Execute Twitter automation script (từ browser scripts)
   */
  private async executeTwitterScript(profile: MobileProfile, task: ScriptTask): Promise<any> {
    const twitter = new TwitterMobileAutomation(this.controller, profile.instanceName, profile.port);

    const { scriptName, scriptData } = task;

    switch (scriptName) {
      // Reading scripts
      case 'readTimeline':
        await twitter.launchTwitter();
        await twitter.scrollTimeline(scriptData.count || 10);
        return { tweetsRead: scriptData.count || 10 };

      case 'readNotifications':
        await twitter.launchTwitter();
        // Navigate to notifications tab (TODO: implement goToNotifications)
        await twitter.scrollTimeline(scriptData.count || 10);
        return { notificationsRead: scriptData.count || 10 };

      case 'searchAndRead':
        await twitter.launchTwitter();
        await twitter.search(scriptData.query);
        await twitter.scrollTimeline(scriptData.count || 10);
        return { query: scriptData.query, tweetsRead: scriptData.count || 10 };

      // Caring/Interacting scripts
      case 'likeTweets':
        await twitter.launchTwitter();
        if (scriptData.searchQuery) {
          await twitter.search(scriptData.searchQuery);
        }
        const liked = await twitter.likeRandomTweets(scriptData.count || 5);
        return { liked };

      case 'followUser':
        await twitter.launchTwitter();
        await twitter.followUser(scriptData.username);
        return { followed: scriptData.username };

      case 'retweet':
        await twitter.launchTwitter();
        if (scriptData.searchQuery) {
          await twitter.search(scriptData.searchQuery);
        }
        await twitter.retweet(scriptData.y || 400, scriptData.comment || '');
        return { retweeted: true };

      case 'commentOnTweet':
        await twitter.launchTwitter();
        if (scriptData.searchQuery) {
          await twitter.search(scriptData.searchQuery);
        }
        await twitter.commentOnTweet(scriptData.y || 400, scriptData.comment);
        return { commented: true };

      // Action scripts
      case 'postTweet':
        await twitter.launchTwitter();
        await twitter.postTweet(scriptData.text);
        return { posted: true, text: scriptData.text };

      case 'sendDM':
        await twitter.launchTwitter();
        // TODO: Implement DM sending
        throw new Error('DM sending not implemented yet');

      default:
        throw new Error(`Unknown Twitter script: ${scriptName}`);
    }
  }

  /**
   * Execute Instagram automation script
   */
  private async executeInstagramScript(profile: MobileProfile, task: ScriptTask): Promise<any> {
    // TODO: Implement Instagram automation
    throw new Error('Instagram automation not implemented yet');
  }

  /**
   * Execute TikTok automation script
   */
  private async executeTikTokScript(profile: MobileProfile, task: ScriptTask): Promise<any> {
    // TODO: Implement TikTok automation
    throw new Error('TikTok automation not implemented yet');
  }

  /**
   * Execute custom script
   */
  private async executeCustomScript(profile: MobileProfile, task: ScriptTask): Promise<any> {
    const { scriptData } = task;

    // Allow custom ADB commands
    if (scriptData.adbCommands) {
      const results = [];
      for (const cmd of scriptData.adbCommands) {
        switch (cmd.type) {
          case 'tap':
            await this.controller.tap(profile.port, cmd.x, cmd.y);
            results.push({ type: 'tap', x: cmd.x, y: cmd.y });
            break;

          case 'swipe':
            await this.controller.swipe(
              profile.port,
              cmd.x1, cmd.y1, cmd.x2, cmd.y2,
              cmd.duration || 500
            );
            results.push({ type: 'swipe', from: [cmd.x1, cmd.y1], to: [cmd.x2, cmd.y2] });
            break;

          case 'input':
            await this.controller.inputText(profile.port, cmd.text);
            results.push({ type: 'input', text: cmd.text });
            break;

          case 'screenshot':
            await this.controller.screenshot(profile.port, cmd.path);
            results.push({ type: 'screenshot', path: cmd.path });
            break;

          case 'wait':
            await new Promise(resolve => setTimeout(resolve, cmd.duration || 1000));
            results.push({ type: 'wait', duration: cmd.duration });
            break;
        }
      }
      return { executed: results };
    }

    throw new Error('No custom script logic provided');
  }

  /**
   * Add script to queue
   */
  async queueScript(task: Omit<ScriptTask, 'id' | 'status'>): Promise<ScriptTask> {
    const scriptTask: ScriptTask = {
      ...task,
      id: this.generateTaskId(),
      status: 'pending'
    };

    this.scriptQueue.push(scriptTask);
    logger.info(`Script queued: ${scriptTask.scriptType}/${scriptTask.scriptName} for profile ${task.profileId}`);

    // Start execution
    this.processQueue();

    return scriptTask;
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
          logger.info(`Script completed: ${task.scriptType}/${task.scriptName}`);
        })
        .catch(error => {
          task.status = 'failed';
          task.error = error.message;
          task.completedAt = new Date();
          logger.error(`Script failed: ${task.scriptType}/${task.scriptName}`, error);
        })
        .finally(() => {
          this.runningScripts.delete(task.id);
        });

      this.runningScripts.set(task.id, execution);
    }
  }

  /**
   * Get script task status
   */
  getTask(taskId: string): ScriptTask | undefined {
    return this.scriptQueue.find(t => t.id === taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ScriptTask[] {
    return this.scriptQueue;
  }

  /**
   * Clear completed tasks
   */
  clearCompletedTasks() {
    this.scriptQueue = this.scriptQueue.filter(
      t => t.status !== 'completed' && t.status !== 'failed'
    );
  }

  private generateTaskId(): string {
    return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default MobileScriptExecutor;
