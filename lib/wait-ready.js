import { getDeviceProperty, isDeviceConnected, execAdb } from './adb.js';

/**
 * Wait for device to be ready
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @param {number} timeout - Timeout in milliseconds (default 60000)
 * @param {Function} logger - Logger function
 * @returns {Promise<boolean>}
 */
export async function waitForDeviceReady(adbPath, port, timeout = 60000, logger = console.log) {
  const startTime = Date.now();
  const checkInterval = 2000; // Check every 2 seconds

  logger(`Waiting for device 127.0.0.1:${port} to be ready...`);

  while (Date.now() - startTime < timeout) {
    try {
      // Step 1: Check if device is connected
      const connected = await isDeviceConnected(adbPath, port);
      if (!connected) {
        logger(`Device not connected yet, retrying...`);
        await sleep(checkInterval);
        continue;
      }

      // Step 2: Check boot_completed property
      const bootCompleted = await getDeviceProperty(adbPath, port, 'sys.boot_completed');
      if (bootCompleted !== '1') {
        logger(`Boot not completed (${bootCompleted}), waiting...`);
        await sleep(checkInterval);
        continue;
      }

      // Step 3: Check if package manager is ready
      const pmReady = await checkPackageManagerReady(adbPath, port);
      if (!pmReady) {
        logger(`Package manager not ready, waiting...`);
        await sleep(checkInterval);
        continue;
      }

      // Step 4: Check if shell is responsive
      const shellReady = await checkShellReady(adbPath, port);
      if (!shellReady) {
        logger(`Shell not responsive, waiting...`);
        await sleep(checkInterval);
        continue;
      }

      logger(`Device 127.0.0.1:${port} is ready!`);
      return true;
    } catch (error) {
      logger(`Error checking device readiness: ${error.message}, retrying...`);
      await sleep(checkInterval);
    }
  }

  throw new Error(`Device 127.0.0.1:${port} not ready after ${timeout}ms`);
}

/**
 * Check if package manager is ready
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @returns {Promise<boolean>}
 */
async function checkPackageManagerReady(adbPath, port) {
  try {
    const { stdout, stderr } = await execAdb(adbPath, `-s 127.0.0.1:${port} shell pm list packages -f`, 10000);
    return (stdout + stderr).includes('package:');
  } catch (error) {
    return false;
  }
}

/**
 * Check if shell is responsive
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @returns {Promise<boolean>}
 */
async function checkShellReady(adbPath, port) {
  try {
    const { stdout } = await execAdb(adbPath, `-s 127.0.0.1:${port} shell echo "ready"`, 5000);
    return stdout.includes('ready');
  } catch (error) {
    return false;
  }
}

/**
 * Sleep helper
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for specific property value
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @param {string} prop - Property name
 * @param {string} expectedValue - Expected value
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export async function waitForProperty(adbPath, port, prop, expectedValue, timeout = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const value = await getDeviceProperty(adbPath, port, prop);
      if (value === expectedValue) {
        return true;
      }
      await sleep(1000);
    } catch (error) {
      await sleep(1000);
    }
  }

  return false;
}

/**
 * Wait for package to be installed
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @param {string} packageName - Package name
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export async function waitForPackageInstalled(adbPath, port, packageName, timeout = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const { stdout } = await execAdb(adbPath, `-s 127.0.0.1:${port} shell pm list packages`, 10000);
      if (stdout.includes(packageName)) {
        return true;
      }
      await sleep(2000);
    } catch (error) {
      await sleep(2000);
    }
  }

  return false;
}
