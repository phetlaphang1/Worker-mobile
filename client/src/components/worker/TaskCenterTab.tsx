import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Download, RefreshCw, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import axios from 'axios';

interface Task {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedProfile?: string;
  createdAt?: string;
  scriptData?: any;
}

interface Profile {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export function TaskCenterTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [taskCenterUrl, setTaskCenterUrl] = useState(
    localStorage.getItem('taskCenterUrl') || 'http://localhost:3000'
  );

  const API_BASE = 'http://localhost:5051/api';

  // Fetch tasks from Task Center
  const fetchTasksFromCenter = async () => {
    try {
      setIsLoading(true);
      // Mock fetch - thay bằng API thật
      const response = await axios.get(`${API_BASE}/tasks`);
      setTasks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch profiles
  const fetchProfiles = async () => {
    try {
      const response = await axios.get(`${API_BASE}/profiles`);
      setProfiles(response.data || []);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  };

  // Run task on profile
  const handleRunTask = async (taskId: string, profileId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      await axios.post(`${API_BASE}/profiles/${profileId}/execute-script`, {
        scriptType: task.type || 'twitter',
        scriptName: task.name,
        scriptData: task.scriptData || {}
      });

      // Update task status
      setTasks(tasks.map(t =>
        t.id === taskId
          ? { ...t, status: 'running', assignedProfile: profileId }
          : t
      ));
    } catch (error) {
      console.error('Failed to run task:', error);
      alert('Chạy task thất bại!');
    }
  };

  // Auto assign task to available profile
  const handleAutoAssign = async (taskId: string) => {
    const availableProfile = profiles.find(p => p.status === 'active');
    if (!availableProfile) {
      alert('Không có profile nào đang active!');
      return;
    }
    await handleRunTask(taskId, availableProfile.id);
  };

  useEffect(() => {
    fetchTasksFromCenter();
    fetchProfiles();

    const interval = setInterval(() => {
      fetchTasksFromCenter();
      fetchProfiles();
    }, 10000); // Refresh every 10s

    return () => clearInterval(interval);
  }, []);

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const runningTasks = tasks.filter(t => t.status === 'running');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const activeProfiles = profiles.filter(p => p.status === 'active');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Task Center</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nhận và quản lý tasks từ Task Center
          </p>
        </div>
        <Button onClick={fetchTasksFromCenter} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Task Center URL */}
      <Card>
        <CardHeader>
          <CardTitle>Task Center Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="http://localhost:3000/api/tasks"
              value={taskCenterUrl}
              onChange={(e) => {
                setTaskCenterUrl(e.target.value);
                localStorage.setItem('taskCenterUrl', e.target.value);
              }}
              className="flex-1"
            />
            <Button onClick={fetchTasksFromCenter} className="bg-blue-600">
              <Download className="w-4 h-4 mr-2" />
              Fetch Tasks
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-gray-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-amber-600" />
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{pendingTasks.length}</p>
              <p className="text-sm text-amber-600 dark:text-amber-500 font-medium">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <Play className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{runningTasks.length}</p>
              <p className="text-sm text-blue-600 dark:text-blue-500 font-medium">Running</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-gray-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{completedTasks.length}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-500 font-medium">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-gray-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <Play className="w-8 h-8 mx-auto mb-2 text-violet-600" />
              <p className="text-3xl font-bold text-violet-700 dark:text-violet-400">{activeProfiles.length}</p>
              <p className="text-sm text-violet-600 dark:text-violet-500 font-medium">Active Profiles</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Tasks ({pendingTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Không có task pending
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {task.name}
                    </h3>
                    <p className="text-sm text-gray-500">Type: {task.type}</p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="px-3 py-2 border rounded-md text-sm"
                      onChange={(e) => handleRunTask(task.id, e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Chọn profile...
                      </option>
                      {activeProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={() => handleAutoAssign(task.id)}>
                      <Play className="w-4 h-4 mr-1" />
                      Auto
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Running Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Running Tasks ({runningTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {runningTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Không có task đang chạy
            </div>
          ) : (
            <div className="space-y-3">
              {runningTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {task.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Profile: {task.assignedProfile?.slice(0, 20)}...
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Running</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Completed Tasks ({completedTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {completedTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Chưa có task hoàn thành
            </div>
          ) : (
            <div className="space-y-3">
              {completedTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {task.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Badge>Completed</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
