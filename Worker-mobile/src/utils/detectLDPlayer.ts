import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export interface LDPlayerPaths {
  ldplayerPath: string;
  ldconsolePath: string;
  adbPath: string;
  found: boolean;
}

export function detectLDPlayer(): LDPlayerPaths {
  const result: LDPlayerPaths = {
    ldplayerPath: '',
    ldconsolePath: '',
    adbPath: '',
    found: false
  };

  // Common LDPlayer installation paths on Windows
  const possiblePaths = [
    'C:\\LDPlayer\\LDPlayer9',
    'C:\\LDPlayer\\LDPlayer4.0',
    'C:\\LDPlayer\\LDPlayer',
    'D:\\LDPlayer\\LDPlayer9',
    'D:\\LDPlayer\\LDPlayer4.0',
    'D:\\LDPlayer\\LDPlayer',
    'C:\\Program Files\\LDPlayer\\LDPlayer9',
    'C:\\Program Files\\LDPlayer\\LDPlayer4.0',
    'C:\\Program Files\\LDPlayer',
    'C:\\Program Files (x86)\\LDPlayer\\LDPlayer9',
    'C:\\Program Files (x86)\\LDPlayer\\LDPlayer4.0',
    'C:\\Program Files (x86)\\LDPlayer',
    'D:\\Program Files\\LDPlayer\\LDPlayer9',
    'D:\\Program Files\\LDPlayer\\LDPlayer4.0',
    'D:\\Program Files\\LDPlayer',
    'D:\\ChangZhi\\dnplayer2',  // LDPlayer Chinese version
    'C:\\ChangZhi\\dnplayer2',
  ];

  // Check each possible path
  for (const basePath of possiblePaths) {
    if (fs.existsSync(basePath)) {
      logger.info(`Found LDPlayer directory at: ${basePath}`);

      // Check for ldconsole.exe
      const ldconsolePath = path.join(basePath, 'ldconsole.exe');
      const ldconsolePath2 = path.join(basePath, 'dnconsole.exe'); // Alternative name

      if (fs.existsSync(ldconsolePath)) {
        result.ldconsolePath = ldconsolePath;
      } else if (fs.existsSync(ldconsolePath2)) {
        result.ldconsolePath = ldconsolePath2;
      }

      // Check for adb.exe
      const adbPath = path.join(basePath, 'adb.exe');
      if (fs.existsSync(adbPath)) {
        result.adbPath = adbPath;
      }

      // If both found, we have a valid installation
      if (result.ldconsolePath && result.adbPath) {
        result.ldplayerPath = basePath;
        result.found = true;
        break;
      }
    }
  }

  // Try to find via registry (Windows only)
  if (!result.found && process.platform === 'win32') {
    try {
      // Try to find LDPlayer via Windows registry
      const registryPaths = [
        'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
      ];

      for (const regPath of registryPaths) {
        try {
          const output = execSync(`reg query "${regPath}" /s /f "LDPlayer"`, { encoding: 'utf8' });

          // Parse output to find InstallLocation
          const lines = output.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('InstallLocation')) {
              const match = lines[i].match(/InstallLocation\s+REG_SZ\s+(.+)/);
              if (match && match[1]) {
                const installPath = match[1].trim();
                if (fs.existsSync(installPath)) {
                  logger.info(`Found LDPlayer via registry at: ${installPath}`);

                  // Check for executables
                  const ldconsolePath = path.join(installPath, 'ldconsole.exe');
                  const adbPath = path.join(installPath, 'adb.exe');

                  if (fs.existsSync(ldconsolePath) && fs.existsSync(adbPath)) {
                    result.ldplayerPath = installPath;
                    result.ldconsolePath = ldconsolePath;
                    result.adbPath = adbPath;
                    result.found = true;
                    break;
                  }
                }
              }
            }
          }

          if (result.found) break;
        } catch (err) {
          // Registry key not found, continue
        }
      }
    } catch (error) {
      logger.debug('Registry search failed:', error);
    }
  }

  // Try to find via running processes
  if (!result.found && process.platform === 'win32') {
    try {
      const output = execSync('wmic process where "name like \'%ld%\' or name like \'%dnplayer%\'" get ExecutablePath', { encoding: 'utf8' });
      const lines = output.split('\n').filter(line => line.trim() && !line.includes('ExecutablePath'));

      for (const line of lines) {
        const exePath = line.trim();
        if (exePath && fs.existsSync(exePath)) {
          const dir = path.dirname(exePath);
          const ldconsolePath = path.join(dir, 'ldconsole.exe');
          const adbPath = path.join(dir, 'adb.exe');

          if (fs.existsSync(ldconsolePath) && fs.existsSync(adbPath)) {
            result.ldplayerPath = dir;
            result.ldconsolePath = ldconsolePath;
            result.adbPath = adbPath;
            result.found = true;
            logger.info(`Found LDPlayer via running process at: ${dir}`);
            break;
          }
        }
      }
    } catch (error) {
      logger.debug('Process search failed:', error);
    }
  }

  // If still not found, try to find adb in PATH
  if (!result.found) {
    try {
      const adbVersion = execSync('adb version', { encoding: 'utf8' });
      if (adbVersion.includes('Android Debug Bridge')) {
        result.adbPath = 'adb'; // Use system adb
        logger.info('Found adb in system PATH');

        // Still need to find ldconsole
        logger.warn('Found adb but ldconsole.exe not found. Please install LDPlayer or set LDCONSOLE_PATH manually.');
      }
    } catch (error) {
      logger.debug('adb not found in PATH');
    }
  }

  return result;
}

export function printDetectionResults(paths: LDPlayerPaths): void {
  console.log('\n=== LDPlayer Detection Results ===\n');

  if (paths.found) {
    console.log('✅ LDPlayer found successfully!\n');
    console.log(`📁 LDPlayer Path: ${paths.ldplayerPath}`);
    console.log(`🎮 Console Path: ${paths.ldconsolePath}`);
    console.log(`🔧 ADB Path: ${paths.adbPath}`);
    console.log('\n📝 Add these to your .env file:');
    console.log(`LDPLAYER_PATH=${paths.ldplayerPath}`);
    console.log(`LDCONSOLE_PATH=${paths.ldconsolePath}`);
    console.log(`ADB_PATH=${paths.adbPath}`);
  } else {
    console.log('❌ LDPlayer not found!\n');
    console.log('Please check:');
    console.log('1. Is LDPlayer installed?');
    console.log('2. Common installation paths:');
    console.log('   - C:\\LDPlayer\\LDPlayer9');
    console.log('   - C:\\Program Files\\LDPlayer');
    console.log('   - D:\\LDPlayer\\LDPlayer9');
    console.log('\n3. You can manually search for "ldconsole.exe" on your system');
    console.log('4. Or set the paths manually in .env file');

    if (paths.adbPath) {
      console.log('\n⚠️ Partial detection:');
      console.log(`Found ADB at: ${paths.adbPath}`);
      console.log('But ldconsole.exe is required for full functionality.');
    }
  }

  console.log('\n=====================================\n');
}

// Auto-update .env file
export async function updateEnvFile(paths: LDPlayerPaths): Promise<void> {
  if (!paths.found) {
    logger.warn('Cannot update .env - LDPlayer not found');
    return;
  }

  const envPath = path.join(process.cwd(), '.env');

  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add paths
    const updates = {
      'LDPLAYER_PATH': paths.ldplayerPath,
      'LDCONSOLE_PATH': paths.ldconsolePath,
      'ADB_PATH': paths.adbPath
    };

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const newLine = `${key}=${value}`;

      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, newLine);
      } else {
        envContent += `\n${newLine}`;
      }
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    logger.info('.env file updated with LDPlayer paths');
  } catch (error) {
    logger.error('Failed to update .env file:', error);
  }
}

// Main function to run detection
export async function runDetection(autoUpdate: boolean = false): Promise<LDPlayerPaths> {
  console.log('🔍 Detecting LDPlayer installation...\n');

  const paths = detectLDPlayer();
  printDetectionResults(paths);

  if (autoUpdate && paths.found) {
    await updateEnvFile(paths);
  }

  return paths;
}

// CLI script
if (require.main === module) {
  const args = process.argv.slice(2);
  const autoUpdate = args.includes('--auto-update') || args.includes('-u');

  runDetection(autoUpdate).then(paths => {
    if (!paths.found) {
      process.exit(1);
    }
  });
}