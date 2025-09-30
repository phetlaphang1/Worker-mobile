import * as path from "path";
import { ORIGINAL_CWD } from "../config";


// Simple mutex implementation for module loading
const moduleLoadMutex = {
  locked: false,
  queue: [] as (() => void)[],
  async acquire() {
    return new Promise<void>((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  },
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next!();
    } else {
      this.locked = false;
    }
  }
};

export async function loadES6Module(writeLogToFile: any) {
  await writeLogToFile("Pre-loading ES6 modules...");

  // Load library modules first
  const actLibPath = path.join(
    ORIGINAL_CWD,
    "server",
    "scripts",
    "libs",
    "act.ts",
  );
  const genLibPath = path.join(
    ORIGINAL_CWD,
    "server",
    "scripts",
    "libs",
    "gen.ts",
  );
  const raiLibPath = path.join(
    ORIGINAL_CWD,
    "server",
    "scripts",
    "libs",
    "rai.ts",
  );
  const actTwitterLibPath = path.join(
    ORIGINAL_CWD,
    "server",
    "scripts",
    "libs",
    "actTwitter",
    "twitter.ts",
  );
  const imposterLibPath = path.join(
    ORIGINAL_CWD,
    "server",
    "antidetect",
    "behavior",
    "Imposter",
    "dist",
    "Imposter.js",
  );

  // Pre-load ES6 modules before script execution
  let genModule: any = {};
  let actModule: any = {};
  let raiModule: any = {};
  let actTwitterModule: any = {};
  let imposterModule: any = {};

  // Load gen module using dynamic import for ES6 modules
  try {
    await moduleLoadMutex.acquire();
    // await writeLogToFile(`Loading gen module from: ${genLibPath}`);
    genModule = await import(`file://${genLibPath}`);
    // await writeLogToFile("Gen module functions: " + JSON.stringify(Object.keys(genModule)));
  } catch (error) {
    await writeLogToFile(`Failed to load gen module: ${(error as Error).message}`);
  } finally {
    moduleLoadMutex.release();
  }

  // Load act module using dynamic import for ES6 modules
  try {
    await moduleLoadMutex.acquire();
    // await writeLogToFile(`Loading act module from: ${actLibPath}`);
    actModule = await import(`file://${actLibPath}?t=${Date.now()}`);
    // await writeLogToFile("Act module functions: " + JSON.stringify(Object.keys(actModule)));
  } catch (error) {
    await writeLogToFile(`Failed to load act module: ${(error as Error).message}`);
  } finally {
    moduleLoadMutex.release();
  }

  // Load rai module using dynamic import for ES6 modules
  try {
    await moduleLoadMutex.acquire();
    // await writeLogToFile(`Loading rai module from: ${raiLibPath}`);
    raiModule = await import(`file://${raiLibPath}?t=${Date.now()}`);
    // await writeLogToFile("Rai module functions: " + JSON.stringify(Object.keys(raiModule)));
  } catch (error) {
    await writeLogToFile(`Failed to load rai module: ${(error as Error).message}`);
  } finally {
    moduleLoadMutex.release();
  }

  // Load actTwitter module using dynamic import for ES6 modules
  try {
    await moduleLoadMutex.acquire();
    // await writeLogToFile(`Loading actTwitter module from: ${actTwitterLibPath}`);
    actTwitterModule = await import(`file://${actTwitterLibPath}?t=${Date.now()}`);
    // await writeLogToFile("ActTwitter module functions: " + JSON.stringify(Object.keys(actTwitterModule)));
  } catch (error) {
    await writeLogToFile(`Failed to load actTwitter module: ${(error as Error).message}`);
  } finally {
    moduleLoadMutex.release();
  }

  // Load Imposter module using dynamic import for ES6 modules
  try {
    await moduleLoadMutex.acquire();
    // await writeLogToFile(`Loading Imposter module from: ${imposterLibPath}`);
    imposterModule = await import(`file://${imposterLibPath}?t=${Date.now()}`);
    // await writeLogToFile("Imposter module functions: " + JSON.stringify(Object.keys(imposterModule)));
  } catch (error) {
    await writeLogToFile(`Failed to load Imposter module: ${(error as Error).message}`);
  } finally {
    moduleLoadMutex.release();
  }

  await writeLogToFile("ES6 modules loading completed");

  return { genModule, actModule, raiModule, actTwitterModule, imposterModule };
}