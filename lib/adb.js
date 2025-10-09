import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Execute ADB command
 * @param {string} adbPath - Path to adb.exe
 * @param {string} command - ADB command to execute
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execAdb(adbPath, command, timeout = 30000) {
  try {
    const { stdout, stderr } = await execAsync(`"${adbPath}" ${command}`, {
      timeout,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      windowsHide: true
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    throw new Error(`ADB command failed: ${error.message}`);
  }
}

/**
 * Connect to ADB device
 * @param {string} adbPath - Path to adb.exe
 * @param {string} host - Host (default 127.0.0.1)
 * @param {number} port - ADB port
 * @returns {Promise<boolean>}
 */
export async function adbConnect(adbPath, host = '127.0.0.1', port) {
  const { stdout } = await execAdb(adbPath, `connect ${host}:${port}`, 10000);
  return stdout.includes('connected') || stdout.includes('already connected');
}

/**
 * Disconnect from ADB device
 * @param {string} adbPath - Path to adb.exe
 * @param {string} host - Host (default 127.0.0.1)
 * @param {number} port - ADB port
 * @returns {Promise<boolean>}
 */
export async function adbDisconnect(adbPath, host = '127.0.0.1', port) {
  const { stdout } = await execAdb(adbPath, `disconnect ${host}:${port}`, 5000);
  return stdout.includes('disconnected');
}

/**
 * Install APK on device
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @param {string} apkPath - Path to APK file
 * @returns {Promise<boolean>}
 */
export async function adbInstall(adbPath, port, apkPath) {
  const { stdout, stderr } = await execAdb(adbPath, `-s 127.0.0.1:${port} install -r "${apkPath}"`, 120000);
  const output = stdout + stderr;
  if (output.includes('Success') || output.includes('SUCCESS')) {
    return true;
  }
  throw new Error(`Install failed: ${output}`);
}

/**
 * Launch app using monkey command
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @param {string} packageName - Package name
 * @returns {Promise<boolean>}
 */
export async function adbLaunchApp(adbPath, port, packageName) {
  const { stdout, stderr } = await execAdb(
    adbPath,
    `-s 127.0.0.1:${port} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`,
    30000
  );
  const output = stdout + stderr;
  return output.includes('Events injected') || output.includes('Monkey');
}

/**
 * Disable animations on device
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @returns {Promise<void>}
 */
export async function adbDisableAnimations(adbPath, port) {
  const settings = [
    'window_animation_scale',
    'transition_animation_scale',
    'animator_duration_scale'
  ];

  for (const setting of settings) {
    await execAdb(adbPath, `-s 127.0.0.1:${port} shell settings put global ${setting} 0`, 5000);
  }
}

/**
 * Take screenshot and pull to local
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @param {string} localPath - Local path to save screenshot
 * @returns {Promise<string>}
 */
export async function adbScreenshot(adbPath, port, localPath) {
  const remotePath = '/sdcard/screenshot.png';

  // Take screenshot
  await execAdb(adbPath, `-s 127.0.0.1:${port} shell screencap -p ${remotePath}`, 10000);

  // Pull to local
  await execAdb(adbPath, `-s 127.0.0.1:${port} pull ${remotePath} "${localPath}"`, 15000);

  // Clean up remote file
  await execAdb(adbPath, `-s 127.0.0.1:${port} shell rm ${remotePath}`, 5000);

  return localPath;
}

/**
 * Check if device is connected
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @returns {Promise<boolean>}
 */
export async function isDeviceConnected(adbPath, port) {
  try {
    const { stdout } = await execAdb(adbPath, 'devices', 5000);
    return stdout.includes(`127.0.0.1:${port}`);
  } catch (error) {
    return false;
  }
}

/**
 * Get device property
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @param {string} prop - Property name
 * @returns {Promise<string>}
 */
export async function getDeviceProperty(adbPath, port, prop) {
  const { stdout } = await execAdb(adbPath, `-s 127.0.0.1:${port} shell getprop ${prop}`, 5000);
  return stdout;
}

/**
 * Check if package is installed
 * @param {string} adbPath - Path to adb.exe
 * @param {number} port - ADB port
 * @param {string} packageName - Package name
 * @returns {Promise<boolean>}
 */
export async function isPackageInstalled(adbPath, port, packageName) {
  try {
    const { stdout } = await execAdb(adbPath, `-s 127.0.0.1:${port} shell pm list packages`, 10000);
    return stdout.includes(packageName);
  } catch (error) {
    return false;
  }
}
