import * as config from "../config";
import * as utils  from "./utils";  
import { loadAllTasksFromCenter } from "./taskManager";
import { runTaskById } from "./taskManager";
  
export async function autoRunTask() {  
    if (config.AUTO_RUN_TASK_ENABLE != true) {return}
    try {      
      if (await utils.getRunningTaskCount() >= config.AUTO_RUN_TASK_PARRALEL) {
        console.log("Auto run is disabled because there are running scripts");
        return;
      }
      const tasks = await loadAllTasksFromCenter();   
      const task = await getTaskToRun(tasks);   
      if(!task){
        console.log(`No task for auto run in this ${config.AUTO_RUN_TASK_INTERVAL}(s) interval`);
        return;
      }else{
        try {                    
          await runTaskById(task.id);
        } catch (error) {
          console.error(`Failed to auto-run task ${task.id}:`, error);
        }
      }     
    
    } catch (error) {
      console.error('Auto-run task error:', error);
    }
  };
  
async function getTaskToRun(tasks: any){
  let fallbackTask = null;

  // First pass: Look for tasks with scriptId 9
  for (const centerTask of tasks) {
    if (centerTask.status === 'READY') {
      if (centerTask?.profileId && await utils.isRunningProfileOfTask(centerTask?.profileId)) {
        console.log(`Profile ${centerTask?.profileId} of Task ${centerTask.id} is already running`);
        continue;
      } else {
        // Prioritize tasks with scriptId 9
        if (config.AUTO_RUN_TASK_PRIORITY.includes(centerTask.scriptId)) {
          console.log(`Found priority task ${centerTask.id} with scriptId 9`);
          return centerTask;
        }
        // Keep track of first available non-priority task
        if (!fallbackTask) {
          fallbackTask = centerTask;
        }
      }
    }
  }

  // If no task with scriptId 9 found, return the first available task
  if (fallbackTask) {
    console.log(`No priority tasks found, running task ${fallbackTask.id}`);
  }

  return fallbackTask;
}
