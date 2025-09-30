import path from "path";
import proxyChain from "proxy-chain";
import { promises as fs } from "fs";
import { promisify } from "util";
import { exec, fork } from "child_process";
import { Profile } from "@shared/schema";
import { ORIGINAL_CWD } from "../config";
import { broadcastLog } from "../services/websocket";
import { ExecutionConfig, ExecutionResult } from "./executionTypes";

export async function killChromeProcessesUsingProfile(
  profilePath: string,
): Promise<{ killed: number; message?: string }> {
  try {
    const execAsync = promisify(exec);

    // Windows-specific command to find and kill Chrome processes
    const command = process.platform === 'win32' 
      ? `wmic process where "commandline like '%${profilePath.replace(/\\/g, '\\\\')}%'" get processid`
      : `ps aux | grep -E "(chrome|chromium-browser|google-chrome)" | grep "${profilePath}" | awk '{print $2}'`;

    const { stdout } = await execAsync(command);
    
    let pids: string[] = [];
    if (process.platform === 'win32') {
      // Parse WMIC output
      pids = stdout
        .split('\n')
        .slice(1) // Skip header
        .map(line => line.trim())
        .filter(Boolean);
    } else {
      pids = stdout.trim().split("\n").filter(Boolean);
    }

    if (pids.length === 0) {
      console.log(`No Chrome processes found for profile: ${profilePath}`);
      return { killed: 0, message: "No Chrome processes found for this profile" };
    }

    let killedCount = 0;
    // Kill each process
    for (const pid of pids) {
      if (pid && pid !== "") {
        try {
          await execAsync(process.platform === 'win32' 
            ? `taskkill /F /PID ${pid}`
            : `kill -9 ${pid}`);
          console.log(`Killed Chrome process with PID: ${pid}`);
          killedCount++;
        } catch (error) {
          console.error(`Failed to kill process ${pid}:`, error);
        }
      }
    }
    
    return { 
      killed: killedCount, 
      message: `Successfully killed ${killedCount} Chrome process(es) for profile: ${profilePath}` 
    };
  } catch (error) {
    console.error('Error killing Chrome processes:', error);
    return { 
      killed: 0, 
      message: `Error killing Chrome processes: ${(error as Error).message}` 
    };
  }
}

export async function killAllChromeProcesses(): Promise<{ killed: number; message?: string }> {
  try {
    // Windows command to find and kill Chrome processes
    const command = process.platform === 'win32' 
      ? 'taskkill /F /IM chrome.exe /IM chromedriver.exe /IM chromium.exe'
      : 'pkill -f "(chrome|chromium-browser|google-chrome)"';
    
    const { stdout, stderr } = await promisify(exec)(command);
    
    if (stderr) {
      console.error('Error killing Chrome processes:', stderr);
      return { killed: 0, message: stderr };
    }
    
    console.log('Chrome processes killed:', stdout);
    return { killed: stdout.includes('terminated') ? 1 : 0 };
  } catch (error: any) {
    console.error('Error killing Chrome processes:', error);
    return { killed: 0, message: error.message };
  }
}

export async function openChromeWithProfile(
  profilePath: string,
  profileConfig: any
): Promise<void> {
  try {
    const execAsync = promisify(exec);
    
    // Ensure the profile directory exists
    await fs.mkdir(profilePath, { recursive: true });
    
    // Determine Chrome executable path based on platform
    const chromeExecutable = process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : 'google-chrome';

    // Build Chrome launch arguments
    const chromeArgs = [
      `--user-data-dir="${profilePath}"`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection'
    ];

    // Add profile-specific configurations
    if (profileConfig.isHeadless) {
      chromeArgs.push('--headless=new');
    }

    if (profileConfig.isIncognito) {
      chromeArgs.push('--incognito');
    }

    if (profileConfig.customUserAgent) {
      chromeArgs.push(`--user-agent="${profileConfig.customUserAgent}"`);
    }

    if (profileConfig.viewportWidth && profileConfig.viewportHeight) {
      chromeArgs.push(`--window-size=${profileConfig.viewportWidth},${profileConfig.viewportHeight}`);
    }

    if (profileConfig.useProxy && profileConfig.proxyHost && profileConfig.proxyPort) {
      const oldProxyUrl= `${profileConfig.proxyType}://${profileConfig.proxyUsername}:${profileConfig.proxyPassword}@${profileConfig.proxyHost}:${profileConfig.proxyPort}`;    
      const proxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl);
      chromeArgs.push(`--proxy-server=${proxyUrl}`);
      
      if (profileConfig.proxyUsername && profileConfig.proxyPassword) {
        chromeArgs.push(`--proxy-auth=${profileConfig.proxyUsername}:${profileConfig.proxyPassword}`);
      }
    }

    // Construct the command
    const command = `"${chromeExecutable}" ${chromeArgs.join(' ')}`;
    
    console.log(`Opening Chrome with profile: ${profilePath}`);
    console.log(`Command: ${command}`);

    // Launch Chrome in background (detached)
    if (process.platform === 'win32') {
      await execAsync(`start "" ${command}`, { windowsHide: true });
    } else {
      await execAsync(`nohup ${command} > /dev/null 2>&1 &`);
    }

    console.log(`Chrome browser opened successfully with profile: ${profilePath}`);
  } catch (error) {
    console.error('Error opening Chrome with profile:', error);
    throw new Error(`Failed to open Chrome browser: ${(error as Error).message}`);
  }
}

export async function readProfileConfig(
  profileFolder: string,
  profile: Profile,
): Promise<any> {
  // Start with default profile config
  let profileConfig: any = { ...profile };

  // Try to read from config.json file
  const configPath = path.isAbsolute(profileFolder)
    ? path.join(profileFolder, "config.json")
    : path.join(ORIGINAL_CWD, profileFolder, "config.json");
  try {
    const configContent = await fs.readFile(configPath, "utf8");
    profileConfig = { ...profileConfig, ...JSON.parse(configContent) };
  } catch (configError: any) {
    console.warn(`Failed to read config.json: ${configError.message}`);
  }

  return profileConfig;
}

export async function validateScript(scriptPath: string): Promise<void> {
  try {
    await fs.access(scriptPath);
  } catch (error: any) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error("Script file not found");
    } else {
      throw error;
    }
  }
}

export async function executeScript(
  config: ExecutionConfig,  
): Promise<ExecutionResult> {
  const name = config.type + "-" + config.type == "task" ?  + config.taskId : config.profileId;
  try {
    console.log(`Killing Chrome processes using profile: ${config.profilePath}\\chrome-profile`);
    const killResult = await killChromeProcessesUsingProfile(path.join(config.profilePath, "chrome-profile"));
    console.log(`Kill result: ${killResult.message}`);

    try {
      // Ensure profilePath is absolute and normalized
      const absoluteProfilePath = path.isAbsolute(config.profilePath) 
        ? config.profilePath 
        : path.join(ORIGINAL_CWD, config.profilePath);
      
      // Fork executionScript.ts as a child process
      // const script = fork(path.join(path.dirname(fileURLToPath(import.meta.url)), "scriptRunner"));
      const script = fork(path.join(ORIGINAL_CWD, "server", "executions", "scriptRunner"));
      
      // Send execution parameters to child process
      script.send({
        config,
        profilePath: absoluteProfilePath,        
      });

      // Wait for response from child process
      const result = await new Promise<ExecutionResult>((resolve, reject) => {
        script.on("message", (message: any) => {
          // Handle log messages from child process
          if (message.type === 'log') {
            const { type, id, message: logMessage, logType } = message.logData;
            broadcastLog(type, id, logMessage, logType);
            return;
          }
          
          // Handle result messages
          if (message.success) {
            resolve(message.result!);
          } else {
            reject(new Error(message.error));
          }
        });

        script.on("error", (error: any) => {
          reject(error);
        });

        script.on("exit", (code: number) => {
          if (code !== 0) {
            reject(new Error(`Child process exited with code ${code}`));
          }
        });
      });

      return result;
    } catch (error: any) {
      console.log(`${name} Script execution error with: ${error}`);
      
      // Close the browser in case of error
      try {      
        console.log(`${name} Browser closed after error`);
      } catch (closeError: any) {
        console.log(`${name} Error closing browser after script error: ${closeError}`);
      }
      
      return {
        status: "FAILED" as const,
        message: `Script execution failed: ${(error as Error).message}`,
        duration: 0,
        timestamp: new Date().toISOString(),
        browserType: "puppeteer" as const,
        error: (error as Error).message,        
      };
    }
  } finally {
  }
}