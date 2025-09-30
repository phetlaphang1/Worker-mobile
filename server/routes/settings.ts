import type { Express } from "express";
import { killAllChromeProcesses } from "../executions/execution";
import { getRunningProfileCount, getRunningTaskCount } from '../middlewares/utils';
import {
  ORIGINAL_CWD,
  AUTO_RUN_TASK_ENABLE,
  AUTO_RUN_TASK_INTERVAL,
  AUTO_RUN_TASK_PARRALEL,
  AUTO_RUN_PROFILE_ENABLE,
  AUTO_RUN_PROFILE_INTERVAL,
  AUTO_RUN_PROFILE_PARRALEL,
  SELECTED_SCRIPT,
  updateTaskSettings,
  updateProfileSettings
} from '../config';
import * as fs from 'fs';
import * as path from 'path';

export function registerSettingsRoutes(app: Express): void {
  // Config endpoint to provide environment variables to client
  app.get("/api/config", (req, res) => {
    res.json({
      taskCenterUserId: process.env.TASK_CENTER_USER_ID || null
    });
  });

  // Get all settings
  app.get('/api/settings', async (req, res) => {
    try {
      let executionStatus = {
        runningTasks: 0,
        runningProfiles: 0
      };

      // Try to get execution status, but don't fail if it errors
      try {
        const runningTasks = await getRunningTaskCount();
        const runningProfiles = await getRunningProfileCount();
        executionStatus = {
          runningTasks,
          runningProfiles
        };
      } catch (error) {
        console.error('Error getting execution status:', error);
        // Continue with default values
      }

      // Get list of scripts from samples-js folder
      let listOfScripts: string[] = [];
      try {
        const scriptsDir = path.join(ORIGINAL_CWD, "server", "scripts", "samples-js");
        if (fs.existsSync(scriptsDir)) {
          const files = fs.readdirSync(scriptsDir);
          listOfScripts = files
            .filter(file => file.endsWith('.js'))
            .map(file => file.replace('.js', ''));
        }
      } catch (error) {
        console.error('Error reading scripts directory:', error);
      }

      res.json({
        executionStatus,
        taskSettings: {
          isAutoRunTask: AUTO_RUN_TASK_ENABLE,
          intervalOfAutoRunTask: AUTO_RUN_TASK_INTERVAL,
          parallelRunningTask: AUTO_RUN_TASK_PARRALEL
        },
        profileSettings: {
          isAutoRunProfile: AUTO_RUN_PROFILE_ENABLE,
          intervalOfAutoRunProfile: AUTO_RUN_PROFILE_INTERVAL,
          parallelRunningProfile: AUTO_RUN_PROFILE_PARRALEL,
        },
        scriptSettings: {
          selectedScript: SELECTED_SCRIPT,
          listOfScripts
        }
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({
        error: 'Failed to fetch settings'
      });
    }
  });

  // Update task settings
  app.post('/api/settings/tasks', async (req, res) => {
    try {
      const { isAutoRunTask, intervalOfAutoRunTask, parallelRunningTask } = req.body;
      
      // Update config values using setter function
      updateTaskSettings({
        isAutoRunTask,
        intervalOfAutoRunTask,
        parallelRunningTask
      });
      
      res.json({
        success: true,
        settings: {
          isAutoRunTask: AUTO_RUN_TASK_ENABLE,
          intervalOfAutoRunTask: AUTO_RUN_TASK_INTERVAL,
          parallelRunningTask: AUTO_RUN_TASK_PARRALEL
        }
      });
    } catch (error) {
      console.error('Error updating task settings:', error);
      res.status(500).json({
        error: 'Failed to update task settings'
      });
    }
  });

  // Update profile settings
  app.post('/api/settings/profiles', async (req, res) => {
    try {
      const { isAutoRunProfile, intervalOfAutoRunProfile, parallelRunningProfile, selectedScript } = req.body;

      // Update config values using setter function
      await updateProfileSettings({
        isAutoRunProfile,
        intervalOfAutoRunProfile,
        parallelRunningProfile,
        selectedScript,
      });
      
      res.json({
        success: true,
        settings: {
          isAutoRunProfile: AUTO_RUN_PROFILE_ENABLE,
          intervalOfAutoRunProfile: AUTO_RUN_PROFILE_INTERVAL,
          parallelRunningProfile: AUTO_RUN_PROFILE_PARRALEL,
          selectedScript: SELECTED_SCRIPT,
        }
      });
    } catch (error) {
      console.error('Error updating profile settings:', error);
      res.status(500).json({
        error: 'Failed to update profile settings'
      });
    }
  });

  // Add Chrome process termination endpoint
  app.post("/api/settings/terminate-chrome", async (req, res) => {
    try {
      
      const result = await killAllChromeProcesses();
      res.json(result);
    } catch (error: any) {
      console.error("Error terminating Chrome processes:", error);
      res.status(500).json({ 
        error: "Failed to terminate Chrome processes",
        details: error.message 
      });
    }
  });  
}


