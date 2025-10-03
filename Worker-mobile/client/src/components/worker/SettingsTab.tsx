import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Save, Server, Key, Globe, Database } from 'lucide-react';

export function SettingsTab() {
  const [settings, setSettings] = useState({
    taskCenterUrl: localStorage.getItem('taskCenterUrl') || 'http://localhost:3000',
    taskCenterApiKey: localStorage.getItem('taskCenterApiKey') || '',
    ldconsolePath: localStorage.getItem('ldconsolePath') || 'D:\\LDPlayer\\LDPlayer9\\ldconsole.exe',
    adbPath: localStorage.getItem('adbPath') || 'D:\\LDPlayer\\LDPlayer9\\adb.exe',
    autoRefreshInterval: localStorage.getItem('autoRefreshInterval') || '5000',
    maxConcurrentInstances: localStorage.getItem('maxConcurrentInstances') || '5',
  });

  const handleSave = () => {
    // Save to localStorage
    Object.entries(settings).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    alert('Settings saved successfully!');
  };

  const handleChange = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cấu hình hệ thống Worker Mobile
        </p>
      </div>

      {/* Task Center Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Task Center Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Task Center URL</label>
            <Input
              placeholder="http://localhost:3000/api/tasks"
              value={settings.taskCenterUrl}
              onChange={(e) => handleChange('taskCenterUrl', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              URL endpoint để fetch tasks từ Task Center
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <Input
              type="password"
              placeholder="Enter your API key..."
              value={settings.taskCenterApiKey}
              onChange={(e) => handleChange('taskCenterApiKey', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              API key để authenticate với Task Center (optional)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* LDPlayer Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            LDPlayer Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">ldconsole.exe Path</label>
            <Input
              placeholder="D:\LDPlayer\LDPlayer9\ldconsole.exe"
              value={settings.ldconsolePath}
              onChange={(e) => handleChange('ldconsolePath', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Đường dẫn đến ldconsole.exe (để điều khiển LDPlayer)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">adb.exe Path</label>
            <Input
              placeholder="D:\LDPlayer\LDPlayer9\adb.exe"
              value={settings.adbPath}
              onChange={(e) => handleChange('adbPath', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Đường dẫn đến adb.exe (để điều khiển Android)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            System Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Auto Refresh Interval (ms)
            </label>
            <Input
              type="number"
              placeholder="5000"
              value={settings.autoRefreshInterval}
              onChange={(e) => handleChange('autoRefreshInterval', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Thời gian tự động refresh data (milliseconds)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Concurrent Instances
            </label>
            <Input
              type="number"
              placeholder="5"
              value={settings.maxConcurrentInstances}
              onChange={(e) => handleChange('maxConcurrentInstances', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Số lượng instance tối đa chạy cùng lúc
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>

      {/* Info */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            💡 <strong>Note:</strong> Settings are saved to localStorage. For server-side
            configuration, update the <code>.env</code> file in Worker-mobile folder.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
