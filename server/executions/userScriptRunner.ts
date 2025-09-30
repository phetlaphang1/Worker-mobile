import * as path from "path";
import { createRequire } from "module";
import { promises as fs } from "fs";
import axios from "axios";
import FormDataPackage from "form-data";

import { ERROR_N8N_ROXANE_URL, ERROR_N8N_SCRIPTS } from "../config";
import { getTimeStamp, getCustomFieldFromProfile  } from "../middlewares/utils";
import { ExecutionConfig, ExecutionResult } from "./executionTypes";
import { loadES6Module } from "./scriptModule";

// Create require function for ES module context
const nodeRequire = createRequire(import.meta.url);

export async function runUserScript(
  config: ExecutionConfig,
  scriptContent: string,
  taskPath: string,
  logPrefix: string,
  browser: any,
  page: any,
  writeLogToFile: (message: string) => Promise<void>
): Promise<ExecutionResult> {
  // Execute the user script in async context
  try {
    // Preprocess script to handle ES6 imports by converting them to require statements
    let processedScript = scriptContent;
    console.log(`Original script (first 200 chars):`);
    console.log(scriptContent.substring(0, 200));

    // Convert ES6 import statements to require statements with mock modules
    const originalLength = processedScript.length;

    // Convert import * as X from "Y" pattern
    processedScript = processedScript.replace(
      /import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["'];?/g,
      'const $1 = require("$2");',
    );

    // Convert import X from "Y" pattern (default imports)
    processedScript = processedScript.replace(
      /import\s+(\w+)\s+from\s+["']([^"']+)["'];?/g,
      'const $1 = require("$2").default || require("$2");',
    );

    // Convert import { X, Y } from "Z" pattern (named imports)
    processedScript = processedScript.replace(
      /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?/g,
      'const { $1 } = require("$2");',
    );

    // Add JSON parsing for config to ensure it's properly parsed
    processedScript = `try { config = JSON.parse(config); } catch (e) { }\n` + processedScript;

    // Log if any changes were made
    if (processedScript.length !== originalLength) {
      console.log(`Script imports converted to require statements`);
    } else {
      console.log(`No script changes made`);
    }

    const requireES6Module = await loadES6Module(writeLogToFile);

    // Create custom require function that loads pre-loaded modules
    const requireForScript = (moduleName: string) => {
      console.log(`Script requesting module: ${moduleName}`);

      if (moduleName === "#gen") {
        console.log("Returning pre-loaded #gen module, keys: " + JSON.stringify(Object.keys(requireES6Module.genModule)));
        return requireES6Module.genModule;
      } else if (moduleName === "#act") {
        console.log("Returning pre-loaded #act module, keys: " + JSON.stringify(Object.keys(requireES6Module.actModule)));
        return requireES6Module.actModule;
      } else if (moduleName === "#actTwitter") {
        console.log("Returning pre-loaded #actTwitter module, keys: " + JSON.stringify(Object.keys(requireES6Module.actTwitterModule)));
        return requireES6Module.actTwitterModule;
      } else if (moduleName === "#rai") {
        console.log("Returning pre-loaded #rai module, keys: " + JSON.stringify(Object.keys(requireES6Module.raiModule)));
        return requireES6Module.raiModule;
      } else if (moduleName === "#imposter" || moduleName === "Imposter") {
        console.log("Returning pre-loaded Imposter module, keys: " + JSON.stringify(Object.keys(requireES6Module.imposterModule)));
        return requireES6Module.imposterModule;
      } else {
        // For other modules, use the Node.js require function
        try {
          return nodeRequire(moduleName);
        } catch (error) {
          console.log(`Failed to require module ${moduleName}: ${(error as Error).message}`);
          return {};
        }
      }
    };

    // Use eval to execute the script with proper async context and Node.js modules
    const AsyncFunction = Object.getPrototypeOf(
      async function () {},
    ).constructor;
    console.log("Processed Script:....");
    console.log(processedScript);
    const scriptFunction = new AsyncFunction(
      "browser",
      "page",
      "fs",
      "path",
      "require",
      "console",
      "log",
      "config",
      "captcha",
      processedScript,
    );

    // Import the required modules using nodeRequire
    const nodeFs = nodeRequire('fs');
    const nodePath = nodeRequire('path');
    
    // Create fs module with both sync and async methods for script access
    const fsForScript = {
      mkdir: fs.mkdir,
      writeFile: fs.writeFile,
      readFile: fs.readFile,
      access: fs.access,
      readFileSync: nodeFs.readFileSync,
      writeFileSync: nodeFs.writeFileSync,
      existsSync: nodeFs.existsSync,
      mkdirSync: nodeFs.mkdirSync,
      promises: {
        mkdir: fs.mkdir,
        writeFile: fs.writeFile,
        readFile: fs.readFile,
        access: fs.access,
      },
    };

    // Create path module with profile-specific utilities
    const pathForScript = {
      ...path,
      join: (...segments: any[]) => path.join(taskPath, ...segments),
      outputJoin: (...segments: any[]) =>
        path.join(taskPath + "/output/", ...segments),
      resolve: (...segments: any[]) => path.resolve(taskPath, ...segments),
    };

    await writeLogToFile('Executing automation script');
    const startTime = Date.now();
    
    // Store original working directory
    // const originalCwd = process.cwd();
    let resultDetail;
    try {
      // Change working directory to profile path for relative path resolution
      process.chdir(taskPath);
      
      // Create CAPTCHA helper object for scripts (Using Phase 1 detector)
      const captchaHelper = {
        // Detect CAPTCHA and get info
        detect: async () => {
          if ((page as any).captchaDetector) {
            const info = await (page as any).captchaDetector.detect();
            return info.detected;
          }
          // Fallback to basic detection
          const hasRecaptcha = await page.evaluate(() => {
            return !!(
              document.querySelector('.g-recaptcha') ||
              document.querySelector('iframe[src*="recaptcha"]') ||
              document.querySelector('.h-captcha')
            );
          });
          return hasRecaptcha;
        },
        // Get detailed CAPTCHA info
        getInfo: async () => {
          if ((page as any).captchaDetector) {
            return await (page as any).captchaDetector.detect();
          }
          return { type: 'UNKNOWN', detected: false };
        },
        // Detect all CAPTCHAs on page
        detectAll: async () => {
          if ((page as any).captchaDetector) {
            return await (page as any).captchaDetector.detectAll();
          }
          return [];
        },
        // Solve CAPTCHA (placeholder for Phase 2)
        solve: async () => {
          const info = await captchaHelper.getInfo();
          if (info.detected) {
            console.log(`CAPTCHA detected: ${info.type}`);
            console.log(`Site key: ${info.siteKey}`);
            // TODO: Phase 2 - Implement solving based on type
            console.log('CAPTCHA solver not yet implemented (Phase 2)');
            return false;
          }
          return false;
        },
        // Wait for CAPTCHA to be solved (placeholder)
        waitForSolve: async (timeout = 30000) => {
          const startTime = Date.now();
          console.log('waitForSolve not yet implemented (Phase 2)');
          // For now just return false
          return false;
        }
      };

      resultDetail = await scriptFunction(
        browser,
        page,
        fsForScript,
        pathForScript,
        requireForScript,
        console,
        { log: (message: string) => writeLogToFile(`[Script Log] ${message}`) },
        config,
        captchaHelper
      );      
    } finally {
      // Restore original working directory
      // process.chdir(originalCwd);
    }
    
    const duration = Date.now() - startTime;
    await writeLogToFile('Script execution completed successfully');
    
    // Return success result
    return {
      status: "COMPLETED" as const,
      message: "Script execution completed successfully",
      duration,
      timestamp: new Date().toISOString(),
      browserType: "puppeteer",
      details: resultDetail
    };
  } catch (scriptError) {
    const errorMessage =
      scriptError instanceof Error
        ? scriptError.message
        : String(scriptError);
    const errorStack = scriptError instanceof Error ? scriptError.stack : "";
    await writeLogToFile(`Script execution error: ${errorMessage}`);
    if (errorStack) {
      await  writeLogToFile(`Error stack: ${errorStack}`);
      console.log(errorStack);
    }

    const errorScreenhotName = `error_${getTimeStamp()}.png`;
    const errorScreenshotPath = path.join(
      taskPath,
      "output",
      errorScreenhotName,
    );

    // Capture error screenshot to output folder
    try {
      if (browser && browser.pages && page) {       
        if (page && !page.isClosed()) {
          // Ensure output directory exists then take screenshot
          await fs.mkdir(path.dirname(errorScreenshotPath), {
            recursive: true,
          });

          await page.screenshot({
            path: errorScreenshotPath,
            fullPage: false,
          });
          console.log(
            `${logPrefix} Error screenshot saved to ${errorScreenshotPath}`,
          );
        }
      }
    } catch (screenshotError: any) {
      console.log(
        `${logPrefix} Failed to capture error screenshot: ${screenshotError.message}`,
      );
    }

    // Sendinng error and image to N8N_ROXANE
    await sendErrorToN8N(config, errorScreenshotPath, errorScreenhotName, errorMessage);

    // Return error result instead of throwing
    return {
      status: "FAILED" as const,
      message: errorMessage,
      duration: Date.now() - (Date.now()), // Will be 0 for errors
      timestamp: getTimeStamp(),
      browserType: "puppeteer",
      details: errorStack,
      error: errorMessage,
    };
  } 
}

async function sendErrorToN8N(config: any, errorScreenshotPath: string, errorScreenhotName: string, errorMessage: string){
  
  try {      
    if(config.type != 'task'){    
      return;
    }               
     
    const scriptId: number = config.task?.scriptId;
    const customField = getCustomFieldFromProfile(config.profile);

    if(!ERROR_N8N_SCRIPTS.includes(scriptId)){
      // console.log(`Script ${scriptId} is not configured to send error to N8N`);
      return;
    }               

    const resultData = {
        taskId: config?.task?.id,
        scriptId: config?.task?.scriptId,
        profileId: config?.task?.profileId,                
        workerId: process.env.TASK_CENTER_USER_ID,
        subWorkerId: config?.task?.subWorkerId,
        twitterAccount: (customField as any).twitter_account?.username || "",                                 
        status: 'error',
        errorScreenshot: errorScreenhotName,
        message: errorMessage,
    };                        
    const imageData = await fs.readFile(errorScreenshotPath);
    
    const formData = new FormDataPackage();
    formData.append('result', JSON.stringify(resultData));
    formData.append('image', imageData, {
        filename: path.basename(errorScreenhotName),
        contentType: 'image/png'
    });
    
    const headers = {
        ...formData.getHeaders()
    };
    
    let N8N_ROXANE_URL;
    const profileN8N = (customField as any).n8n_roxane_url;
    
    if(profileN8N){
      N8N_ROXANE_URL =  profileN8N;    
    }else{
      N8N_ROXANE_URL = ERROR_N8N_ROXANE_URL;
    }

    console.log(`Sending error to N8N: ${N8N_ROXANE_URL}`);
    const res = await axios.post(N8N_ROXANE_URL, formData, { headers });
    console.log("Response data: ", res.data);
  
  } catch (error: any) {
    console.log(`Failed to send error to N8N: ${error.message}`);
    if (error.code) {
      console.log(`Error code: ${error.code}`);
    }
    if (error.response) {
      console.log(`Response status: ${error.response.status}`);
      console.log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}