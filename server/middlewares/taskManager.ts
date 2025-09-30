import * as fs from "fs";
import * as path from "path";
import { Task, TaskCenterTask } from "../../shared/schema";
import { storage } from "../services/storage";
import { ExecutionConfig, ExecutionResult } from "../executions/executionTypes";
import { executeScript } from "../executions/execution";
import * as config from "../config"
import * as utils from "./utils";
import { Profile } from "../../shared/schema";

// Initialize tasks from Task Center at startup
export async function initializeTasks() {
  try {    
    console.log("Initializing tasks from Task Center...");
    await loadAllTasksFromCenter();            
  } catch (error) {
    console.error("Failed to initialize tasks from Task Center:", error);
  }
}

export async function loadAllTasksFromCenter() {
  if (process.env.TASK_CENTER_URL) {
    try {
      const apiKey = process.env.TASK_CENTER_API_KEY;
      if (!apiKey) {
        return;
      }
      const updateUrl = `${process.env.TASK_CENTER_URL}/api/users/${process.env.TASK_CENTER_USER_ID}/tasks`;
      const response = await fetch(updateUrl, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        console.log(`Failed to fetch task from Task Center`);
        return null;
      }

      const taskCenterTasks = await response.json();
      let syncedCount = 0;
      let newCount = 0;

      // Get all local profiles to match by name
      const localProfiles = await storage.getProfiles();

      // Track which profiles have already been updated to avoid duplicates
      const updatedProfiles = new Set<number>();

      if (taskCenterTasks && taskCenterTasks.length > 0) {
        // Sync loaded tasks with in-memory storage
        for (const task of taskCenterTasks) {
          // If task has a profile, try to find matching local profile by name
          if (task.profile.localWorkerId == process.env.TASK_CENTER_USER_ID) {
            // Only update profile if we haven't already updated it
            if (!updatedProfiles.has(task.profile.id)) {
              const matchingLocalProfile = localProfiles.find(
                (localProfile: Profile) => localProfile.name === task.profile.name
              );

              if (matchingLocalProfile) {
                if(Number(task.profile.localProfileId) != Number(matchingLocalProfile.id)){
                  // Set the localProfileId to the matching local profile's ID
                  task.profile.localProfileId = matchingLocalProfile.id;
                  await updateProfileToTaskCenter(task.profile.id, matchingLocalProfile.id);
                  console.log(`Matched profile "${task.profile.name}" with local profile ID: ${matchingLocalProfile.id}`);
                  updatedProfiles.add(task.profile.id);
                }
              }else{
                if(task.profile.localProfileId != -1){
                  await updateProfileToTaskCenter(task.profile.id, -1);
                  console.log(`Profile "${task.profile.name}" not found in local storage`);
                  updatedProfiles.add(task.profile.id);
                }
              }
            } else {
              // Profile already processed, just update the local task data
              const matchingLocalProfile = localProfiles.find(
                (localProfile: Profile) => localProfile.name === task.profile.name
              );
              if (matchingLocalProfile) {
                task.profile.localProfileId = matchingLocalProfile.id;
              }
            }
          }
          
          const existingTask = await storage.getTask(task.id);
          if (!existingTask) {
            // Task exists in Task Center but not in memory, add it to storage
            await storage.createTask(task as any);
            newCount++;
            // console.log(`Added new task ${task.id} from Task Center`);
          } else {
            // Update existing task with latest data from Task Center
            await storage.updateTask(task.id, task as any);
            syncedCount++;
            // console.log(`Updated task ${task.id} from Task Center`);
          }
        }
      }

      const tasks = await storage.getTasks();
      tasks.sort((a: any, b: any) => a.id - b.id);
      // console.log("Tasks loaded from Task Center:", tasks.length);
      return tasks;
    } catch (error) {
      console.log(`Failed to fetch task from Task Center`);
      return null;
    }
  }
}

export async function updateTaskToTaskCenter(id: number, status: string, response: any) {  
  if (process.env.TASK_CENTER_URL) {
    try {
      const apiKey = process.env.TASK_CENTER_API_KEY;
      const userId = process.env.TASK_CENTER_USER_ID;
      if (!apiKey) {
        return;
      }      
      const updateUrl = `${process.env.TASK_CENTER_URL}/api/users/${userId}/tasks/${id}`;
      console.log("Updating task to center.....", updateUrl)
      const updateResult = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: status,
          response: response
        }),
      });
      if (!updateResult.ok) {
        throw new Error(`Failed to update task in Task Center: ${updateResult.status}`);
      }
    } catch (error) {
      console.error(`[Task ${id}] Failed to update Task Center:`, error);
    }
  }
}


export async function updateProfileToTaskCenter(id: number, localProfileId: number) {  
  if (process.env.TASK_CENTER_URL) {
    try {
      const apiKey = process.env.TASK_CENTER_API_KEY;
      const userId = process.env.TASK_CENTER_USER_ID;
      if (!apiKey) {
        return;
      }      
      const updateUrl = `${process.env.TASK_CENTER_URL}/api/users/${userId}/profiles/${id}`;
      console.log("Updating profile to center.....", updateUrl)
      const updateResult = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          localProfileId: localProfileId,
        }),
      });
      if (!updateResult.ok) {
        throw new Error(`Failed to update profile in Task Center: ${updateResult.status}`);
      }
    } catch (error) {
      console.error(`[Task ${id}] Failed to update Task Center:`, error);
    }
  }
}

export async function runTaskById(id: number): Promise<ExecutionResult> {
    try {    
      const task: Task | undefined = await storage.getTask(id);      
      let errorDetails = await checkTask(task);
      let result: ExecutionResult;

      if(task && errorDetails == ""){
        result = await runTask(task);
      }else{
        console.log(errorDetails);
        result = {
          status: "FAILED",
          message: errorDetails,
          duration: 0,
          timestamp: new Date().toISOString(),
          browserType: "",
          error: errorDetails,
        }                            
      }
              
      return result;
             
    } catch (error) {
      console.error(`[Task ${id}] Error during task execution:`, error);
      const result: ExecutionResult = {
        status: "FAILED",
        message: (error as Error).message,
        duration: 0,
        timestamp: new Date().toISOString(),
        browserType: "",
        error: JSON.stringify(error),
      };
      updateTaskResult(id, "FAILED", result);
      throw error;
    }
  
}

async function checkTask(task: Task | undefined): Promise<string>{
  if(task == undefined){
    return `Task not found`;
  }  
  
  const id = task.id;
  if(await utils.isRunningTask(id)){
    return `Task ${id} is already running`;
  }

  const profile = task.profile as any;
  if(profile.localWorkerId ){
    if(profile.localProfileId){
      if(profile.localProfileId == -1){
        return `Profile "With Custom Field" not found in local storage`;
      }else{
        if( await utils.isRunningProfile(profile.localProfileId)){
          return `Local profile ${profile.localProfileId} of Task ${id} is already running`;
        }
      }
    }else{
      return `Please sync task to load local Profile Id`;
    }
  }else{
    if(task?.profileId && await utils.isRunningProfileOfTask(task?.profileId)){
      return `Profile ${task?.profileId} of Task ${id} is already running`;      
    }
  }
  return "";
}

async function runTask(task: Task): Promise<ExecutionResult>{
  const taskId = task.id;
  let result: ExecutionResult;
  const profileData = task?.profile as any;      
  // Profile management functionality is now handled directly in profiles.ts  
  let executionProfileId;    
  let profilePath;
  let scriptContent = '';
  
    
  if (await utils.isLocalProfile(taskId)) {
    // Use local profile
    const localProfileId = profileData?.localProfileId ?? null;      
    executionProfileId = localProfileId.toString();
    profilePath = path.join(config.LOCAL_PROFILE, executionProfileId);
    console.log(`[Task ${taskId}] Using local profile ${executionProfileId} from ${profilePath}`);  
  } else {
    // Use original task profile data logic
    executionProfileId = task?.profileId?.toString()||"Unknown";        
    profilePath = path.join(config.TASKS_PROFILE, executionProfileId);
    await fs.promises.mkdir(profilePath, { recursive: true });
    console.log(`[Task ${taskId}] Created temporary profile directory: ${profilePath} (folder: ${executionProfileId})`);
  
    const profile = task?.profile as any || {};
    const configPath = path.join(profilePath, 'config.json');
    await fs.promises.writeFile(configPath, JSON.stringify(profile, null, 2), 'utf8');
    console.log(`[Task ${taskId}] Created config.json from task profile data`);
  }
  
  // Create chrome-profile directory for browser session data
  const chromeProfilePath = path.join(profilePath, 'chrome-profile');
  await fs.promises.mkdir(chromeProfilePath, { recursive: true });
  const taskPath = path.join(profilePath, "task-" + taskId.toString());
  await fs.promises.mkdir(taskPath, { recursive: true });

  // Write script file
  const script = task?.script as { content?: string } || {};
  scriptContent = script.content || '';
  const scriptPath = path.join(taskPath, 'script.js');
  await fs.promises.writeFile(scriptPath, scriptContent, 'utf8');
  console.log(`[Task ${taskId}] Created script.js`);

  // Write request file
  const request = task?.request;
  const requestPath = path.join(taskPath, 'request.json');
  // Handle both string and object formats
  const requestData = typeof request === 'string' ? request : JSON.stringify(request, null, 2);
  await fs.promises.writeFile(requestPath, requestData, 'utf8');
  console.log(`[Task ${taskId}] Created request.json`);
      
  const executionConfig: ExecutionConfig = {
    type: "task",
    taskId: taskId,
    taskPath: taskPath,
    task: task,
    profileId: executionProfileId,
    profilePath: profilePath,
    profile: task?.profile as Profile,
    config: config
  };      

  // Update status as "RUNNING" in Task Center
  updateTaskResult(taskId, 'RUNNING', null);            
  result = await executeScript(executionConfig);
  updateTaskResult(taskId, result.status, result);

  return result;  
}

async function updateTaskResult(id: number, status: string, result: ExecutionResult | null){
  // Update task status in local storage
  await storage.updateTask(id, {
    status: status,
    response: result
  });

  // Update task in Task Center if URL is configured
  await updateTaskToTaskCenter(id, status , result);
}