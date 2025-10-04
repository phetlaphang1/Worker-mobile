import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  PlayCircle,
  StopCircle,
  Trash2,
  Plus,
  RefreshCw,
  Smartphone,
  Power
} from 'lucide-react';
import axios from 'axios';

interface Profile {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  port?: number;
  instanceName?: string;
}

export function InstanceControl() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  const API_BASE = 'http://localhost:5051/api';

  // Fetch profiles
  const fetchProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get<Profile[]>(`${API_BASE}/profiles`);
      setProfiles(response.data || []);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Create profile
  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      alert('Nhập tên profile!');
      return;
    }

    try {
      await axios.post(`${API_BASE}/profiles`, {
        name: newProfileName.trim(),
        settings: {
          resolution: '720,1280',
          cpu: 2,
          memory: 2048
        }
      });
      setNewProfileName('');
      await fetchProfiles();
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Tạo profile thất bại!');
    }
  };

  // Launch profile
  const handleLaunch = async (profileId: string) => {
    try {
      await axios.post(`${API_BASE}/profiles/${profileId}/activate`);
      await fetchProfiles();
    } catch (error) {
      console.error('Failed to launch:', error);
      alert('Khởi động thất bại!');
    }
  };

  // Stop profile
  const handleStop = async (profileId: string) => {
    try {
      await axios.post(`${API_BASE}/profiles/${profileId}/deactivate`);
      await fetchProfiles();
    } catch (error) {
      console.error('Failed to stop:', error);
      alert('Dừng thất bại!');
    }
  };

  // Delete profile
  const handleDelete = async (profileId: string, profileName: string) => {
    if (!confirm(`Xóa profile "${profileName}"?`)) return;

    try {
      await axios.delete(`${API_BASE}/profiles/${profileId}`);
      await fetchProfiles();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Xóa thất bại!');
    }
  };

  // Launch all
  const handleLaunchAll = async () => {
    const inactiveProfiles = profiles.filter(p => p.status === 'inactive');
    if (inactiveProfiles.length === 0) {
      alert('Không có profile nào để khởi động!');
      return;
    }

    for (const profile of inactiveProfiles) {
      try {
        await axios.post(`${API_BASE}/profiles/${profile.id}/activate`);
      } catch (error) {
        console.error(`Failed to launch ${profile.name}:`, error);
      }
    }
    await fetchProfiles();
  };

  // Stop all
  const handleStopAll = async () => {
    const activeProfiles = profiles.filter(p => p.status === 'active');
    if (activeProfiles.length === 0) {
      alert('Không có profile nào đang chạy!');
      return;
    }

    for (const profile of activeProfiles) {
      try {
        await axios.post(`${API_BASE}/profiles/${profile.id}/deactivate`);
      } catch (error) {
        console.error(`Failed to stop ${profile.name}:`, error);
      }
    }
    await fetchProfiles();
  };

  useEffect(() => {
    fetchProfiles();
    const interval = setInterval(fetchProfiles, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = profiles.filter(p => p.status === 'active').length;
  const inactiveCount = profiles.filter(p => p.status === 'inactive').length;

  return (
    <div className="h-full w-full overflow-auto p-6 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          LDPlayer Instance Control
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Điều khiển tất cả LDPlayer instances
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tổng số</p>
            <p className="text-4xl font-bold text-blue-600">{profiles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Đang chạy</p>
            <p className="text-4xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Đã tắt</p>
            <p className="text-4xl font-bold text-gray-600">{inactiveCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tạo Profile Mới</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Nhập tên profile..."
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateProfile()}
              className="flex-1"
            />
            <Button onClick={handleCreateProfile} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Tạo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Điều Khiển Tất Cả</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              onClick={handleLaunchAll}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={inactiveCount === 0}
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Bật Tất Cả ({inactiveCount})
            </Button>
            <Button
              onClick={handleStopAll}
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={activeCount === 0}
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Tắt Tất Cả ({activeCount})
            </Button>
            <Button onClick={fetchProfiles} variant="outline">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instance List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Danh Sách Instances ({profiles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="text-center py-12">
              <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Chưa có instance nào
              </p>
              <p className="text-sm text-gray-400">
                Tạo profile mới ở trên để bắt đầu
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-4">
                    {/* Status Indicator */}
                    <div className="flex flex-col items-center">
                      <Power
                        className={`w-8 h-8 ${
                          profile.status === 'active'
                            ? 'text-green-500 animate-pulse'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        {profile.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={profile.status === 'active' ? 'default' : 'secondary'}>
                          {profile.status === 'active' ? 'Đang chạy' : 'Đã tắt'}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          Port: {profile.port || 'N/A'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {profile.instanceName || profile.id.slice(0, 12)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {profile.status === 'inactive' ? (
                      <Button
                        onClick={() => handleLaunch(profile.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Bật
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleStop(profile.id)}
                        variant="destructive"
                      >
                        <StopCircle className="w-4 h-4 mr-2" />
                        Tắt
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDelete(profile.id, profile.name)}
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
