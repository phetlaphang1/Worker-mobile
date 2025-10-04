import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Smartphone,
  Plus,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Settings,
  Copy,
  Download,
  Package,
  CheckCircle2,
  Code,
  Zap,
} from 'lucide-react';
import axios from 'axios';

interface Profile {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  port?: number;
  instanceName?: string;
  settings?: {
    resolution?: string;
    cpu?: number;
    memory?: number;
  };
  apps?: any;
}

interface AvailableApp {
  name: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  packageName?: string;
}

export function ProfilesTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [availableApps, setAvailableApps] = useState<AvailableApp[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  // Script execution states
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedScript, setSelectedScript] = useState('');
  const [scriptData, setScriptData] = useState<Record<string, any>>({});

  // Auto-run scripts for new profile
  const [assignedScripts, setAssignedScripts] = useState<Array<{
    scriptName: string;
    scriptData: Record<string, any>;
  }>>([]);
  const [showAddScriptForm, setShowAddScriptForm] = useState(false);
  const [tempScript, setTempScript] = useState('');
  const [tempScriptData, setTempScriptData] = useState<Record<string, any>>({});

  // Settings modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsProfile, setSettingsProfile] = useState<Profile | null>(null);
  const [profileSettings, setProfileSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const API_BASE = 'http://localhost:5051/api';

  // Fetch profiles
  const fetchProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get<Profile[]>(`${API_BASE}/profiles`);
      setProfiles(response.data || []);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available apps
  const fetchAvailableApps = async () => {
    try {
      const response = await axios.get<AvailableApp[]>(`${API_BASE}/apps/available`);
      setAvailableApps(response.data || []);
    } catch (error) {
      console.error('Failed to fetch available apps:', error);
      setAvailableApps([]);
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
          memory: 2048,
        },
        selectedApps: selectedApps,
        autoRunScripts: assignedScripts, // Scripts to auto-run on launch
      });
      setNewProfileName('');
      setSelectedApps([]);
      setAssignedScripts([]);
      setShowCreateModal(false);
      await fetchProfiles();
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Tạo profile thất bại!');
    }
  };

  // Add script to assigned scripts list
  const handleAddScript = () => {
    if (!tempScript) return;

    setAssignedScripts([...assignedScripts, {
      scriptName: tempScript,
      scriptData: { ...tempScriptData }
    }]);

    setTempScript('');
    setTempScriptData({});
    setShowAddScriptForm(false);
  };

  // Remove script from assigned list
  const handleRemoveScript = (index: number) => {
    setAssignedScripts(assignedScripts.filter((_, i) => i !== index));
  };

  // Toggle app selection
  const toggleAppSelection = (fileName: string) => {
    setSelectedApps((prev) =>
      prev.includes(fileName) ? prev.filter((f) => f !== fileName) : [...prev, fileName]
    );
  };

  // Select all apps
  const selectAllApps = () => {
    setSelectedApps(availableApps.map((app) => app.fileName));
  };

  // Deselect all apps
  const deselectAllApps = () => {
    setSelectedApps([]);
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

  // Open settings modal
  const handleOpenSettings = async (profile: Profile) => {
    setSettingsProfile(profile);
    setShowSettingsModal(true);
    setLoadingSettings(true);

    try {
      const response = await axios.get(`${API_BASE}/profiles/${profile.id}/settings`);
      setProfileSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      alert('Không thể tải cài đặt!');
    } finally {
      setLoadingSettings(false);
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    if (!settingsProfile || !profileSettings) return;

    try {
      await axios.put(`${API_BASE}/profiles/${settingsProfile.id}/settings`, profileSettings);
      alert('Đã lưu cài đặt!');
      setShowSettingsModal(false);
      await fetchProfiles();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Lưu cài đặt thất bại!');
    }
  };

  // Add script to settings
  const handleAddScriptToSettings = () => {
    if (!tempScript) return;

    const newScript = {
      scriptName: tempScript,
      scriptData: tempScriptData || {}
    };

    const updatedScripts = [...(profileSettings?.autoRunScripts || []), newScript];
    setProfileSettings({
      ...profileSettings,
      autoRunScripts: updatedScripts
    });

    setTempScript('');
    setTempScriptData({});
    setShowAddScriptForm(false);
  };

  // Remove script from settings
  const handleRemoveScriptFromSettings = (scriptName: string) => {
    const updatedScripts = profileSettings?.autoRunScripts?.filter(
      (s: any) => s.scriptName !== scriptName
    ) || [];

    setProfileSettings({
      ...profileSettings,
      autoRunScripts: updatedScripts
    });
  };

  // Launch all inactive
  const handleLaunchAll = async () => {
    const inactive = profiles.filter((p) => p.status === 'inactive');
    for (const profile of inactive) {
      try {
        await axios.post(`${API_BASE}/profiles/${profile.id}/activate`);
      } catch (error) {
        console.error(`Failed to launch ${profile.name}:`, error);
      }
    }
    await fetchProfiles();
  };

  // Stop all active
  const handleStopAll = async () => {
    const active = profiles.filter((p) => p.status === 'active');
    for (const profile of active) {
      try {
        await axios.post(`${API_BASE}/profiles/${profile.id}/deactivate`);
      } catch (error) {
        console.error(`Failed to stop ${profile.name}:`, error);
      }
    }
    await fetchProfiles();
  };

  // Execute script on profile
  const handleExecuteScript = async () => {
    if (!selectedProfile || !selectedScript) return;

    try {
      await axios.post(`${API_BASE}/profiles/${selectedProfile.id}/execute-script`, {
        scriptType: 'twitter',
        scriptName: selectedScript,
        scriptData,
      });
      alert(`Script "${selectedScript}" đã được thêm vào hàng đợi cho ${selectedProfile.name}`);
      setShowScriptModal(false);
      setSelectedScript('');
      setScriptData({});
    } catch (error) {
      console.error('Failed to execute script:', error);
      alert('Thực thi script thất bại!');
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchAvailableApps();
    const interval = setInterval(fetchProfiles, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = profiles.filter((p) => p.status === 'active').length;
  const inactiveCount = profiles.filter((p) => p.status === 'inactive').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profiles</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Quản lý LDPlayer instances
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchProfiles} variant="outline" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600">
            <Plus className="w-4 h-4 mr-2" />
            New Profile
          </Button>
        </div>
      </div>

      {/* Stats & Actions */}
      <Card className="bg-gradient-to-r from-blue-50 via-white to-purple-50 dark:from-blue-950/20 dark:via-gray-800 dark:to-purple-950/20 border-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</p>
                <p className="text-3xl font-bold text-blue-600">{profiles.length}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active</p>
                <p className="text-3xl font-bold text-emerald-600">{activeCount}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Inactive</p>
                <p className="text-3xl font-bold text-gray-500">{inactiveCount}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleLaunchAll}
                disabled={inactiveCount === 0}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg"
              >
                <Play className="w-4 h-4 mr-2" />
                Launch All ({inactiveCount})
              </Button>
              <Button
                onClick={handleStopAll}
                disabled={activeCount === 0}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop All ({activeCount})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {profiles.map((profile) => (
          <Card key={profile.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone
                    className={`w-5 h-5 ${
                      profile.status === 'active' ? 'text-green-500' : 'text-gray-400'
                    }`}
                  />
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                </div>
                <Badge variant={profile.status === 'active' ? 'default' : 'secondary'}>
                  {profile.status === 'active' ? 'Running' : 'Stopped'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Info */}
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Port:</span>
                  <span className="font-mono">{profile.port || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Instance:</span>
                  <span className="font-mono text-xs">
                    {profile.instanceName?.slice(0, 15) || 'N/A'}
                  </span>
                </div>
                {profile.settings && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Resolution:</span>
                    <span>{profile.settings.resolution || 'N/A'}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {profile.status === 'inactive' ? (
                  <Button
                    onClick={() => handleLaunch(profile.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Launch
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleStop(profile.id)}
                    className="flex-1"
                    variant="destructive"
                    size="sm"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenSettings(profile)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(profile.id, profile.name)}
                  variant="outline"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Run Script Button */}
              {profile.status === 'active' && (
                <Button
                  onClick={() => {
                    setSelectedProfile(profile);
                    setShowScriptModal(true);
                  }}
                  className="w-full mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="sm"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Run Script
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {profiles.length === 0 && (
        <Card className="py-12">
          <div className="text-center">
            <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No profiles yet
            </h3>
            <p className="text-gray-500 mb-4">Create your first LDPlayer profile to get started</p>
            <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Profile
            </Button>
          </div>
        </Card>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8">
            <Card className="w-full shadow-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <CardHeader className="border-b-2 bg-white dark:bg-gray-800 sticky top-0 z-10">
                <CardTitle className="flex items-center gap-3 text-xl text-gray-900 dark:text-white">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-bold">
                    Create New Profile
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 max-h-[calc(90vh-120px)] overflow-y-auto bg-white dark:bg-gray-900">
              {/* Profile Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Smartphone className="w-4 h-4 inline mr-2" />
                  Profile Name
                </label>
                <Input
                  placeholder="Enter profile name..."
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && selectedApps.length > 0 && handleCreateProfile()}
                  autoFocus
                  className="text-lg"
                />
              </div>

              {/* Apps Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium">
                    <Package className="w-4 h-4 inline mr-2" />
                    Chọn Apps Cài Sẵn ({selectedApps.length}/{availableApps.length})
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selectAllApps}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={deselectAllApps}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {availableApps.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed">
                    <Download className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-2">
                      Chưa có APK nào trong folder apks/
                    </p>
                    <p className="text-xs text-gray-400">
                      Download APK từ apkmirror.com và đặt vào Worker-mobile/apks/
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    {availableApps.map((app) => {
                      const isSelected = selectedApps.includes(app.fileName);
                      return (
                        <div
                          key={app.fileName}
                          onClick={() => toggleAppSelection(app.fileName)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                isSelected ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{app.name}</p>
                              <p className="text-xs text-gray-500 truncate">{app.packageName}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {(app.fileSize / 1024 / 1024).toFixed(1)} MB
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Summary */}
              {selectedApps.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    ✅ <strong>{selectedApps.length} apps</strong> sẽ được cài tự động khi launch
                    instance
                  </p>
                </div>
              )}

              {/* Auto-Run Scripts Section */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium">
                    <Zap className="w-4 h-4 inline mr-2 text-purple-600" />
                    Auto-Run Scripts (Tùy chọn)
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddScriptForm(!showAddScriptForm)}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Script
                  </Button>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  Scripts sẽ tự động chạy khi launch instance. Để trống nếu không cần.
                </p>

                {/* Assigned Scripts List */}
                {assignedScripts.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {assignedScripts.map((script, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{script.scriptName}</p>
                          <p className="text-xs text-gray-500">
                            {Object.keys(script.scriptData).length > 0 &&
                              Object.entries(script.scriptData).map(([key, val]) => `${key}: ${val}`).join(', ')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveScript(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Script Form */}
                {showAddScriptForm && (
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed">
                    <div>
                      <label className="text-sm font-medium">Chọn Script:</label>
                      <select
                        value={tempScript}
                        onChange={(e) => {
                          setTempScript(e.target.value);
                          setTempScriptData({});
                        }}
                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
                      >
                        <option value="">-- Choose Script --</option>
                        <optgroup label="📖 Reading">
                          <option value="readTimeline">Read Timeline</option>
                          <option value="searchAndRead">Search & Read</option>
                        </optgroup>
                        <optgroup label="❤️ Caring">
                          <option value="likeTweets">Like Tweets</option>
                          <option value="retweetTweets">Retweet Tweets</option>
                          <option value="followUsers">Follow Users</option>
                        </optgroup>
                        <optgroup label="✍️ Posting">
                          <option value="postTweet">Post Tweet</option>
                        </optgroup>
                      </select>
                    </div>

                    {/* Script Parameters */}
                    {tempScript && (
                      <>
                        {['readTimeline', 'likeTweets', 'retweetTweets'].includes(tempScript) && (
                          <div>
                            <label className="text-sm">Count:</label>
                            <Input
                              type="number"
                              placeholder="10"
                              value={tempScriptData.count || ''}
                              onChange={(e) => setTempScriptData({ ...tempScriptData, count: parseInt(e.target.value) })}
                            />
                          </div>
                        )}

                        {['searchAndRead', 'likeTweets', 'retweetTweets'].includes(tempScript) && (
                          <div>
                            <label className="text-sm">Search Query:</label>
                            <Input
                              placeholder="bitcoin OR crypto"
                              value={tempScriptData.searchQuery || tempScriptData.query || ''}
                              onChange={(e) => setTempScriptData({ ...tempScriptData, searchQuery: e.target.value, query: e.target.value })}
                            />
                          </div>
                        )}

                        {tempScript === 'postTweet' && (
                          <div>
                            <label className="text-sm">Tweet Text:</label>
                            <Input
                              placeholder="What's happening?"
                              value={tempScriptData.text || ''}
                              onChange={(e) => setTempScriptData({ ...tempScriptData, text: e.target.value })}
                            />
                          </div>
                        )}

                        {tempScript === 'followUsers' && (
                          <div>
                            <label className="text-sm">Username:</label>
                            <Input
                              placeholder="@elonmusk"
                              value={tempScriptData.username || ''}
                              onChange={(e) => setTempScriptData({ ...tempScriptData, username: e.target.value })}
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddScriptForm(false);
                          setTempScript('');
                          setTempScriptData({});
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddScript}
                        disabled={!tempScript}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                {assignedScripts.length > 0 && (
                  <div className="mt-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                    <p className="text-sm text-purple-900 dark:text-purple-100">
                      ⚡ <strong>{assignedScripts.length} script(s)</strong> sẽ tự động chạy khi launch instance
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => {
                  setShowCreateModal(false);
                  setNewProfileName('');
                  setSelectedApps([]);
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProfile}
                  disabled={!newProfileName.trim()}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Profile
                </Button>
              </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Script Execution Modal */}
      {showScriptModal && selectedProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl">
            <Card className="w-full shadow-2xl border-2 bg-white dark:bg-gray-900">
              <CardHeader className="border-b-2 bg-white dark:bg-gray-800">
                <CardTitle className="flex items-center gap-3 text-xl text-gray-900 dark:text-white">
                  <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
                    <Code className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="font-bold">Run Script</span>
                    <p className="text-sm text-gray-500 font-normal">
                      Profile: {selectedProfile.name}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {/* Script Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Code className="w-4 h-4 inline mr-2" />
                    Select Script
                  </label>
                  <select
                    value={selectedScript}
                    onChange={(e) => {
                      setSelectedScript(e.target.value);
                      setScriptData({});
                    }}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
                  >
                    <option value="">-- Choose Script --</option>
                    <optgroup label="📖 Reading Scripts">
                      <option value="readTimeline">Read Timeline</option>
                      <option value="readNotifications">Read Notifications</option>
                      <option value="searchAndRead">Search & Read</option>
                    </optgroup>
                    <optgroup label="❤️ Caring Scripts">
                      <option value="likeTweets">Like Tweets</option>
                      <option value="retweetTweets">Retweet Tweets</option>
                      <option value="followUsers">Follow Users</option>
                    </optgroup>
                    <optgroup label="✍️ Posting Scripts">
                      <option value="postTweet">Post Tweet</option>
                      <option value="replyToTweets">Reply to Tweets</option>
                    </optgroup>
                  </select>
                </div>

                {/* Script Parameters */}
                {selectedScript && (
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium">Script Parameters:</p>

                    {/* Common parameters */}
                    {['readTimeline', 'readNotifications', 'likeTweets', 'retweetTweets'].includes(selectedScript) && (
                      <div>
                        <label className="text-sm">Count:</label>
                        <Input
                          type="number"
                          placeholder="10"
                          value={scriptData.count || ''}
                          onChange={(e) => setScriptData({ ...scriptData, count: parseInt(e.target.value) })}
                        />
                      </div>
                    )}

                    {/* Search query */}
                    {['searchAndRead', 'likeTweets', 'retweetTweets'].includes(selectedScript) && (
                      <div>
                        <label className="text-sm">Search Query:</label>
                        <Input
                          placeholder="bitcoin OR crypto"
                          value={scriptData.searchQuery || scriptData.query || ''}
                          onChange={(e) => setScriptData({ ...scriptData, searchQuery: e.target.value, query: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Tweet text */}
                    {selectedScript === 'postTweet' && (
                      <div>
                        <label className="text-sm">Tweet Text:</label>
                        <textarea
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
                          rows={3}
                          placeholder="What's happening?"
                          value={scriptData.text || ''}
                          onChange={(e) => setScriptData({ ...scriptData, text: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Follow username */}
                    {selectedScript === 'followUsers' && (
                      <div>
                        <label className="text-sm">Username to Follow:</label>
                        <Input
                          placeholder="@elonmusk"
                          value={scriptData.username || ''}
                          onChange={(e) => setScriptData({ ...scriptData, username: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowScriptModal(false);
                      setSelectedScript('');
                      setScriptData({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExecuteScript}
                    disabled={!selectedScript}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Execute Script
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && settingsProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Cài đặt Profile: {settingsProfile.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {loadingSettings ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p>Đang tải cài đặt...</p>
                  </div>
                ) : profileSettings ? (
                  <>
                    {/* Auto-run Scripts Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Code className="w-5 h-5" />
                          Scripts Tự Động Chạy
                        </h3>
                        <Button
                          size="sm"
                          onClick={() => setShowAddScriptForm(!showAddScriptForm)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Thêm Script
                        </Button>
                      </div>

                      {/* Add Script Form */}
                      {showAddScriptForm && (
                        <Card className="bg-gray-800 border-gray-700 p-4">
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm text-gray-400">Tên Script</label>
                              <Input
                                value={tempScript}
                                onChange={(e) => setTempScript(e.target.value)}
                                placeholder="vd: likeTweets, postTweet"
                                className="bg-gray-900 border-gray-700"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-gray-400">Script Data (JSON)</label>
                              <Input
                                value={JSON.stringify(tempScriptData)}
                                onChange={(e) => {
                                  try {
                                    setTempScriptData(JSON.parse(e.target.value || '{}'));
                                  } catch {}
                                }}
                                placeholder='{"param1": "value1"}'
                                className="bg-gray-900 border-gray-700"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleAddScriptToSettings}>
                                Thêm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShowAddScriptForm(false);
                                  setTempScript('');
                                  setTempScriptData({});
                                }}
                              >
                                Hủy
                              </Button>
                            </div>
                          </div>
                        </Card>
                      )}

                      {/* Scripts List */}
                      {profileSettings.autoRunScripts && profileSettings.autoRunScripts.length > 0 ? (
                        <div className="space-y-2">
                          {profileSettings.autoRunScripts.map((script: any, idx: number) => (
                            <Card key={idx} className="bg-gray-800 border-gray-700 p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">{script.scriptName}</p>
                                  {script.scriptData && Object.keys(script.scriptData).length > 0 && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      {JSON.stringify(script.scriptData)}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRemoveScriptFromSettings(script.scriptName)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">Chưa có script nào được cấu hình</p>
                      )}
                    </div>

                    {/* Hardware Info */}
                    <div className="space-y-2 pt-4 border-t border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-400">Thông tin phần cứng</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-400">Resolution:</span> {profileSettings.hardware?.resolution}
                        </div>
                        <div>
                          <span className="text-gray-400">DPI:</span> {profileSettings.hardware?.dpi}
                        </div>
                        <div>
                          <span className="text-gray-400">CPU:</span> {profileSettings.hardware?.cpu} cores
                        </div>
                        <div>
                          <span className="text-gray-400">RAM:</span> {profileSettings.hardware?.memory} MB
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-red-400">Không thể tải cài đặt</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-4 border-t border-gray-800">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSettingsModal(false);
                      setSettingsProfile(null);
                      setProfileSettings(null);
                    }}
                  >
                    Đóng
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={loadingSettings}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Lưu Cài Đặt
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
