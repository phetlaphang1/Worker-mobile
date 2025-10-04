import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Activity,
  Smartphone,
  PlayCircle,
  StopCircle,
  RefreshCw,
  TrendingUp,
  Zap,
  Monitor,
  Code,
  Send,
} from 'lucide-react';
import axios from 'axios';
import { useMobileLDPlayer } from '../../hooks/use-mobile-ldplayer';

interface Profile {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  port?: number;
  instanceName?: string;
}

interface Stats {
  profiles: {
    total: number;
    active: number;
    inactive: number;
  };
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  instances: {
    total: number;
    running: number;
    stopped: number;
  };
}

interface Task {
  id: string;
  profileId: string;
  scriptName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt?: string;
}

interface AppiumTask {
  id: string;
  profileId: string;
  scriptCode: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  logs?: string[];
  startedAt?: string;
  completedAt?: string;
}

export function Dashboard() {
  const { isMobile } = useMobileLDPlayer();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appiumTasks, setAppiumTasks] = useState<AppiumTask[]>([]);
  const [stats, setStats] = useState<Stats>({
    profiles: { total: 0, active: 0, inactive: 0 },
    tasks: { total: 0, pending: 0, running: 0, completed: 0, failed: 0 },
    instances: { total: 0, running: 0, stopped: 0 },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const [scriptCode, setScriptCode] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  // Fetch all data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [profilesRes, tasksRes, statsRes, appiumTasksRes] = await Promise.all([
        axios.get<Profile[]>('http://localhost:5051/api/profiles'),
        axios.get<Task[]>('http://localhost:5051/api/scripts'),
        axios.get<Stats>('http://localhost:5051/api/statistics'),
        axios.get<AppiumTask[]>('http://localhost:5051/api/appium/tasks'),
      ]);

      setProfiles(profilesRes.data || []);
      setTasks(tasksRes.data || []);
      setStats(statsRes.data || stats);
      setAppiumTasks(appiumTasksRes.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto refresh every 5 seconds
  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Bulk actions
  const handleLaunchAll = async () => {
    const inactiveProfiles = profiles.filter((p) => p.status === 'inactive');
    for (const profile of inactiveProfiles) {
      try {
        await axios.post(`http://localhost:5051/api/profiles/${profile.id}/activate`);
      } catch (error) {
        console.error(`Failed to launch ${profile.name}:`, error);
      }
    }
    await fetchData();
  };

  const handleStopAll = async () => {
    const activeProfiles = profiles.filter((p) => p.status === 'active');
    for (const profile of activeProfiles) {
      try {
        await axios.post(`http://localhost:5051/api/profiles/${profile.id}/deactivate`);
      } catch (error) {
        console.error(`Failed to stop ${profile.name}:`, error);
      }
    }
    await fetchData();
  };

  // Execute Appium script
  const executeScript = async () => {
    if (!selectedProfileId || !scriptCode.trim()) {
      alert('Please select a profile and enter script code');
      return;
    }

    try {
      await axios.post('http://localhost:5051/api/appium/execute', {
        profileId: selectedProfileId,
        scriptCode: scriptCode,
      });

      setScriptCode('');
      setShowScriptEditor(false);
      await fetchData();
      alert('Script submitted successfully!');
    } catch (error) {
      console.error('Failed to execute script:', error);
      alert('Failed to execute script');
    }
  };

  const activeProfiles = profiles.filter((p) => p.status === 'active');
  const recentTasks = [...tasks, ...appiumTasks].slice(0, 5);

  return (
    <div className="h-full w-full overflow-auto p-4 pb-20 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Monitor className="w-8 h-8 text-blue-500" />
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              LDPlayer Instances Control Center
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'} gap-4 mb-6`}>
        {/* Total Instances */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Instances
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.profiles.total}
                </p>
              </div>
              <Smartphone className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {/* Active Instances */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Running</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.profiles.active}</p>
              </div>
              <PlayCircle className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        {/* Tasks Running */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Tasks Running
                </p>
                <p className="text-3xl font-bold text-orange-600 mt-1">{stats.tasks.running}</p>
              </div>
              <Zap className="w-10 h-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        {/* Tasks Completed */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {stats.tasks.completed}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'} gap-3`}>
            <Button
              onClick={handleLaunchAll}
              className="bg-green-600 hover:bg-green-700"
              disabled={profiles.every((p) => p.status === 'active')}
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Launch All Inactive
            </Button>
            <Button
              onClick={handleStopAll}
              variant="destructive"
              disabled={profiles.every((p) => p.status === 'inactive')}
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Stop All Active
            </Button>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = '/')}>
              <Smartphone className="w-4 h-4 mr-2" />
              Manage Profiles
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowScriptEditor(!showScriptEditor)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Code className="w-4 h-4 mr-2" />
              {showScriptEditor ? 'Hide' : 'Show'} Script Editor
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Script Editor Card */}
      {showScriptEditor && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-500" />
              Appium Script Editor (Puppeteer-style)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Profile selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Select Profile
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">-- Select a profile --</option>
                  {activeProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} (Port: {profile.port})
                    </option>
                  ))}
                </select>
              </div>

              {/* Script code editor */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  JavaScript Code
                </label>
                <textarea
                  value={scriptCode}
                  onChange={(e) => setScriptCode(e.target.value)}
                  placeholder={`// Example script:
await helpers.launchApp('com.twitter.android', '.MainActivity');
await helpers.sleep(3000);

// Tap at coordinates
await helpers.tapAt(200, 300);

// Type text
const searchBox = await driver.$('//android.widget.EditText');
await searchBox.setValue('Hello from Appium!');

// Scroll
await helpers.scrollDown();

// Take screenshot
const screenshot = await helpers.screenshot();
log('Screenshot taken!');

// Return result
return { success: true, message: 'Script completed!' };`}
                  className="w-full h-64 p-3 font-mono text-sm border rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              {/* Execute button */}
              <Button
                onClick={executeScript}
                disabled={!selectedProfileId || !scriptCode.trim()}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Execute Script
              </Button>

              {/* Helper info */}
              <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded">
                <p className="font-semibold mb-2">Available helpers:</p>
                <ul className="space-y-1">
                  <li>• <code>helpers.launchApp(packageName, activityName)</code></li>
                  <li>• <code>helpers.tap(selector)</code> - Tap element by selector</li>
                  <li>• <code>helpers.tapAt(x, y)</code> - Tap at coordinates</li>
                  <li>• <code>helpers.type(selector, text)</code> - Type text</li>
                  <li>• <code>helpers.swipe(x1, y1, x2, y2, duration)</code></li>
                  <li>• <code>helpers.scrollDown()</code>, <code>helpers.scrollUp()</code></li>
                  <li>• <code>helpers.sleep(ms)</code> - Wait for milliseconds</li>
                  <li>• <code>helpers.screenshot()</code> - Take screenshot</li>
                  <li>• <code>driver.$(selector)</code> - Find element</li>
                  <li>• <code>driver.$$(selector)</code> - Find all elements</li>
                  <li>• <code>log(message)</code> - Console log</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Instances */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-green-500" />
            Active Instances ({activeProfiles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeProfiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No active instances. Launch profiles to see them here.
            </div>
          ) : (
            <div className="space-y-3">
              {activeProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{profile.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Port: {profile.port || 'N/A'} • {profile.instanceName || profile.id}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await axios.post(
                          `http://localhost:5051/api/profiles/${profile.id}/deactivate`
                        );
                        await fetchData();
                      } catch (error) {
                        console.error('Failed to stop profile:', error);
                      }
                    }}
                  >
                    <StopCircle className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Recent Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No tasks yet. Execute scripts to see activity here.
            </div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => {
                const isAppiumTask = 'scriptCode' in task;
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                        {isAppiumTask ? (
                          <>
                            <Code className="w-4 h-4 text-blue-500" />
                            Appium Script
                          </>
                        ) : (
                          task.scriptName
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Profile: {task.profileId.slice(0, 20)}...
                        {isAppiumTask && task.error && (
                          <span className="text-red-500 ml-2">Error: {task.error}</span>
                        )}
                      </p>
                      {isAppiumTask && task.logs && task.logs.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last log: {task.logs[task.logs.length - 1]}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        task.status === 'completed'
                          ? 'default'
                          : task.status === 'running'
                          ? 'secondary'
                          : task.status === 'failed'
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {task.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
