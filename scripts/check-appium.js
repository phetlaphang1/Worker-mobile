#!/usr/bin/env node

/**
 * Check if Appium is installed and install if missing
 * This script runs before `npm run dev`
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkCommand(command) {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  log('\n========================================', 'blue');
  log('🔍 Checking Appium installation...', 'blue');
  log('========================================\n', 'blue');

  // Check if Appium is installed
  const appiumInstalled = checkCommand('appium');

  if (appiumInstalled) {
    log('✅ Appium is already installed', 'green');

    // Check if UiAutomator2 driver is installed
    try {
      const drivers = execSync('appium driver list --installed', { encoding: 'utf8' });
      if (drivers.includes('uiautomator2')) {
        log('✅ UiAutomator2 driver is installed', 'green');
      } else {
        log('⚠️  UiAutomator2 driver not found, installing...', 'yellow');
        execSync('appium driver install uiautomator2', { stdio: 'inherit' });
        log('✅ UiAutomator2 driver installed', 'green');
      }
    } catch (error) {
      log('⚠️  Could not check drivers, continuing anyway...', 'yellow');
    }
  } else {
    log('⚠️  Appium not found, installing...', 'yellow');
    log('📦 Installing Appium globally (this may take a while)...', 'blue');

    try {
      execSync('npm install -g appium', { stdio: 'inherit' });
      log('✅ Appium installed successfully', 'green');

      log('📦 Installing UiAutomator2 driver...', 'blue');
      execSync('appium driver install uiautomator2', { stdio: 'inherit' });
      log('✅ UiAutomator2 driver installed', 'green');
    } catch (error) {
      log('❌ Failed to install Appium', 'red');
      log('Please install manually: npm install -g appium', 'red');
      process.exit(1);
    }
  }

  log('\n========================================', 'green');
  log('✅ All checks passed!', 'green');
  log('========================================\n', 'green');
}

main().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
