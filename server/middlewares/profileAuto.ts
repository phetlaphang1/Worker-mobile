import { storage } from "../services/storage";
import * as config from "../config";
import { getRunningProfileCount } from "./utils";
import { runProfileById } from "./profileManager";

export let scheduledProfiles = new Array<number>();

export async function setupScheduledProfiles() {
  scheduledProfiles = (await storage.getProfileIds());  
  console.log(scheduledProfiles);
}

export async function clearScheduledProfiles() {
  scheduledProfiles = [];
}

export async function autoRunProfile() {    
  if (config.AUTO_RUN_PROFILE_ENABLE != true) {return}
  try {      
    if (await getRunningProfileCount() >= config.AUTO_RUN_PROFILE_PARRALEL) {
      console.log("Auto run is disabled because there are running scripts");
      return;
    }
    
    if(!scheduledProfiles || scheduledProfiles.length === 0){
      console.log(`No profile for auto run in this ${config.AUTO_RUN_PROFILE_INTERVAL}(s) interval`);
      return;
    }else{
      const profileId = scheduledProfiles[0];
      scheduledProfiles.shift();      
      if(config.AUTO_RUN_PROFILE_LOOP){
        scheduledProfiles.push(profileId); 
      }

      console.log(scheduledProfiles);
      try {                             
        await runProfileById(profileId);
      } catch (error) {
        console.error(`Failed to auto-run task ${profileId}:`, error);
      }
    }     
  
  } catch (error) {
    console.error('Auto-run profile error:', error);
  }
};