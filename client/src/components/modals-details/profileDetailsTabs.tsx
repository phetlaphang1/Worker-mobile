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
  Monitor,
  Shield,
  FileText,
  Calendar,
  Copy,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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

  const testProxyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('http://localhost:5050/api/proxy-test', {
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
        className="grid w-full grid-cols-4 shrink-0"
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
          value="browser"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <Monitor className="h-4 w-4" />
          Browser
        </TabsTrigger>
        <TabsTrigger
          value="proxy"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <Shield className="h-4 w-4" />
          Proxy
        </TabsTrigger>
        <TabsTrigger
          value="custom"
          className="flex items-center gap-1 flex-1 min-w-0"
        >
          <FileText className="h-4 w-4" />
          Custom Field
        </TabsTrigger>
      </TabsList>

      <div className="mt-4">
        {/* General Tab */}
        <TabsContent value="general" className="space-y-3 w-full min-w-0 max-h-[45vh] overflow-y-auto">
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

        {/* Browser Tab */}
        <TabsContent value="browser" className="space-y-3 w-full min-w-0 max-h-[45vh] overflow-y-auto">
          <div className="space-y-4">
            <div>
              <Label htmlFor="user-agent">User Agent</Label>
              <Input
                id="user-agent"
                value={formData.userAgent}
                onChange={(e) =>
                  handleInputChange("userAgent", e.target.value)
                }
                className="font-mono text-sm"
                placeholder="Enter user agent string"
              />
            </div>
            <div>
              <Label htmlFor="custom-user-agent">
                Custom User Agent (Optional)
              </Label>
              <Input
                id="custom-user-agent"
                value={formData.customUserAgent}
                onChange={(e) =>
                  handleInputChange("customUserAgent", e.target.value)
                }
                className="font-mono text-sm"
                placeholder="Leave empty to use default user agent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="viewport-width">
                Viewport Width (px)
              </Label>
              <Input
                id="viewport-width"
                type="number"
                value={formData.viewportWidth}
                onChange={(e) =>
                  handleInputChange(
                    "viewportWidth",
                    parseInt(e.target.value) || 1280,
                  )
                }
                min="800"
                max="4000"
              />
            </div>
            <div>
              <Label htmlFor="viewport-height">
                Viewport Height (px)
              </Label>
              <Input
                id="viewport-height"
                type="number"
                value={formData.viewportHeight}
                onChange={(e) =>
                  handleInputChange(
                    "viewportHeight",
                    parseInt(e.target.value) || 720,
                  )
                }
                min="600"
                max="3000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) =>
                  handleInputChange("timezone", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">
                    America/New_York
                  </SelectItem>
                  <SelectItem value="America/Los_Angeles">
                    America/Los_Angeles
                  </SelectItem>
                  <SelectItem value="America/Chicago">
                    America/Chicago
                  </SelectItem>
                  <SelectItem value="Europe/London">
                    Europe/London
                  </SelectItem>
                  <SelectItem value="Europe/Paris">
                    Europe/Paris
                  </SelectItem>
                  <SelectItem value="Europe/Berlin">
                    Europe/Berlin
                  </SelectItem>
                  <SelectItem value="Asia/Tokyo">
                    Asia/Tokyo
                  </SelectItem>
                  <SelectItem value="Asia/Shanghai">
                    Asia/Shanghai
                  </SelectItem>
                  <SelectItem value="Asia/Kolkata">
                    Asia/Kolkata
                  </SelectItem>
                  <SelectItem value="Australia/Sydney">
                    Australia/Sydney
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                value={formData.language}
                onValueChange={(value) =>
                  handleInputChange("language", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="es-ES">Spanish</SelectItem>
                  <SelectItem value="fr-FR">French</SelectItem>
                  <SelectItem value="de-DE">German</SelectItem>
                  <SelectItem value="it-IT">Italian</SelectItem>
                  <SelectItem value="pt-BR">
                    Portuguese (Brazil)
                  </SelectItem>
                  <SelectItem value="ru-RU">Russian</SelectItem>
                  <SelectItem value="ja-JP">Japanese</SelectItem>
                  <SelectItem value="ko-KR">Korean</SelectItem>
                  <SelectItem value="zh-CN">
                    Chinese (Simplified)
                  </SelectItem>
                  <SelectItem value="zh-TW">
                    Chinese (Traditional)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {/* Proxy Tab */}
        <TabsContent value="proxy" className="space-y-3 w-full min-w-0 max-h-[45vh] overflow-y-auto">
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

        {/* Custom Field Tab */}
        <TabsContent value="custom" className="flex flex-col w-full min-w-0 max-h-[45vh]">
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
        </TabsContent>
      </div>
    </Tabs>
  );
}