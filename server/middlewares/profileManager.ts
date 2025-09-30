import fsPromises from "fs/promises";
import path from "path";
import type { Profile } from '@shared/schema';
import { storage } from "../services/storage";
import * as config from "../config";
import { executeScript, readProfileConfig } from "../executions/execution";
import { ExecutionResult, ExecutionConfig } from "../executions/executionTypes";

// Initialize profiles from Profile Manager at startup
export async function initializeProfiles() {
  try {    
    console.log("Initializing profiles from local storage...");
    await loadAllProfilesFromLocal();                
  } catch (error) {
    console.error("Failed to initialize profiles from local storage", error);
  }
}

export async function loadAllProfilesFromLocal(): Promise<Profile[]> {
  try {
    await ensureProfilesDirectory();
    const profiles: Profile[] = [];
    const items = await fsPromises.readdir(config.LOCAL_PROFILE);

    for (const item of items) {
      // Skip non-numeric folder names and files
      if (!item.match(/^\d+$/)) continue;
      const profilePath = path.join(config.LOCAL_PROFILE, item);
      const configPath = path.join(profilePath, 'config.json');

      try {
        // Check if config.json exists
        const configData = await fsPromises.readFile(configPath, 'utf8');
        const profile = JSON.parse(configData);

        profiles.push(profile);
      } catch (error) {
        console.warn(`Failed to load profile from folder ${item}:`, error);
      }
      }

       // Sync loaded profiles with in-memory storage
       for (const profile of profiles) {
        const existingProfile = await storage.getProfile(profile.id);
        if (!existingProfile) {
          // Profile exists in file system but not in memory, add it to storage with original ID
          await storage.createProfile(profile as any);          
        }else{
          // Profile exists in memory, update it
          await storage.updateProfile(profile.id, profile as any);
        }
      }

      console.log("Profiles loaded from local storage:", profiles.length);

    // Sort profiles by ID
    return profiles.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error('Failed to load profiles from folder:', error);
    return [];
  }
}

export async function createProfileFolder(profile: Profile): Promise<string> {
  await ensureProfilesDirectory();

  // Create folder name using only profile ID
  const profilePath = path.join( config.LOCAL_PROFILE, profile.id.toString());

  try {
    await fsPromises.mkdir(profilePath, { recursive: true });
    await fsPromises.mkdir(path.join(profilePath, "local"), { recursive: true });

    // Create config.json with profile information    
    let configData: any = profile;
    configData.createdAt = new Date(profile.createdAt).toISOString(),
    configData.updatedAt = new Date().toISOString(),
    configData.status = "READY";

    await fsPromises.writeFile(
      path.join(profilePath, 'config.json'),
      JSON.stringify(configData, null, 2),
      'utf8'
    );

    
    let scriptContent = `// Browser Automation Script for ${profile.name}\n`;
    let scriptName = config.SELECTED_SCRIPT ? config.SELECTED_SCRIPT : "example.js";    
    scriptContent += await fsPromises.readFile(path.join(config.ORIGINAL_CWD,"server","scripts","samples-js", scriptName + ".js"), 'utf8');    
    console.log("Script Content: ");
    console.log(scriptContent);

    // Create default script.js
    await fsPromises.writeFile(
      path.join(profilePath,"local", 'script.js'), 
      scriptContent, 
      'utf8'  
    );

    return profilePath;
  } catch (error) {
    console.error(`Failed to create profile folder for ${profile.name}:`, error);
    throw new Error(`Failed to create profile folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getProfileFolder(profileId: number): Promise<string | null> {
  try {
    await ensureProfilesDirectory();

    // First try the simple ID format (1, 2, 3, etc.)
    const simplePath = path.join(config.LOCAL_PROFILE, profileId.toString());
    try {
      await fsPromises.access(simplePath);
      return simplePath;
    } catch {
      // Folder with simple ID doesn't exist, search by config.json
    }

    // Search all folders to find profile by ID in config.json
    const items = await fsPromises.readdir(config.LOCAL_PROFILE);
    for (const item of items) {
      const profilePath = path.join(config.LOCAL_PROFILE, item);
      const configPath = path.join(profilePath, 'config.json');

      try {
        const stats = await fsPromises.stat(profilePath);
        if (stats.isDirectory() && (await fsPromises.access(configPath).then(() => true).catch(() => false))) {
          const configContent = await fsPromises.readFile(configPath, 'utf-8');
          const config = JSON.parse(configContent);
          if (parseInt(config.id) === profileId) {
            return profilePath;
          }
        }
      } catch (error) {
        // Skip invalid folders/configs
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error(`Failed to find profile folder for ID ${profileId}:`, error);
    return null;
  }
}

export async function deleteProfileFolder(profileId: number): Promise<void> {
  try {
    const profilePath = path.join(config.LOCAL_PROFILE, profileId.toString());
    await fsPromises.rm(profilePath, { recursive: true, force: true });
    console.log(`Deleted profile folder: ${profilePath}`);
  } catch (error) {
    console.error(`Failed to delete profile folder for ID ${profileId}:`, error);
    // Don't throw error for cleanup operations
  }
}

export async function updateProfileInfo(profile: Profile): Promise<void> {
  const profilePath = await getProfileFolder(profile.id);
  if (!profilePath) return;

  try {
    const configPath = path.join(profilePath, 'config.json');      
    await fsPromises.writeFile(configPath, JSON.stringify(profile, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to update profile info for ID ${profile.id}:`, error);
  }
}

export async function updateProfileStatus(profileId: number, status: string) {
  try {
    const configPath = path.join(config.LOCAL_PROFILE, profileId.toString(), 'config.json');

    // Read existing config
    const configData = await fsPromises.readFile(configPath, 'utf8');
    const profileConfig = JSON.parse(configData);

    // Update status
    profileConfig.status = status;
    profileConfig.updatedAt = new Date().toISOString();
    
    // Write back to file
    await fsPromises.writeFile(configPath, JSON.stringify(profileConfig, null, 2));
    console.log(`Updated profile ${profileId} status to ${status} in config.json`);
  } catch (error) {
    console.error(`Failed to update status in config.json for profile ${profileId}:`, error);
  }
}

export async function runProfileById(id: number): Promise<ExecutionResult> {
  try {
    // Update profile status to RUNNING
    await storage.updateProfile(id, { status: "RUNNING" });
    await updateProfileStatus(id, "RUNNING");

    const profile = await storage.getProfile(id);

    if (!profile) {
      return {
        status: "FAILED",
        message: "Profile not found",
        duration: 0,
        timestamp: new Date().toISOString(),
        browserType: "",
        error: "Profile not found"
      };
    }

      // Profile will be updated to COMPLETED or FAILED after execution
      console.log(
        `[Profile ${id}] Starting browser automation for: ${profile.name}`,
      );

      // Using local profileManager instance
      // Read profile configuration
      const profilePath = await getProfileFolder(id);
      if (!profilePath) {
        return {
          status: "FAILED",
          message: "Profile folder not found",
          duration: 0,
          timestamp: new Date().toISOString(),
          browserType: "",
          error: "Profile folder not found"
        };
      }
      const taskPath = path.join(profilePath, "local");;

      // Read profile configuration using shared utility
      const profileConfig = await readProfileConfig(profilePath, profile);      
      const executionConfig: ExecutionConfig = {
        type: "profile",
        taskId: 0,        
        taskPath: taskPath,
        task: null,
        profileId: profileConfig.id,
        profilePath: profilePath,        
        profile: profileConfig,
        config: config,
      };
     
      // Execute script using shared function
      const result = await executeScript(executionConfig);

      await storage.updateProfile(id, { status: result.status });
      await updateProfileStatus(id, result.status);
      // console.log(result);
      return result;      
    } catch (error) {
      console.error("Launch profile error:", error);
      // Update profile status to FAILED on error
      try {
        await storage.updateProfile(id, { status: "FAILED" });
        await updateProfileStatus(id, "FAILED");
      } catch (statusError) {
        console.error("Failed to update profile status:", statusError);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "FAILED",
        message: "Failed to launch profile",
        duration: 0,
        timestamp: new Date().toISOString(),
        browserType: "",
        error: errorMessage
      };
    }
}

async function ensureProfilesDirectory(): Promise<void> {
  try {
    await fsPromises.access(config.LOCAL_PROFILE);
  } catch {
    await fsPromises.mkdir(config.LOCAL_PROFILE, { recursive: true });
  }
}

function getProfileUserAgent(profile: Profile): string {
  // Use custom user agent if provided, otherwise use default based on browser type
  if (profile.customUserAgent) {
    return profile.customUserAgent;
  }

  const userAgents = {
    'chrome-windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'chrome-linux': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'firefox-windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'firefox-linux': 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'edge-windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'safari-mac': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.0 Safari/537.36'
  };

  return userAgents[profile.browser as keyof typeof userAgents] || userAgents['chrome-windows'];
}  

  