import type { Express } from "express";
import * as fs from "fs";
import * as path from "path";

import { type TaskCenterTask} from "../../shared/schema";
import { storage } from "../services/storage";
import { killChromeProcessesUsingProfile, openChromeWithProfile} from "../executions/execution";
import { getLog, getOutput, getOutputFile } from "../middlewares/logAndOuput";
import * as taskManager from "../middlewares/taskManager";
import * as utils from "../middlewares/utils";
import { LOCAL_PROFILE, TASKS_PROFILE } from "../config";

export function registerTaskRoutes(app: Express) {
  // Task routes - Fast endpoint that only reads from local storage
  app.get("/api/tasks", async (req, res) => {
    try {
      // Return tasks from storage without external API calls
      const tasks = await storage.getTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Failed to fetch tasks from storage:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Task execution route - creates temporary profile and runs script
  app.post("/api/tasks/:id/launch", async (req, res) => {
    try {
    const taskId = parseInt(req.params.id);      
    const { headless = false } = req.body; // Extract headless parameter from request body
    const task = await storage.getTask(taskId);    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check if task has profile/script data or local profile
    const profileData = task.profile as TaskCenterTask['profile'] | null;
    const localProfileId = profileData?.localProfileId ?? null;
    if ((!task.profile && !localProfileId ) || !task.script) {
      return res.status(400).json({ 
        message: "Task missing profile data or local profile",
        details: {          
          hasProfile: !!task.profile,
          hasScript: !!task.script,
          hasLocalProfile: !!localProfileId,
        }
      });
    }
    const result = await taskManager.runTaskById(taskId);

    if (result.status === "COMPLETED") {
      res.json({
        status: "success",
        message: `Task [${taskId}] Executed Completely`,
        execution: result,
      });
    } else {
      // Use the specific error message from runTaskById if available
      // console.log("Task execution failed:", result);
      const errorMessage = result.message || result.error || `Task [${taskId}] execution failed`;
      res.status(500).json({
        message: errorMessage,
        error: result.error,
        execution: result,
      });
    }

    } catch (error) {
      console.error("Task execution error:", error);
      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Task execution failed',
        execution: {
          status: 'error'
        }
      });
    }
  });  

  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const task = await storage.updateTask(id, updates);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteTask(id);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Fetch tasks from Task Center API and sync with storage
  app.post("/api/tasks/fetch-from-task-center", async (req, res) => {
    try {     
      const taskCenterTasks = await taskManager.loadAllTasksFromCenter();      
      res.json({ 
        message: "Successfully fetched and stored tasks from Task Center",
        stats: {
          total: taskCenterTasks?.length || 0,
        }
      });

    } catch (error) {
      console.error("Fetch from Task Center error:", error);
      res.status(500).json({ 
        message: "Failed to fetch from Task Center",
        error: (error as Error)?.message || 'Unknown error'
      });
    }
  });

  // Update task to Task Center
  // app.post('/api/tasks/update-to-task-center', async (req, res) => {
  //   try {
  //     const { taskId, status, response } = req.body;
      
  //     if (!process.env.TASK_CENTER_URL || !process.env.TASK_CENTER_API_KEY) {
  //       return res.status(400).json({ 
  //         message: 'Task Center configuration missing',
  //         details: {
  //           hasUrl: !!process.env.TASK_CENTER_URL,
  //           hasKey: !!process.env.TASK_CENTER_API_KEY
  //         }
  //       });
  //     }
      
  //     const updateUrl = `${process.env.TASK_CENTER_URL}/api/tasks/${taskId}/update`;
  //     const updateResponse = await fetch(updateUrl, {
  //       method: 'POST',
  //       headers: {
  //         'Authorization': `Bearer ${process.env.TASK_CENTER_API_KEY}`,
  //         'Content-Type': 'application/json'
  //       },
  //       body: JSON.stringify({
  //         status,
  //         response: typeof response === 'string' ? response : JSON.stringify(response)
  //       })
  //     });
      
  //     if (!updateResponse.ok) {
  //       throw new Error(`Task Center update failed with status ${updateResponse.status}`);
  //     }
      
  //     res.json({ message: 'Task updated successfully in Task Center' });
  //   } catch (error) {
  //     console.error('Error updating task to Task Center:', error);
  //     res.status(500).json({ 
  //       message: 'Failed to update task to Task Center',
  //       error: (error as Error).message
  //     });
  //   }
  // });

  // Get task log content
  app.get("/api/tasks/:id/log", (req, res) => getLog(req, res, true));

  // Get task output folder
  app.get("/api/tasks/:id/output", (req, res) => getOutput(req, res, true));

  // Serve task output files (images, etc.)
  app.get("/api/tasks/:id/output/:filename", (req, res) => getOutputFile(req, res, true));

  // Clear task data endpoint - removes profile folder
  app.post("/api/tasks/:id/clear", async (req, res) => {
    try {     
    } catch (error) {
      console.error(`[Task Clear] Error clearing task ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Failed to clear task data",
        error: (error as Error)?.message || 'Unknown error'
      });
    }
  });

  // Stop task execution
  app.post("/api/tasks/:id/stop", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
              
      // Terminate Chrome processes using this task's profile
      if(task.profileId){
        const profileDir = path.join(TASKS_PROFILE, task.profileId?.toString() || "", "chrome-profile");
        const killResult = await killChromeProcessesUsingProfile(profileDir);
        console.log(`[Task ${taskId}] Chrome processes terminated: ${killResult.message}`);
      }
         
      // Log stop action to script.log      
      try {
        const taskPath = await utils.getTaskPathFromTaskId(taskId);
        if(taskPath){
          const logPath = path.join(taskPath, "script.log");
          const timestamp = new Date().toISOString();
          const stopMessage = `\n=== Task Execution STOPPED ${timestamp} ===\nExecution was manually stopped by user.\nChrome processes terminated.\n=== End Stop Log ===\n`;

          await fs.promises.appendFile(logPath, stopMessage, "utf8");
          console.log(`[Task ${taskId}] Stop action logged to script.log`);
        }
      } catch (logError) {
        console.error(`[Task ${taskId}] Failed to log stop action:`, logError);
      }

      // Update status to storage and Task Center
      await storage.updateTask(taskId, { status: "FAILED" });
      await taskManager.updateTaskToTaskCenter(taskId, "FAILED", null);

      res.json({ message: "Task execution stopped" });
    } catch (error) {
      console.error("Stop task error:", error);
      res.status(500).json({ message: "Failed to stop task" });
    }
  });

  // Open browser with task profile
  app.post("/api/tasks/:id/open-browser", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const profileData = task.profile as TaskCenterTask['profile'] | null;
      
      // Check if task has a local profile ID
      
      console.log(`Task profile: ${JSON.stringify(profileData)}`);
      if (await utils.isLocalProfile(taskId)) {
        const localProfileId = profileData?.localProfileId || 0;
        // Use local profile folder when localProfileId is available
        const profileDir = path.join(LOCAL_PROFILE, localProfileId.toString(), "chrome-profile");
        console.log(`Opening browser with local profile ID: ${localProfileId} for task ${taskId}`);
        
        // Get the local profile data to merge with task profile settings
        const localProfile = await storage.getProfile(localProfileId);
        const mergedProfile = localProfile ? { ...profileData, ...localProfile } : profileData;
        
        await openChromeWithProfile(profileDir, mergedProfile);
        res.json({ 
          message: "Browser opened with local profile",
          profileId: localProfileId,
          taskId: taskId
        });
      } else if (task.profile) {
        // Use task-specific profile folder if no local profile
        const taskProfileDir = path.join(TASKS_PROFILE, task.profileId?.toString() || taskId.toString(), "chrome-profile");
        console.log(`Opening browser with task profile for task ${taskId}`);
        
        await openChromeWithProfile(taskProfileDir, task.profile);
        res.json({ 
          message: "Browser opened with task profile",
          taskId: taskId
        });
      } else {
        return res.status(400).json({ message: "Task has no profile configuration" });
      }
    } catch (error) {
      console.error("Open browser error:", error);
      res.status(500).json({ 
        message: "Failed to open browser",
        error: (error as Error)?.message || 'Unknown error'
      });
    }
  });

}