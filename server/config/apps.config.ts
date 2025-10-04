import path from 'path';

export interface AppConfig {
  name: string;
  packageName: string;
  apkPath: string;
  autoInstall: boolean;
}

// Danh sách apps sẽ auto-install
export const APPS_CONFIG: AppConfig[] = [
  {
    name: 'Twitter',
    packageName: 'com.twitter.android',
    apkPath: process.env.TWITTER_APK_PATH || './apks/twitter.apk',
    autoInstall: process.env.AUTO_INSTALL_TWITTER === 'true',
  },
  {
    name: 'Facebook',
    packageName: 'com.facebook.katana',
    apkPath: process.env.FACEBOOK_APK_PATH || './apks/facebook.apk',
    autoInstall: process.env.AUTO_INSTALL_FACEBOOK === 'true',
  },
  {
    name: 'Instagram',
    packageName: 'com.instagram.android',
    apkPath: process.env.INSTAGRAM_APK_PATH || './apks/instagram.apk',
    autoInstall: process.env.AUTO_INSTALL_INSTAGRAM === 'true',
  },
  {
    name: 'Telegram',
    packageName: 'org.telegram.messenger',
    apkPath: process.env.TELEGRAM_APK_PATH || './apks/telegram.apk',
    autoInstall: process.env.AUTO_INSTALL_TELEGRAM === 'true',
  },
  {
    name: 'TikTok',
    packageName: 'com.zhiliaoapp.musically',
    apkPath: process.env.TIKTOK_APK_PATH || './apks/tiktok.apk',
    autoInstall: process.env.AUTO_INSTALL_TIKTOK === 'true',
  },
];

// Get apps to auto-install
export function getAutoInstallApps(): AppConfig[] {
  return APPS_CONFIG.filter(app => app.autoInstall);
}

// Get app by package name
export function getAppByPackageName(packageName: string): AppConfig | undefined {
  return APPS_CONFIG.find(app => app.packageName === packageName);
}

// Get app by name
export function getAppByName(name: string): AppConfig | undefined {
  return APPS_CONFIG.find(app => app.name.toLowerCase() === name.toLowerCase());
}

export default APPS_CONFIG;
