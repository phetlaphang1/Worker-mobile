import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

export interface AvailableApp {
  name: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  packageName?: string;
}

// Mapping common APK filenames to package names
const PACKAGE_NAME_MAP: Record<string, string> = {
  twitter: 'com.twitter.android',
  facebook: 'com.facebook.katana',
  instagram: 'com.instagram.android',
  telegram: 'org.telegram.messenger',
  tiktok: 'com.zhiliaoapp.musically',
  whatsapp: 'com.whatsapp',
  youtube: 'com.google.android.youtube',
  chrome: 'com.android.chrome',
  gmail: 'com.google.android.gm',
  maps: 'com.google.android.apps.maps',
  messenger: 'com.facebook.orca',
  linkedin: 'com.linkedin.android',
  snapchat: 'com.snapchat.android',
  reddit: 'com.reddit.frontpage',
  discord: 'com.discord',
};

/**
 * Scan apks folder và return danh sách apps available
 */
export async function scanAvailableApps(): Promise<AvailableApp[]> {
  const apksFolder = path.join(process.cwd(), 'apks');
  const apps: AvailableApp[] = [];

  try {
    // Check if apks folder exists
    try {
      await fs.access(apksFolder);
    } catch {
      logger.warn('apks/ folder not found. Creating...');
      await fs.mkdir(apksFolder, { recursive: true });
      return [];
    }

    // Read all files in apks folder
    const files = await fs.readdir(apksFolder);

    for (const file of files) {
      // Only process .apk files
      if (!file.toLowerCase().endsWith('.apk')) {
        continue;
      }

      const filePath = path.join(apksFolder, file);
      const stats = await fs.stat(filePath);

      // Extract app name from filename (remove .apk extension)
      const fileName = file.replace(/\.apk$/i, '');
      const appName = fileName
        .split(/[-_]/)[0] // Take first part before - or _
        .toLowerCase();

      // Get package name from map or use default
      const packageName = PACKAGE_NAME_MAP[appName] || `com.${appName}.android`;

      // Capitalize first letter for display name
      const displayName = appName.charAt(0).toUpperCase() + appName.slice(1);

      apps.push({
        name: displayName,
        fileName: file,
        filePath: `./apks/${file}`,
        fileSize: stats.size,
        packageName,
      });
    }

    logger.info(`Found ${apps.length} APK files in apks/ folder`);
    return apps;
  } catch (error) {
    logger.error('Error scanning apks folder:', error);
    return [];
  }
}

/**
 * Get app info by filename
 */
export async function getAppByFilename(filename: string): Promise<AvailableApp | null> {
  const apps = await scanAvailableApps();
  return apps.find((app) => app.fileName === filename) || null;
}

/**
 * Check if APK file exists
 */
export async function checkApkExists(filename: string): Promise<boolean> {
  const apkPath = path.join(process.cwd(), 'apks', filename);
  try {
    await fs.access(apkPath);
    return true;
  } catch {
    return false;
  }
}
