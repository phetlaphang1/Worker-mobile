import fs from "fs/promises";
import path from "path";
import { Express, Request, Response } from "express";
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { LOCAL_PROFILE } from "../config";
import { storage } from "../services/storage";
import { killChromeProcessesUsingProfile,  openChromeWithProfile} from "../executions/execution";
import { getLog, getOutput, getOutputFile } from "../middlewares/logAndOuput";
import * as profileManager from "../middlewares/profileManager";
import * as profileAuto from "../middlewares/profileAuto";
import { Profile } from "@shared/schema";


export function registerProfileRoutes(app: Express) {
  // Create new profile
  app.post("/api/profiles", async (req, res) => {
    try {
      // Ensure the profile has a proper name and description
      const profileData = {
        ...req.body,
        name: req.body.name || `New Profile ${Date.now()}`,
        description: req.body.description || "New profile",
      };

      const profile = await storage.createProfile(profileData);
      console.log(`Created new profile: ${profile.name} (ID: ${profile.id})`);      

      // Create the profile folder structure
      try {
        console.log(`Attempting to create profile folder for ID: ${profile.id}`);
        const folderPath = await profileManager.createProfileFolder(profile);
        console.log(`Successfully created profile folder at: ${folderPath}`);
      } catch (folderError: any) {
        console.error(`Failed to create profile folder for ID ${profile.id}:`, folderError.message);
        console.error(`Full error:`, folderError);
        // If folder creation fails, still return the profile but log the error
      }

      res.json(profile);
    } catch (error) {
      console.error("Create profile error:", error);
      res.status(500).json({ message: "Failed to create profile" });
    }
  });

  // Get all profiles
  app.get("/api/profiles", async (req, res) => {
    try {
      console.log("Loading profiles...");
      // Load profiles directly from file system to ensure all existing profiles are included
      // const profiles = await profileManager.loadAllProfilesFromLocal();
      const profiles = await storage.getProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Get profiles error:", error);
      res.status(500).json({ message: "Failed to get profiles" });
    }
  });

  // Export all profiles to Excel (must be before :id route)
  app.get("/api/profiles/export", async (req, res) => {
    try {
      // Get all profiles - load from file system to ensure we get all profiles
      const profiles: Profile[] = await profileManager.loadAllProfilesFromLocal();

      // Prepare data for Excel
      const excelData = profiles.map((profile: any) => ({
        "name": profile.name || '',
        "description": profile.description || '',
        "is_privileged": profile.isPrivileged || true,
        "is_incognito": profile.isIncognito || false,
        "is_headless": profile.headless || false,
        "user_agent": profile.userAgent || '',
        "custom_user_agent": profile.custom_user_agent || '',        
        "viewport_width": profile.viewportWidth || 1920,
        "viewport_height": profile.viewportHeight || 1080,
        "timezone": profile.timzeone || 'America/New_York',
        "language": profile.language || 'en-US',
        "use_proxy": profile.useProxy,
        "proxy_type": profile.proxyType,
        "proxy_host": profile.proxyHost,
        "proxy_port": profile.proxyPort,
        "proxy_username": profile.proxyUsername,
        "proxy_password": profile.proxyPassword,
        "custom_field": JSON.stringify(profile.customField) || '{}',
        "local_worker_id": Number(process.env.TASK_CENTER_USER_ID),
        "local_profile_id": profile.id,
        "created_at": profile.createdAt,
        "updated_at":  profile.updatedAt
      }));
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const maxWidths: { [key: number]: number } = {};
      excelData.forEach((row: any) => {
        Object.keys(row).forEach((key, idx) => {
          const value = String((row as any)[key] || '');
          const width = Math.min(50, Math.max(10, key.length, value.length));
          maxWidths[idx] = Math.max(maxWidths[idx] || 0, width);
        });
      });

      ws['!cols'] = Object.values(maxWidths).map(w => ({ wch: w }));

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Profiles');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Generate filename with date and time format: profiles_export_YYYY-MM-DD_HH-mm-ss.xlsx
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const filename = `profiles_export_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.xlsx`;

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Send the file
      res.send(buffer);
    } catch (error: any) {
      console.error("Export profiles error:", error);
      console.error("Error details:", error.message, error.stack);
      res.status(500).json({
        message: "Failed to export profiles",
        error: error.message
      });
    }
  });

  // Get specific profile by ID
  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const profileId = parseInt(req.params.id);
      if (isNaN(profileId)) {
        return res.status(400).json({ error: "Invalid profile ID" });
      }

      const profile = await storage.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Also load customField from config.json file
      try {
        const configPath = path.join(LOCAL_PROFILE, profileId.toString(), 'config.json');
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);

        // Merge customField from config.json into profile response
        const profileWithCustomField = {
          ...profile,
          customField: config.customField || profile.customField || {}
        };

        res.json(profileWithCustomField);
      } catch (configError: any) {
        // If config.json doesn't exist or can't be read, return profile without customField
        console.warn(`Could not load config.json for profile ${profileId}:`, configError.message);
        res.json(profile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Update profile
  app.put("/api/profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.updateProfile(id, req.body);

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Also update the profile folder configuration
      try {
        await profileManager.updateProfileInfo(profile);
      } catch (folderError: any) {
        console.warn(`Failed to update profile folder: ${folderError.message}`);
      }

      res.json(profile);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Delete profile
  app.delete("/api/profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProfile(id);

      if (!success) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Also delete the profile folder
      try {
        await profileManager.deleteProfileFolder(id);
      } catch (folderError: any) {
        console.warn(`Failed to delete profile folder: ${folderError.message}`);
      }

      res.json({ message: "Profile deleted successfully" });
    } catch (error) {
      console.error("Delete profile error:", error);
      res.status(500).json({ message: "Failed to delete profile" });
    }
  });

  // Get profile script
  app.get("/api/profiles/:id/script", async (req, res) => {
    try {
      const id = parseInt(req.params.id);      
      const profile = await storage.getProfile(id);

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }


      const profileFolder = await profileManager.getProfileFolder(id);

      if (!profileFolder) {
        return res.status(404).json({ message: "Profile folder not found" });
      }

      const scriptPath = path.join(profileFolder, "local", "script.js");
      let content = "";

      try {
        content = await fs.readFile(scriptPath, "utf8");
      } catch (error) {
        // Create empty script file if it doesn't exist
        content = `// Browser Automation Script for ${profile.name}
// You can use the following variables:
// - browser: Puppeteer browser instance
// - page: Use browser.newPage() to create a new page


`;
        await fs.writeFile(scriptPath, content, "utf8");
      }

      res.json({ content });
    } catch (error) {
      console.error("Get script error:", error);
      res.status(500).json({ message: "Failed to get script" });
    }
  });

  // Update profile script
  app.put("/api/profiles/:id/script", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { content } = req.body;
      const profile = await storage.getProfile(id);

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }


      const profilePath = await profileManager.getProfileFolder(id);

      if (!profilePath) {
        return res.status(404).json({ message: "Profile folder not found" });
      }

      const scriptPath = path.join(profilePath, "local", "script.js");
      await fs.writeFile(scriptPath, content, "utf8");

      res.json({ message: "Script updated successfully" });
    } catch (error) {
      console.error("Update script error:", error);
      res.status(500).json({ message: "Failed to update script" });
    }
  });

  // Launch profile
  app.post("/api/profiles/:id/launch", async (req: Request<{id: string}, any, any>, res) => {
    const id = parseInt(req.params.id);
    try {
      const result = await profileManager.runProfileById(id);
      
      if (result.status === "COMPLETED") {
        res.json({
          status: "success",
          message: `Profile [${id}] Executed Completely`,
          execution: result,
        });
      } else {
        res.status(500).json({
          message: `Profile [${id}] execution failed`,
          error: result.error,
          execution: result,
        });
      }
    } catch (error) {
      console.error('Error launching profile:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ 
        message: 'Failed to launch profile',
        error: errorMessage,
        execution: error,
      });
    }
  });

  // Get profile log content
  app.get("/api/profiles/:id/log", (req, res) =>
    getLog(req, res, false),
  );

  // Get profile output folder
  app.get("/api/profiles/:id/output", (req, res) =>
    getOutput(req, res, false),
  );

  // Serve profile output files (images, etc.)
  app.get("/api/profiles/:id/output/:filename", (req, res) =>
    getOutputFile(req, res, false),
  );

  // Stop profile execution
  app.post("/api/profiles/:id/stop", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.getProfile(id);

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
     
      // Terminate Chrome processes using this profile
      const chromeProfile = path.join(LOCAL_PROFILE, id.toString(), "chrome-profile");
      const killResult = await killChromeProcessesUsingProfile(chromeProfile);
      console.log(`[Profile ${id}] Chrome processes terminated: ${killResult.message}`);

      // Log stop action to script.log
      try {          
        const logPath = path.join(LOCAL_PROFILE, id.toString(), "script.log");
        const timestamp = new Date().toISOString();
        const stopMessage = `\n=== Script Execution STOPPED ${timestamp} ===\nExecution was manually stopped by user.\nChrome processes terminated.\n=== End Stop Log ===\n`;        
        await fs.appendFile(logPath, stopMessage, "utf8");
        console.log(`[Profile ${id}] Stop action logged to script.log`);
      } catch (logError) {
        console.error(`[Profile ${id}] Failed to log stop action:`, logError);
      }
    
      // Update profile status to FAILED when stopped by user
      await storage.updateProfile(id, { status: "FAILED" });
      await profileManager.updateProfileStatus(id, "FAILED");

      res.json({ message: "Profile execution stopped" });
    } catch (error) {
      console.error("Stop profile error:", error);
      res.status(500).json({ message: "Failed to stop profile" });
    }
  });

  // Open browser with profile
  app.post("/api/profiles/:id/open-browser", async (req, res) => {
    try {
      const profileId = parseInt(req.params.id);
      const profile = await storage.getProfile(profileId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Use profile-specific Chrome profile folder
      const chromeProfileDir = path.join(LOCAL_PROFILE, profileId.toString(), "chrome-profile");
      await openChromeWithProfile(chromeProfileDir, profile);
      
      res.json({ 
        message: "Browser opened with profile configuration",
        profileId: profileId
      });
    } catch (error) {
      console.error("Open browser error:", error);
      res.status(500).json({ 
        message: "Failed to open browser",
        error: (error as Error)?.message || 'Unknown error'
      });
    }
  });

  app.get("/api/scheduledProfiles", async (req, res) => {
    try {
      console.log("Loading scheduled profiles...");
      const profiles = profileAuto.scheduledProfiles;
      res.json(profiles);
    } catch (error) {
      console.error("Get scheduled profiles error:", error);
      res.status(500).json({ message: "Failed to get scheduled profiles" });
    }
  });

  // Proxy test endpoint
  app.post('/api/proxy-test', async (req: Request, res: Response) => {
    try {
      const {
        proxyType,
        proxyHost,
        proxyPort,
        proxyUsername,
        proxyPassword,
        testUrl = 'https://ifconfig.me/ip'
      } = req.body;

      // Validate required fields
      if (!proxyHost || !proxyPort) {
        return res.status(400).json({ 
          error: 'Proxy host and port are required' 
        });
      }

      // Construct proxy URL
      const proxyUrl = `${proxyType}://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;
      
      // Create proxy agent
      const agent = new HttpsProxyAgent(proxyUrl);

      // Make test request
      const response = await axios.get(testUrl, {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 10000
      });

      res.json({
        success: true,
        ip: response.data.trim()
      });

    } catch (error: any) {
      console.error('Proxy test failed:', error);
      
      let message = 'Proxy test failed';
      let status = 500;
      
      if (error.code === 'ECONNABORTED') {
        message = 'Proxy connection timed out';
        status = 408;
      } else if (error.code === 'ERR_PROXY_AUTHENTICATION_REQUIRED') {
        message = 'Invalid proxy credentials';
        status = 401;
      } else if (error.code === 'ECONNREFUSED') {
        message = 'Proxy connection refused';
        status = 503;
      }

      res.status(status).json({
        success: false,
        message
      });
    }
  });
}

