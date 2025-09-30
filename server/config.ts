import * as path from 'path';
import * as taskAuto from './middlewares/taskAuto';
import * as profileAuto from './middlewares/profileAuto';

// For Task Execution
export let AUTO_RUN_TASK_ENABLE = false;
export let AUTO_RUN_TASK_INTERVAL = 150;
export let AUTO_RUN_TASK_PARRALEL = 1;
export let AUTO_RUN_TASK_PRIORITY = [9];

// For Profile Execution
export let AUTO_RUN_PROFILE_ENABLE = false;
export let AUTO_RUN_PROFILE_INTERVAL = 150;
export let AUTO_RUN_PROFILE_PARRALEL = 1;
export let AUTO_RUN_PROFILE_LOOP = false;

// For Profile Execution - Twitter Caring
export let SELECTED_SCRIPT : string | undefined;

// For Script Runner
export const ORIGINAL_CWD = process.cwd();
export const LOCAL_PROFILE = path.join(ORIGINAL_CWD, 'storage', 'local');
export const TASKS_PROFILE = path.join(ORIGINAL_CWD, 'storage', 'tasks');
export const PATH_OF_CHROME_WIN32="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
export const PATH_OF_CHROME_OTHER="/usr/bin/chromium-browser";
export let BROWSER_TYPE: "puppeteer" | "playwright" = "puppeteer";

// For N8N Roxane
export const ERROR_N8N_SCRIPTS = [9,10,11];       
export const ERROR_N8N_ROXANE_URL = 'https://n8n.roxane.one/webhook/df097add-fbef-4229-84f6-bb73688c07cb';

let taskIntervalId: any;
let profileIntervalId: any;

export function innitializeConfig(){
  console.log('Initializing config...');
  
  AUTO_RUN_TASK_ENABLE = Boolean(process.env.AUTO_RUN_TASK_ENABLE) || AUTO_RUN_TASK_ENABLE;
  
  const intervalTask = parseInt(process.env.AUTO_RUN_TASK_INTERVAL || '');
  AUTO_RUN_TASK_INTERVAL  = (!isNaN(intervalTask) && intervalTask > 0) ? intervalTask : AUTO_RUN_TASK_INTERVAL;
  
  const parallelTask = parseInt(process.env.AUTO_RUN_TASK_PARRALEL || '');
  AUTO_RUN_TASK_PARRALEL = (!isNaN(parallelTask) && parallelTask > 0) ? parallelTask : AUTO_RUN_TASK_PARRALEL;

  AUTO_RUN_PROFILE_ENABLE = Boolean(process.env.AUTO_RUN_PROFILE_ENABLE) || AUTO_RUN_PROFILE_ENABLE;
  
  const intervalProfile = parseInt(process.env.AUTO_RUN_PROFILE_INTERVAL || '');
  AUTO_RUN_PROFILE_INTERVAL = (!isNaN(intervalProfile) && intervalProfile > 0) ? intervalProfile : AUTO_RUN_PROFILE_INTERVAL;
  
  const parallelProfile = parseInt(process.env.AUTO_RUN_PROFILE_PARRALEL || '');
  AUTO_RUN_PROFILE_PARRALEL = (!isNaN(parallelProfile) && parallelProfile > 0) ? parallelProfile : AUTO_RUN_PROFILE_PARRALEL;

  AUTO_RUN_PROFILE_LOOP = Boolean(process.env.AUTO_RUN_PROFILE_LOOP) || AUTO_RUN_PROFILE_LOOP;

  SELECTED_SCRIPT = String(process.env.SELECTED_SCRIPT) || SELECTED_SCRIPT;
  
  taskIntervalId = setInterval(taskAuto.autoRunTask, (AUTO_RUN_TASK_INTERVAL || 60) * 1000);
  profileIntervalId = setInterval(profileAuto.autoRunProfile, (AUTO_RUN_PROFILE_INTERVAL || 60) * 1000);
  
  console.log('Config initialized:', {
    AUTO_RUN_TASK_ENABLE: AUTO_RUN_TASK_ENABLE,
    AUTO_RUN_TASK_INTERVAL: AUTO_RUN_TASK_INTERVAL,
    AUTO_RUN_TASK_PARRALEL: AUTO_RUN_TASK_PARRALEL,
    AUTO_RUN_PROFILE_ENABLE: AUTO_RUN_PROFILE_ENABLE,
    AUTO_RUN_PROFILE_INTERVAL: AUTO_RUN_PROFILE_INTERVAL,
    AUTO_RUN_PROFILE_PARRALEL: AUTO_RUN_PROFILE_PARRALEL,
    SELECTED_SCRIPT: SELECTED_SCRIPT
  }); 
}

// Setter functions for updating configuration values
export function updateTaskSettings(settings: {
  isAutoRunTask?: boolean;
  intervalOfAutoRunTask?: number;
  parallelRunningTask?: number;
}) {
  if (typeof settings.isAutoRunTask === 'boolean') {
    AUTO_RUN_TASK_ENABLE = settings.isAutoRunTask;
  }
  if (typeof settings.intervalOfAutoRunTask === 'number' && settings.intervalOfAutoRunTask > 0) {
    AUTO_RUN_TASK_INTERVAL = settings.intervalOfAutoRunTask;
    clearInterval(taskIntervalId);
    taskIntervalId = setInterval(taskAuto.autoRunTask, (AUTO_RUN_TASK_INTERVAL || 60) * 1000);
  }
  if (typeof settings.parallelRunningTask === 'number' && settings.parallelRunningTask > 0) {
    AUTO_RUN_TASK_PARRALEL = settings.parallelRunningTask;
  }
  
  
  console.log('Config Updated:', settings);
}

export async function updateProfileSettings(settings: {
  isAutoRunProfile?: boolean;
  intervalOfAutoRunProfile?: number;
  parallelRunningProfile?: number;
  loopRunningProfile?: boolean;
  selectedScript?:string;
}) {
  if (typeof settings.isAutoRunProfile === 'boolean') {
    AUTO_RUN_PROFILE_ENABLE = settings.isAutoRunProfile;
  }
  if (typeof settings.intervalOfAutoRunProfile === 'number' && settings.intervalOfAutoRunProfile > 0) {    
    AUTO_RUN_PROFILE_INTERVAL = settings.intervalOfAutoRunProfile;
    clearInterval(profileIntervalId);
    profileIntervalId = setInterval(profileAuto.autoRunProfile, (AUTO_RUN_PROFILE_INTERVAL || 60) * 1000);
  }
  if (typeof settings.parallelRunningProfile === 'number' && settings.parallelRunningProfile > 0) {
    AUTO_RUN_PROFILE_PARRALEL = settings.parallelRunningProfile;
  }
  if (typeof settings.loopRunningProfile === 'boolean') {
    AUTO_RUN_PROFILE_LOOP = settings.loopRunningProfile;
  }
  if (typeof settings.selectedScript === 'string') {
    SELECTED_SCRIPT = settings.selectedScript;
  }
  console.log('Config Updated:', settings);

  if(AUTO_RUN_PROFILE_ENABLE){
    await profileAuto.setupScheduledProfiles();
  }else{
    profileAuto.clearScheduledProfiles();
  }
} 
