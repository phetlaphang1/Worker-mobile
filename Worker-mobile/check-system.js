/**
 * System Check - Kiểm tra hệ thống trước khi chạy
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔍 Checking Worker-Mobile System...\n');

let allOk = true;

// 1. Check LDPlayer
console.log('1. Checking LDPlayer...');
try {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const ldconsolePath = envContent.match(/LDCONSOLE_PATH=(.*)/)?.[1]?.trim();

  if (!ldconsolePath) {
    console.log('   ❌ LDCONSOLE_PATH not found in .env');
    allOk = false;
  } else {
    // Check if file exists
    const exists = fs.existsSync(ldconsolePath);
    if (exists) {
      console.log(`   ✅ LDPlayer found: ${ldconsolePath}`);

      // Try to list instances
      try {
        const result = execSync(`"${ldconsolePath}" list2`, { encoding: 'utf-8' });
        const lines = result.trim().split('\n').filter(l => l.length > 0);
        console.log(`   ✅ Found ${lines.length} LDPlayer instances`);
      } catch (e) {
        console.log('   ⚠️  Could not list instances (LDPlayer might not be running)');
      }
    } else {
      console.log(`   ❌ LDPlayer not found at: ${ldconsolePath}`);
      console.log('      Please update LDCONSOLE_PATH in .env');
      allOk = false;
    }
  }
} catch (e) {
  console.log('   ❌ Error checking LDPlayer:', e.message);
  allOk = false;
}

// 2. Check ADB
console.log('\n2. Checking ADB...');
try {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const adbPath = envContent.match(/ADB_PATH=(.*)/)?.[1]?.trim();

  if (!adbPath) {
    console.log('   ❌ ADB_PATH not found in .env');
    allOk = false;
  } else {
    const exists = fs.existsSync(adbPath);
    if (exists) {
      console.log(`   ✅ ADB found: ${adbPath}`);

      try {
        const result = execSync(`"${adbPath}" devices`, { encoding: 'utf-8' });
        const devices = result.split('\n').filter(l => l.includes('\t')).length;
        console.log(`   ✅ ADB working (${devices} devices connected)`);
      } catch (e) {
        console.log('   ⚠️  ADB command failed');
      }
    } else {
      console.log(`   ❌ ADB not found at: ${adbPath}`);
      allOk = false;
    }
  }
} catch (e) {
  console.log('   ❌ Error checking ADB:', e.message);
  allOk = false;
}

// 3. Check Node modules
console.log('\n3. Checking dependencies...');
try {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    const packageCount = fs.readdirSync(nodeModulesPath).length;
    console.log(`   ✅ Dependencies installed (${packageCount} packages)`);
  } else {
    console.log('   ❌ node_modules not found. Run: npm install');
    allOk = false;
  }
} catch (e) {
  console.log('   ❌ Error checking dependencies:', e.message);
  allOk = false;
}

// 4. Check .env file
console.log('\n4. Checking .env configuration...');
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');

    const required = ['LDCONSOLE_PATH', 'ADB_PATH', 'PORT'];
    const missing = [];

    for (const key of required) {
      if (!envContent.includes(key)) {
        missing.push(key);
      }
    }

    if (missing.length === 0) {
      console.log('   ✅ All required env variables present');
    } else {
      console.log(`   ❌ Missing env variables: ${missing.join(', ')}`);
      allOk = false;
    }
  } else {
    console.log('   ❌ .env file not found');
    allOk = false;
  }
} catch (e) {
  console.log('   ❌ Error checking .env:', e.message);
  allOk = false;
}

// 5. Check port availability
console.log('\n5. Checking port availability...');
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const port = envContent.match(/PORT=(.*)/)?.[1]?.trim() || '5051';

  try {
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
    if (result.trim()) {
      console.log(`   ⚠️  Port ${port} is already in use`);
      console.log(`      Kill the process or change PORT in .env`);
    } else {
      console.log(`   ✅ Port ${port} is available`);
    }
  } catch (e) {
    // No output means port is free
    console.log(`   ✅ Port ${port} is available`);
  }
} catch (e) {
  console.log('   ⚠️  Could not check port');
}

// 6. Check Twitter APK (optional)
console.log('\n6. Checking Twitter APK (optional)...');
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const apkPath = envContent.match(/TWITTER_APK_PATH=(.*)/)?.[1]?.trim();

  if (apkPath) {
    if (fs.existsSync(apkPath)) {
      console.log(`   ✅ Twitter APK found: ${apkPath}`);
    } else {
      console.log(`   ⚠️  Twitter APK not found at: ${apkPath}`);
      console.log('      Download from: https://www.apkmirror.com/apk/twitter-inc/twitter/');
    }
  } else {
    console.log('   ℹ️  TWITTER_APK_PATH not set (will skip Twitter app installation)');
  }
} catch (e) {
  console.log('   ℹ️  No Twitter APK configured');
}

// Summary
console.log('\n' + '='.repeat(60));
if (allOk) {
  console.log('✅ System check PASSED! You can run:');
  console.log('   npm run dev    - Start server');
  console.log('   npm test       - Run automated test');
} else {
  console.log('❌ System check FAILED! Please fix the issues above.');
}
console.log('='.repeat(60) + '\n');

process.exit(allOk ? 0 : 1);
