/**
 * Simple In-Memory Task Queue
 * For production, replace with Redis/Bull/RabbitMQ
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface Task {
  id: string;
  profileId: number;
  type: 'script' | 'command';
  payload: any;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: any;
}

class TaskQueue extends EventEmitter {
  private static instance: TaskQueue;
  private queues: Map<number, Task[]> = new Map(); // profileId -> tasks
  private processing: Set<string> = new Set(); // task IDs being processed

  private constructor() {
    super();
    logger.info('[TaskQueue] Initialized');
  }

  static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }
    return TaskQueue.instance;
  }

  /**
   * Add a task to the queue
   */
  addTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Task {
    const fullTask: Task = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: new Date(),
      status: 'pending',
    };

    // Get or create queue for this profile
    if (!this.queues.has(task.profileId)) {
      this.queues.set(task.profileId, []);
    }

    const queue = this.queues.get(task.profileId)!;
    queue.push(fullTask);

    logger.info(`[TaskQueue] Task added: ${fullTask.id} for profile ${task.profileId}`);
    this.emit('task:added', fullTask);

    return fullTask;
  }

  /**
   * Get next pending task for a profile
   */
  getNextTask(profileId: number): Task | null {
    const queue = this.queues.get(profileId);
    if (!queue) {
      return null;
    }

    // Find first pending task
    const task = queue.find((t) => t.status === 'pending' && !this.processing.has(t.id));

    if (task) {
      task.status = 'processing';
      this.processing.add(task.id);
      logger.info(`[TaskQueue] Task ${task.id} started processing`);
      this.emit('task:processing', task);
    }

    return task || null;
  }

  /**
   * Mark task as completed
   */
  completeTask(taskId: string, result?: any): void {
    const task = this.findTask(taskId);
    if (!task) {
      logger.warn(`[TaskQueue] Task ${taskId} not found`);
      return;
    }

    task.status = 'completed';
    task.result = result;
    this.processing.delete(taskId);

    logger.info(`[TaskQueue] Task ${taskId} completed`);
    this.emit('task:completed', task);
  }

  /**
   * Mark task as failed
   */
  failTask(taskId: string, error: any): void {
    const task = this.findTask(taskId);
    if (!task) {
      logger.warn(`[TaskQueue] Task ${taskId} not found`);
      return;
    }

    task.status = 'failed';
    task.error = error;
    this.processing.delete(taskId);

    logger.error(`[TaskQueue] Task ${taskId} failed:`, error);
    this.emit('task:failed', task);
  }

  /**
   * Find a task by ID
   */
  private findTask(taskId: string): Task | undefined {
    for (const queue of this.queues.values()) {
      const task = queue.find((t) => t.id === taskId);
      if (task) {
        return task;
      }
    }
    return undefined;
  }

  /**
   * Get all tasks for a profile
   */
  getTasks(profileId: number): Task[] {
    return this.queues.get(profileId) || [];
  }

  /**
   * Get queue size for a profile
   */
  getQueueSize(profileId: number): number {
    const queue = this.queues.get(profileId);
    if (!queue) {
      return 0;
    }
    return queue.filter((t) => t.status === 'pending').length;
  }

  /**
   * Clear completed/failed tasks older than X minutes
   */
  cleanup(olderThanMinutes: number = 60): void {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    let cleaned = 0;

    for (const [profileId, queue] of this.queues.entries()) {
      const before = queue.length;
      const filtered = queue.filter((task) => {
        if (task.status === 'pending' || task.status === 'processing') {
          return true; // Keep pending/processing tasks
        }
        return task.createdAt > cutoffTime; // Keep recent completed/failed tasks
      });

      this.queues.set(profileId, filtered);
      cleaned += before - filtered.length;
    }

    if (cleaned > 0) {
      logger.info(`[TaskQueue] Cleaned up ${cleaned} old tasks`);
    }
  }

  /**
   * Get overall queue statistics
   */
  getStats(): any {
    let totalTasks = 0;
    let pendingTasks = 0;
    let processingTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    for (const queue of this.queues.values()) {
      totalTasks += queue.length;
      pendingTasks += queue.filter((t) => t.status === 'pending').length;
      processingTasks += queue.filter((t) => t.status === 'processing').length;
      completedTasks += queue.filter((t) => t.status === 'completed').length;
      failedTasks += queue.filter((t) => t.status === 'failed').length;
    }

    return {
      totalProfiles: this.queues.size,
      totalTasks,
      pendingTasks,
      processingTasks,
      completedTasks,
      failedTasks,
    };
  }
}

export default TaskQueue;
