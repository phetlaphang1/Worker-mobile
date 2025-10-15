import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Shield,
  Calendar,
  Copy,
  Package,
  Key,
  Search,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import UIInspector from "./uiInspector";

interface CustomFieldEditorProps {
  value: string;
  onChange: (value: string) => void;
}

interface ProfileDetailsTabsProps {
  profileData: any;
  formData: any;
  handleInputChange: (field: string, value: any) => void;
  CustomFieldEditor: React.ComponentType<CustomFieldEditorProps>;
  isTaskProfile?: boolean;
}

export default function ProfileDetailsTabs({
  profileData,
  formData,
  handleInputChange,
  CustomFieldEditor,
  isTaskProfile = false,
}: ProfileDetailsTabsProps) {
  const { toast } = useToast();
  const [availableApps, setAvailableApps] = useState<any[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [installingApp, setInstallingApp] = useState<string | null>(null);

  // Fetch available apps
  useEffect(() => {
    fetch('http://localhost:5051/api/apps/available')
      .then(res => res.json())
      .then(data => setAvailableApps(data))
      .catch(err => console.error('Failed to fetch apps:', err));
  }, []);

  const installAppMutation = useMutation({
    mutationFn: async (apkFileName: string) => {
      setInstallingApp(apkFileName);
      const response = await fetch(`http://localhost:5051/api/profiles/${profileData.id}/install-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apkFileName })
      });
      if (!response.ok) throw new Error('Failed to install app');
      return response.json();
    },
    onSuccess: (data, apkFileName) => {
      toast({
        title: "App Installed",
        description: `Successfully installed ${apkFileName}`,
      });
      setInstallingApp(null);
    },
    onError: (error: any, apkFileName) => {
      toast({
        title: "Installation Failed",
        description: `Failed to install ${apkFileName}: ${error.message}`,
        variant: "destructive",
      });
      setInstallingApp(null);
    }
  });

  const testProxyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('http://localhost:5051/api/proxy-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proxyType: formData.proxyType,
          proxyHost: formData.proxyHost,
          proxyPort: formData.proxyPort,
          proxyUsername: formData.proxyUsername,
          proxyPassword: formData.proxyPassword,
          testUrl: 'https://ifconfig.me/ip'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Proxy test failed');
      }

      const result = await response.json();
      return {
        success: true,
        externalIp: result.ip,
        proxyType: formData.proxyType
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Proxy Test Successful",
        description: `Connected through ${data.proxyType} proxy. External IP: ${data.externalIp}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Proxy Test Failed",
        description: error.message || "Failed to connect through proxy",
        variant: "destructive",
      });
    },
  });

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(formData.proxyPassword);
      toast({
        title: "Copied to Clipboard",
        description: "Proxy password copied successfully",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy password to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList
        className="grid w-full grid-cols-5 shrink-0"
        style={{ minWidth: "100%" }}
      >
        <TabsTrigger
          value="general"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <Settings className="h-4 w-4" />
          General
        </TabsTrigger>
        <TabsTrigger
          value="proxy"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <Shield className="h-4 w-4" />
          Proxy
        </TabsTrigger>
        <TabsTrigger
          value="apps"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <Package className="h-4 w-4" />
          Apps
        </TabsTrigger>
        <TabsTrigger
          value="account"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <Key className="h-4 w-4" />
          Account
        </TabsTrigger>
        <TabsTrigger
          value="inspector"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <Search className="h-4 w-4" />
          Inspector
        </TabsTrigger>
        {/* Temporarily disabled - no backend support yet */}
        {/* <TabsTrigger
          value="custom"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <FileText className="h-4 w-4" />
          Custom Field
        </TabsTrigger> */}
      </TabsList>

      <div className="mt-4">
        {/* General Tab */}
        <TabsContent value="general" className="space-y-3 w-full min-w-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="profile-id">Profile ID</Label>
              <Input
                id="profile-id"
                value={profileData.id}
                disabled
                className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={formData.name}
                onChange={(e) =>
                  handleInputChange("name", e.target.value)
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="profile-description">Description</Label>
            <Input
              id="profile-description"
              value={formData.description}
              onChange={(e) =>
                handleInputChange("description", e.target.value)
              }
              placeholder="Enter profile description"
            />
          </div>

          {/* Device Fingerprint Info */}
          {profileData.device && Object.keys(profileData.device).length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Device Fingerprint (Anti-Detect)</h3>
              <div className="grid grid-cols-2 gap-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                {profileData.device.imei && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">IMEI</label>
                    <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{profileData.device.imei}</p>
                  </div>
                )}
                {profileData.device.androidId && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Android ID</label>
                    <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{profileData.device.androidId}</p>
                  </div>
                )}
                {profileData.device.brand && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Brand</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{profileData.device.brand}</p>
                  </div>
                )}
                {profileData.device.manufacturer && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Manufacturer</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{profileData.device.manufacturer}</p>
                  </div>
                )}
                {profileData.device.model && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Device Model</label>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{profileData.device.model}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instance Hardware Settings */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Instance Hardware Settings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="resolution">Screen Resolution</Label>
                <Select
                  value={formData.resolution}
                  onValueChange={(value) => handleInputChange("resolution", value)}
                >
                  <SelectTrigger id="resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="360,640">360x640 (Low)</SelectItem>
                    <SelectItem value="720,1280">720x1280 (HD)</SelectItem>
                    <SelectItem value="1080,1920">1080x1920 (Full HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cpu">CPU Cores</Label>
                <Select
                  value={String(formData.cpu)}
                  onValueChange={(value) => handleInputChange("cpu", parseInt(value))}
                >
                  <SelectTrigger id="cpu">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Core</SelectItem>
                    <SelectItem value="2">2 Cores</SelectItem>
                    <SelectItem value="3">3 Cores</SelectItem>
                    <SelectItem value="4">4 Cores</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="memory">Memory (MB)</Label>
                <Select
                  value={String(formData.memory)}
                  onValueChange={(value) => handleInputChange("memory", parseInt(value))}
                >
                  <SelectTrigger id="memory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="512">512 MB</SelectItem>
                    <SelectItem value="1024">1 GB</SelectItem>
                    <SelectItem value="2048">2 GB</SelectItem>
                    <SelectItem value="4096">4 GB</SelectItem>
                    <SelectItem value="8192">8 GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">                      
            <div className="flex items-center space-x-2">
              <Switch 
                id="incognito-mode" 
                checked={formData.isIncognito}
                onCheckedChange={(checked) => handleInputChange("isIncognito", checked)}
              />
              <Label htmlFor="incognito-mode">Incognito Mode</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="headless-mode" 
                checked={formData.isHeadless}
                onCheckedChange={(checked) => handleInputChange("isHeadless", checked)}
              />
              <Label htmlFor="headless-mode">Headless Mode</Label>
            </div>
          </div>
          {isTaskProfile && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <Label htmlFor="local-worker-id">Local Worker ID</Label>
                <Input
                  id="local-worker-id"
                  value={profileData.localWorkerId || profileData.localWorerkId || ""}
                  disabled
                  className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="local-profile-id">Local Profile ID</Label>
                <Input
                  id="local-profile-id"
                  value={profileData.localProfileId || ""}
                  disabled
                  className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(profileData.createdAt).toLocaleString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Last Updated
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {profileData.updatedAt 
                  ? new Date(profileData.updatedAt).toLocaleString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )
                  : ""
                }
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Proxy Tab */}
        <TabsContent value="proxy" className="space-y-3 w-full min-w-0">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="use-proxy"
                checked={formData.useProxy}
                onCheckedChange={(checked) =>
                  handleInputChange("useProxy", checked)
                }
              />
              <Label htmlFor="use-proxy">Enable Proxy</Label>
            </div>

            {formData.useProxy && (
              <>
                <div>
                  <Label htmlFor="proxy-type">Proxy Type</Label>
                  <Select
                    value={formData.proxyType}
                    onValueChange={(value) =>
                      handleInputChange("proxyType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select proxy type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="https">HTTPS</SelectItem>
                      <SelectItem value="socks4">SOCKS4</SelectItem>
                      <SelectItem value="socks5">SOCKS5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="proxy-host">Proxy Host</Label>
                    <Input
                      id="proxy-host"
                      value={formData.proxyHost}
                      onChange={(e) =>
                        handleInputChange("proxyHost", e.target.value)
                      }
                      placeholder="127.0.0.1 or proxy.example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="proxy-port">Proxy Port</Label>
                    <Input
                      id="proxy-port"
                      type="number"
                      value={formData.proxyPort}
                      onChange={(e) =>
                        handleInputChange("proxyPort", e.target.value)
                      }
                      placeholder="8080"
                      min="1"
                      max="65535"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="proxy-username">
                      Username (Optional)
                    </Label>
                    <Input
                      id="proxy-username"
                      value={formData.proxyUsername}
                      onChange={(e) =>
                        handleInputChange(
                          "proxyUsername",
                          e.target.value,
                        )
                      }
                      placeholder="Leave empty if no auth required"
                    />
                  </div>
                  <div>
                    <Label htmlFor="proxy-password">
                      Password (Optional)
                    </Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="proxy-password"
                        type="password"
                        value={formData.proxyPassword}
                        onChange={(e) =>
                          handleInputChange(
                            "proxyPassword",
                            e.target.value,
                          )
                        }
                        placeholder="Leave empty if no auth required"
                        className="flex-1"
                      />
                      {formData.proxyPassword && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyPassword}
                          className="h-9 w-9 p-0"
                          title="Copy password to clipboard"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => testProxyMutation.mutate()}
                    disabled={testProxyMutation.isPending}
                  >
                    {testProxyMutation.isPending ? "Testing..." : "Test Proxy"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Apps Tab */}
        <TabsContent value="apps" className="space-y-4 w-full min-w-0">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Available Apps</h3>
              <p className="text-xs text-gray-500 mb-3">
                Select apps to install on this instance. Instance must be running to install apps.
              </p>
            </div>

            {availableApps.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No APK files found in apks folder</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableApps.map((app) => (
                  <div key={app.fileName} className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <Package className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {app.name || app.fileName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {(app.size / 1024 / 1024).toFixed(2)} MB
                          {app.packageName && <span className="ml-2">• {app.packageName}</span>}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => installAppMutation.mutate(app.fileName)}
                      disabled={installingApp === app.fileName}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white ml-2"
                    >
                      {installingApp === app.fileName ? "Installing..." : "Install"}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {profileData.apps && Object.keys(profileData.apps).length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Installed Apps</h3>
                <div className="space-y-2">
                  {Object.entries(profileData.apps).map(([key, app]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm text-gray-900 capitalize">{key}</span>
                        <span className="text-xs text-gray-500">• {app.packageName}</span>
                      </div>
                      {app.installed && (
                        <span className="text-xs text-emerald-600 font-medium">Installed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-4 w-full min-w-0">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Account Information</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Store account credentials for different apps in JSON format. Example:
              </p>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mb-3 overflow-x-auto text-gray-900 dark:text-gray-100">
{`{
  "twitter": {
    "username": "myuser",
    "password": "mypass123"
  },
  "facebook": {
    "email": "user@example.com",
    "password": "pass456"
  }
}`}
              </pre>
            </div>

            <div>
              <Label htmlFor="accounts-json">Accounts JSON</Label>
              <textarea
                id="accounts-json"
                value={formData.accounts || "{}"}
                onChange={(e) => handleInputChange("accounts", e.target.value)}
                className="w-full h-64 p-3 font-mono text-sm border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                placeholder='{"twitter": {"username": "user", "password": "pass"}}'
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter valid JSON format. Will be validated when you save.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* UI Inspector Tab - Auto XPath Generation */}
        <TabsContent value="inspector" className="w-full min-w-0">
          <UIInspector profileId={profileData.id} />
        </TabsContent>

        {/* Custom Field Tab - Temporarily disabled, no backend support yet */}
        {/* <TabsContent value="custom" className="flex flex-col w-full min-w-0 max-h-[45vh]">
          <p className="text-xs text-gray-500 mb-2">
            Enter valid JSON format. Leave empty if no custom fields
            are needed.
          </p>
          <div className="flex-1 overflow-hidden">
            <CustomFieldEditor
              value={formData.customField}
              onChange={(value) => handleInputChange("customField", value)}
            />
          </div>
        </TabsContent> */}
      </div>
    </Tabs>
  );
}