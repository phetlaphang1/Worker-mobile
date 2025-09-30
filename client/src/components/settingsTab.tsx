import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertTriangle, Settings, ListTodo, Users, Activity, Chrome, FileSpreadsheet, Download, Code } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SettingsPanelProps {
  autoFetchInterval: number;
  isAutoFetchEnabled: boolean;
  onAutoFetchChange: (interval: number, enabled: boolean) => void;
  defaultTab?: string;
}

interface TaskSettings {
  isAutoRunTask: boolean;
  intervalOfAutoRunTask: number;
  parallelRunningTask: number;
}

interface ProfileSettings {
  isAutoRunProfile: boolean;
  intervalOfAutoRunProfile: number;
  parallelRunningProfile: number;
  selectedScript?: string;
  isAutoRunProfileLoop: boolean;
}

interface ScriptSettings {
  selectedScript?: string;
  listOfScripts: string[];
}

export default function SettingsPanel({
  autoFetchInterval,
  isAutoFetchEnabled,
  onAutoFetchChange,
  defaultTab = "general"
}: SettingsPanelProps) {
  const [isTerminatingChrome, setIsTerminatingChrome] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [executionStatus, setExecutionStatus] = useState({
    runningTasks: 0,
    runningProfiles: 0
  }); 
  
  const [taskSettings, setTaskSettings] = useState<TaskSettings>({
    isAutoRunTask: true,
    intervalOfAutoRunTask: 15,
    parallelRunningTask: 1
  });
  
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>({
    isAutoRunProfile: true,
    intervalOfAutoRunProfile: 15,
    parallelRunningProfile: 5,
    selectedScript: undefined,
    isAutoRunProfileLoop: false
  });

  const [scriptSettings, setScriptSettings] = useState<ScriptSettings>({
    selectedScript: undefined,
    listOfScripts: []
  });
  
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {        
        const response = await fetch('/api/settings');
        const data = await response.json();
        if (data.executionStatus) {
          setExecutionStatus(data.executionStatus);
        }
        if (data.taskSettings) {
          setTaskSettings(data.taskSettings);
        }
        if (data.profileSettings) {
          setProfileSettings(prev => ({
            ...prev,
            ...data.profileSettings
          }));
        }
        if (data.scriptSettings) {
          setScriptSettings(data.scriptSettings);
          // Set the selected script from scriptSettings to profileSettings
          setProfileSettings(prev => ({
            ...prev,
            selectedScript: data.scriptSettings.selectedScript || undefined
          }));
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const handleTerminateChrome = async () => {
    setShowConfirmDialog(false);
    setIsTerminatingChrome(true);
    try {
      const response = await fetch('/api/settings/terminate-chrome', { method: 'POST' });
      const result = await response.json();
      toast({
        title: result.killed > 0 ? "Success" : "Info",
        description: result.message || 
          (result.killed > 0 
            ? `${result.killed} Chrome process(es) terminated` 
            : "No Chrome processes found"),
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to terminate Chrome processes",
        variant: "destructive",
      });
    } finally {
      setIsTerminatingChrome(false);
    }
  };
  
  const handleSaveTaskSettings = async () => {
    try {
      const response = await fetch('/api/settings/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskSettings)
      });
      
      if (response.ok) {
        toast({
          title: "Settings Saved",
          description: "Task settings have been updated successfully",
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save task settings",
        variant: "destructive",
      });
    }
  };
  
  const handleSaveProfileSettings = async () => {
    try {
      // Convert "none" to empty string for the API
      const settingsToSave = {
        ...profileSettings,
        selectedScript: profileSettings.selectedScript === "none" ? "" : (profileSettings.selectedScript || "")
      };

      const response = await fetch('/api/settings/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      });

      if (response.ok) {
        toast({
          title: "Settings Saved",
          description: "Profile settings have been updated successfully",
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save profile settings",
        variant: "destructive",
      });
    }
  };

  const handleExportProfiles = async () => {
    try {
      const response = await fetch('/api/profiles/export');

      if (!response.ok) {
        throw new Error('Failed to export profiles');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Generate filename with date and time format: profiles_export_YYYY-MM-DD_HH-mm-ss.xlsx
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      a.download = `profiles_export_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.xlsx`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Profiles have been exported to Excel file",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export profiles to Excel",
        variant: "destructive",
      });
    }
  };

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="h-auto p-0 bg-transparent rounded-none flex w-fit gap-0">
        <TabsTrigger 
          value="general" 
          className="
            flex items-center gap-2 justify-start px-4 py-3 w-32
            bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600
            hover:bg-gray-100 dark:hover:bg-gray-600
            data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800
            data-[state=active]:shadow-none
            data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400
            rounded-none
            transition-all duration-200 ease-in-out
            relative
            text-sm font-medium text-gray-600 dark:text-gray-300
            hover:text-gray-900 dark:hover:text-white
          "
        >
          <Settings className="h-4 w-4" />
          General
        </TabsTrigger>
        <TabsTrigger 
          value="tasks" 
          className="
            flex items-center gap-2 justify-start px-4 py-3 w-28
            bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600
            hover:bg-gray-100 dark:hover:bg-gray-600
            data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800
            data-[state=active]:shadow-none
            data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400
            rounded-none
            transition-all duration-200 ease-in-out
            relative
            text-sm font-medium text-gray-600 dark:text-gray-300
            hover:text-gray-900 dark:hover:text-white
          "
        >
          <ListTodo className="h-4 w-4" />
          Tasks
        </TabsTrigger>
        <TabsTrigger 
          value="profiles" 
          className="
            flex items-center gap-2 justify-start px-4 py-3 w-32
            bg-gray-50 dark:bg-gray-700
            hover:bg-gray-100 dark:hover:bg-gray-600
            data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800
            data-[state=active]:shadow-none
            data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400
            rounded-none
            transition-all duration-200 ease-in-out
            relative
            text-sm font-medium text-gray-600 dark:text-gray-300
            hover:text-gray-900 dark:hover:text-white
          "
        >
          <Users className="h-4 w-4" />
          Profiles
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="general" className="space-y-4">
        {/* System Status Panel */}
        <Card className="space-y-2 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center space-y-2 pb-2 gap-4">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Status
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Monitor current execution status and system activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full mr-3">
                  <ListTodo className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Running Tasks</p>
                  <p className="text-2xl font-bold text-blue-800">{executionStatus.runningTasks}</p>
                </div>
              </div>
              
              <div className="flex items-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full mr-3">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600 font-medium">Running Profiles</p>
                  <p className="text-2xl font-bold text-green-800">{executionStatus.runningProfiles}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Management Panel */}
        <Card className="space-y-2 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center space-y-2 pb-2 gap-4">
            <CardTitle className="flex items-center gap-2">
              <Chrome className="h-5 w-5" />
              System Management
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Manage system processes and perform maintenance tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 mb-1">Terminate Chrome Processes</h4>
                <p className="text-sm text-red-600 mb-3">
                  Force close all running Chrome instances. This will stop all active browser sessions and may cause data loss.
                </p>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isTerminatingChrome}
                  className="w-full sm:w-auto"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  {isTerminatingChrome ? "Terminating..." : "Terminate All Chrome"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="tasks" className="space-y-4">
        <Card className="space-y-2 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center space-y-2 pb-2 gap-4">
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Task Execution Settings
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Configure automatic task execution parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-run-task"
                  checked={taskSettings.isAutoRunTask}
                  onCheckedChange={(checked) => 
                    setTaskSettings({...taskSettings, isAutoRunTask: checked === true})
                  }
                />
                <Label htmlFor="auto-run-task" className="font-medium">
                  Enable Auto Run Task                  
                </Label>
                <p className="text-sm text-muted-foreground">AUTO_RUN_TASK_ENABLE</p>
              </div>
              
              <div className="flex items-center space-x-2">                
                <Input
                  id="task-interval"
                  type="number"
                  min="1"
                  value={taskSettings.intervalOfAutoRunTask}
                  onChange={(e) => 
                    setTaskSettings({...taskSettings, intervalOfAutoRunTask: parseInt(e.target.value) || 15})
                  }
                  className="w-32"
                />
                <Label htmlFor="task-interval">Auto Run Interval (seconds)</Label>
                <p className="text-sm text-muted-foreground">AUTO_RUN_TASK_INTERVAL</p>
              </div>
              
              <div className="flex items-center space-x-2">                  
                <Input
                  id="task-parallel"
                  type="number"
                  min="1"
                  max="10"
                  value={taskSettings.parallelRunningTask}
                  onChange={(e) => 
                    setTaskSettings({...taskSettings, parallelRunningTask: parseInt(e.target.value) || 1})
                  }
                  className="w-32"
                />
                <Label htmlFor="task-parallel">Parallel Running Tasks</Label>
                <p className="text-sm text-muted-foreground">AUTO_RUN_TASK_PARRALEL</p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button onClick={handleSaveTaskSettings} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Task Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="profiles" className="space-y-4">
        {/* Script Settings Panel */}
        <Card className="space-y-2 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center space-y-2 pb-2 gap-4">
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Script Settings
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Configure script selection for profile execution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="selected-script" className="font-medium">
                  Selected Script
                </Label>
                <Select
                  value={(!profileSettings.selectedScript || profileSettings.selectedScript === "") ? "none" : profileSettings.selectedScript}
                  onValueChange={(value) =>
                    setProfileSettings({...profileSettings, selectedScript: value === "none" ? "" : value})
                  }
                >
                  <SelectTrigger id="selected-script" className="w-full">
                    <SelectValue placeholder="Select a script" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-gray-500">None</span>
                    </SelectItem>
                    {scriptSettings.listOfScripts && scriptSettings.listOfScripts.map((script) => (
                      <SelectItem key={script} value={script}>
                        {script}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">SELECTED_SCRIPT</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleSaveProfileSettings} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Script Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Auto Run Panel */}
        <Card className="space-y-2 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center space-y-2 pb-2 gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Auto Run Settings
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Configure automatic profile execution parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-run-profile"
                  checked={profileSettings.isAutoRunProfile}
                  onCheckedChange={(checked) => 
                    setProfileSettings({...profileSettings, isAutoRunProfile: checked === true})
                  }
                />
                <Label htmlFor="auto-run-profile" className="font-medium">
                  Enable Auto Run Profile
                </Label>
                <p className="text-sm text-muted-foreground">AUTO_RUN_PROFILE_ENABLE</p>
              </div>
              
              <div className="flex items-center space-x-2">                
                <Input
                  id="profile-interval"
                  type="number"
                  min="1"
                  value={profileSettings.intervalOfAutoRunProfile}
                  onChange={(e) => 
                    setProfileSettings({...profileSettings, intervalOfAutoRunProfile: parseInt(e.target.value) || 15})
                  }
                  className="w-32"
                />
                <Label htmlFor="profile-interval">Auto Run Interval (seconds)</Label>
                <p className="text-sm text-muted-foreground">AUTO_RUN_PROFILE_INTERVAL</p>                
              </div>
              
              <div className="flex items-center space-x-2">                
                <Input
                  id="profile-parallel"
                  type="number"
                  min="1"
                  max="20"
                  value={profileSettings.parallelRunningProfile}
                  onChange={(e) => 
                    setProfileSettings({...profileSettings, parallelRunningProfile: parseInt(e.target.value) || 5})
                  }
                  className="w-32"
                />
                <Label htmlFor="profile-parallel">Parallel Running Profiles</Label>
                <p className="text-sm text-muted-foreground">AUTO_RUN_PROFILE_PARRALEL</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-run-profile-loop"
                  checked={profileSettings.isAutoRunProfileLoop}
                  onCheckedChange={(checked) => 
                    setProfileSettings({...profileSettings, isAutoRunProfileLoop: checked === true})
                  }
                />
                <Label htmlFor="auto-run-profile-loop" className="font-medium">
                  Enable Auto Run Profile Loop
                </Label>
                <p className="text-sm text-muted-foreground">AUTO_RUN_PROFILE_LOOP</p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button onClick={handleSaveProfileSettings} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Auto Run Settings
              </Button>
            </div>
          </CardContent>
        </Card>       

        {/* Export Panel */}
        <Card className="space-y-2 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center space-y-2 pb-2 gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Export Profiles
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Export all profiles to Excel format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Export all profiles with their configurations to an Excel file (.xlsx format).
                This includes profile names, IDs, scripts, status, and other settings.
              </p>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleExportProfiles} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export All Profiles to Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Chrome Termination</AlertDialogTitle>
            <AlertDialogDescription>
              This will forcefully terminate all Chrome processes. Any unsaved work in Chrome may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleTerminateChrome}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Terminate Chrome
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}