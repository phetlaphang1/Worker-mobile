import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  User,
  Save,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import JSONEditor, { JSONEditorMode, JSONEditorOptions } from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.css';
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/libs/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import ProfileDetailsTabs from "./profileDetailsTabs";
import { getApiUrl } from "@/config/api";

interface ProfileDetailsModalProps {
  profileData: any;
  isOpen: boolean;
  onClose: () => void;
  isTaskProfile?: boolean; // Flag to distinguish between task profiles and local profiles
}

interface Task {
  id: number;
  status: string;
  incognito?: boolean;
  headless?: boolean;
}

const CustomFieldEditor = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JSONEditor | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const options: JSONEditorOptions = {
        mode: theme === 'dark' ? 'tree' as JSONEditorMode : 'code' as JSONEditorMode,
        modes: ['tree', 'view', 'form', 'code', 'text'] as JSONEditorMode[],
        search: true,
        history: true,
        navigationBar: true,
        statusBar: true,
        onChange: () => {
          if (editorRef.current) {
            try {
              const json = editorRef.current.get();
              onChange(JSON.stringify(json, null, 2));
            } catch (e) {
              // Invalid JSON, don't update
            }
          }
        },
      };

      editorRef.current = new JSONEditor(containerRef.current, options);
      
      // Set initial theme after editor is created
      setTimeout(() => {
        const aceEditor = (editorRef.current as any)?.aceEditor;
        if (aceEditor) {
          aceEditor.setTheme(theme === 'dark' ? 'ace/theme/monokai' : 'ace/theme/textmate');
          aceEditor.setFontSize(14);
          aceEditor.setShowPrintMargin(false);
          aceEditor.setHighlightActiveLine(true);
          console.log('ProfileDetails: Applied initial theme to Ace Editor');
        }
      }, 100);
      
      // Set initial value
      try {
        const initialData = value ? JSON.parse(value) : {};
        editorRef.current.set(initialData);
      } catch (e) {
        editorRef.current.set({});
      }
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [theme]);

  useEffect(() => {
    if (editorRef.current && value) {
      try {
        const data = JSON.parse(value);
        const currentData = editorRef.current.get();
        // Only update if data is different to avoid cursor jump
        if (JSON.stringify(data) !== JSON.stringify(currentData)) {
          editorRef.current.set(data);
        }
      } catch (e) {
        // Invalid JSON, keep current editor state
      }
    }
  }, [value]);

  useEffect(() => {
    // Update theme when it changes - wait for JSONEditor to be initialized
    if (containerRef.current && editorRef.current) {
      setTimeout(() => {
        const jsonEditorElement = containerRef.current?.querySelector('.jsoneditor');
        if (jsonEditorElement && containerRef.current) {
          if (theme === 'dark') {
            containerRef.current.classList.add('jsoneditor-dark');
            jsonEditorElement.classList.add('jsoneditor-dark');
            console.log('ProfileDetails: Theme change - applied dark theme');
            
            // Switch to tree mode for better visibility in dark theme
            if (editorRef.current) {
              try {
                editorRef.current.setMode('tree');
                console.log('ProfileDetails: Switched to tree mode for dark theme');
              } catch (e) {
                console.log('ProfileDetails: Failed to switch mode:', e);
              }
            }
            
            // Also apply to any nested elements that might need it
            const allElements = containerRef.current?.querySelectorAll('*');
            allElements?.forEach(el => {
              if (el.classList.contains('ace_editor') || el.classList.contains('ace_content')) {
                el.classList.add('jsoneditor-dark');
              }
            });
          } else {
            containerRef.current.classList.remove('jsoneditor-dark');
            jsonEditorElement.classList.remove('jsoneditor-dark');
            console.log('ProfileDetails: Theme change - removed dark theme');
            
            // Switch to code mode for light theme
            if (editorRef.current) {
              try {
                editorRef.current.setMode('code');
                console.log('ProfileDetails: Switched to code mode for light theme');
              } catch (e) {
                console.log('ProfileDetails: Failed to switch mode:', e);
              }
            }
            
            const allElements = containerRef.current?.querySelectorAll('*');
            allElements?.forEach(el => {
              el.classList.remove('jsoneditor-dark');
            });
          }
        }
      }, 100);
    }
  }, [theme]);

  return <div ref={containerRef} className={`h-full min-h-[300px] max-h-[30vh] overflow-auto border rounded-md ${theme === 'dark' ? 'dark:border-gray-600' : 'border-gray-200'}`} />;
};

export default function ProfileDetailsModal({
  profileData,
  isOpen,
  onClose,
  isTaskProfile = false,
}: ProfileDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize editable form state
  const [formData, setFormData] = useState({
    name: profileData?.name || "",
    description: profileData?.description || "",
    userAgent: profileData?.userAgent || "",
    customUserAgent: profileData?.customUserAgent || "",
    viewportWidth: profileData?.viewportWidth || 1280,
    viewportHeight: profileData?.viewportHeight || 720,
    timezone: profileData?.timezone || "America/New_York",
    language: profileData?.language || "en-US",
    useProxy: profileData?.useProxy || false,
    proxyType: profileData?.proxyType || "http",
    proxyHost: profileData?.proxyHost || "",
    proxyPort: profileData?.proxyPort || "",
    proxyUsername: profileData?.proxyUsername || "",
    proxyPassword: profileData?.proxyPassword || "",
    customField: profileData?.customField
      ? (typeof profileData.customField === 'string'
          ? profileData.customField.replace(/\\n/g, '\n').replace(/\\"/g, '"')
          : JSON.stringify(profileData.customField, null, 2))
      : "",
    accounts: profileData?.metadata?.accounts
      ? (typeof profileData.metadata.accounts === 'string'
          ? profileData.metadata.accounts
          : JSON.stringify(profileData.metadata.accounts, null, 2))
      : "{}",
    isIncognito: profileData?.isIncognito || false,
    isHeadless: profileData?.isHeadless || false,
    // Instance hardware settings
    resolution: profileData?.settings?.resolution || "360,640",
    cpu: profileData?.settings?.cpu || 2,
    memory: profileData?.settings?.memory || 2048,
  });

  // Fetch task status when profile data changes
  useEffect(() => {
    const fetchTaskStatus = async () => {
      try {
        const response = await apiRequest('GET', getApiUrl(`/api/tasks?profileId=${profileData?.id}`));
        const tasks: Task[] = await response.json();
        
        if (tasks && tasks.length > 0) {
          const activeTask = tasks.find((t: Task) => ['RUNNING', 'QUEUED'].includes(t.status));
          if (activeTask) {
            setFormData(prev => ({
              ...prev,             
              isIncognito: activeTask.incognito || false,
              isHeadless: activeTask.headless || false
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch task status:', error);
      }
    };

    if (profileData?.id) {
      fetchTaskStatus();
    }
  }, [profileData?.id]);

  // Update form data when profileData changes
  useEffect(() => {
    if (profileData) {
      setFormData({
        name: profileData.name || "",
        description: profileData.description || "",
        userAgent: profileData.userAgent || "",
        customUserAgent: profileData.customUserAgent || "",
        viewportWidth: profileData.viewportWidth || 1280,
        viewportHeight: profileData.viewportHeight || 720,
        timezone: profileData.timezone || "America/New_York",
        language: profileData.language || "en-US",
        useProxy: profileData.useProxy || false,
        proxyType: profileData.proxyType || "http",
        proxyHost: profileData.proxyHost || "",
        proxyPort: profileData.proxyPort || "",
        proxyUsername: profileData.proxyUsername || "",
        proxyPassword: profileData.proxyPassword || "",
        customField: profileData.customField
          ? (typeof profileData.customField === 'string'
              ? profileData.customField.replace(/\\n/g, '\n').replace(/\\"/g, '"')
              : JSON.stringify(profileData.customField, null, 2))
          : "",
        accounts: profileData.metadata?.accounts
          ? (typeof profileData.metadata.accounts === 'string'
              ? profileData.metadata.accounts
              : JSON.stringify(profileData.metadata.accounts, null, 2))
          : "{}",
        isIncognito: profileData.isIncognito || false,
        isHeadless: profileData.isHeadless || false,
        // Instance hardware settings
        resolution: profileData.settings?.resolution || "360,640",
        cpu: profileData.settings?.cpu || 2,
        memory: profileData.settings?.memory || 2048,
      });
    }
  }, [profileData]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return apiRequest(
        "PUT",
        getApiUrl(`/api/profiles/${profileData.id}`),
        updatedData,
      );
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Profile details have been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [getApiUrl("/api/profiles")] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });


  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };


  const handleUpdate = async () => {
    try {
      // Parse custom field JSON if provided
      let customFieldData = {};
      if (formData.customField.trim()) {
        try {
          customFieldData = JSON.parse(formData.customField);
        } catch (error) {
          toast({
            title: "Invalid JSON",
            description: "Custom field data must be valid JSON format",
            variant: "destructive",
          });
          return;
        }
      }

      // Parse accounts JSON if provided
      let accountsData = {};
      if (formData.accounts.trim()) {
        try {
          accountsData = JSON.parse(formData.accounts);
        } catch (error) {
          toast({
            title: "Invalid JSON",
            description: "Accounts data must be valid JSON format",
            variant: "destructive",
          });
          return;
        }
      }

      // Create the update payload from form data
      const updateData = {
        name: formData.name,
        description: formData.description,
        userAgent: formData.userAgent,
        customUserAgent: formData.customUserAgent,
        viewportWidth: formData.viewportWidth,
        viewportHeight: formData.viewportHeight,
        timezone: formData.timezone,
        language: formData.language,
        useProxy: formData.useProxy,
        proxyType: formData.proxyType,
        proxyHost: formData.proxyHost,
        proxyPort: formData.proxyPort,
        proxyUsername: formData.proxyUsername,
        proxyPassword: formData.proxyPassword,
        customField: customFieldData,
        isIncognito: formData.isIncognito,
        isHeadless: formData.isHeadless,
        // Instance hardware settings
        settings: {
          resolution: formData.resolution,
          cpu: formData.cpu,
          memory: formData.memory,
        },
        // Save accounts to metadata
        metadata: {
          ...profileData.metadata,
          accounts: accountsData,
        },
      };

      updateProfileMutation.mutate(updateData);
    } catch (error) {
      toast({
        title: "Update Error",
        description: "An error occurred while preparing the update",
        variant: "destructive",
      });
    }
  };

  if (!profileData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[95vh] flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <User className="h-5 w-5 text-blue-600" />
            Profile Details - {profileData.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 w-full min-w-0 overflow-y-auto pr-2">
          <ProfileDetailsTabs
            profileData={profileData}
            formData={formData}
            handleInputChange={handleInputChange}
            CustomFieldEditor={CustomFieldEditor}
            isTaskProfile={isTaskProfile}
          />
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t flex-shrink-0 bg-white dark:bg-gray-900">
          <Button variant="outline" onClick={onClose} className="mr-3">
            Close
          </Button>
          {!isTaskProfile && (
            <Button
              onClick={handleUpdate}
              disabled={updateProfileMutation.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateProfileMutation.isPending ? "Updating..." : "Update"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
