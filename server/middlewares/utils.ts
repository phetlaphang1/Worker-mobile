import path from "path";
import { ORIGINAL_CWD, LOCAL_PROFILE, TASKS_PROFILE } from "../config";
import { storage } from "../services/storage";
// Changable states

export async function isRunningTask(taskId: number): Promise<boolean> {
    const tasks = await storage.getTasks();
    return tasks.filter((task: any) => task.id === taskId && task.status === 'RUNNING').length > 0;
}

export async function isRunningProfileOfTask(profileId: number): Promise<boolean> {
    const tasks = await storage.getTasks();
    return tasks.filter((task: any) => task.profileId === profileId && task.status === 'RUNNING').length > 0;
}

export async function isRunningProfile(profileId: number): Promise<boolean> {
    const profiles = await storage.getProfiles();
    return profiles.filter((profile: any) => profile.id === profileId && profile.status === 'RUNNING').length > 0;
}

export async function getRunningTaskCount(): Promise<number> {
    const tasks = await storage.getTasks();
    return tasks.filter((task: any) => task.status === 'RUNNING').length;
}

export async function getRunningProfileCount(): Promise<number> {
    const profiles = await storage.getProfiles();
    return profiles.filter((profile: any) => profile.status === 'RUNNING').length;
}

export async function getTaskPathFromTaskId(taskId: number): Promise<string | null> {
    try {
      // Get task from storage directly instead of API call
      const task = await storage.getTask(taskId);
      
      if (!task) {
        console.error(`Task ${taskId} not found`);
        return null;
      }
    
      if(await isLocalProfile(taskId)){
        return path.join(LOCAL_PROFILE, (task.profile as any).localProfileId.toString(), `task-${taskId}`);        
      }
      
      if(task.profileId) {
        return path.join(TASKS_PROFILE, task.profileId.toString(), `task-${taskId}`);
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting task path for task ${taskId}:`, error);
      return null;
    }
}

export async function getCustomFieldFromProfile(profile: any){
  let customField = profile.customField;
    try{
        customField = JSON.parse(customField as string)
    }catch(e){
        // console.log(e);
    }
  return customField;
}

export function getTimeStamp(){
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    return timeStamp;
}

export async function isLocalProfile(taskId: number){
  const task = await storage.getTask(taskId);
        
  if (!task) {
    console.error(`Task ${taskId} not found`);
    return false;
  }

  const profileData: any = task?.profile;
  const localWorkerId  = profileData.localWorkerId;
  const localProfileId = profileData?.localProfileId ?? null;    

  if (localWorkerId ==  process.env.TASK_CENTER_USER_ID && localProfileId > 0) {      
    return true;
  }
  return false;
}




