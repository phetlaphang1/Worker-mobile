import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Profile } from '@shared/schema';
import { API_BASE_URL } from '@/config/api.config';

// Import components
import ProfileDetailsModal from "../modals-details/profileDetails";
import { LogDetailsModal, OutputDetailsModal } from "../modals-details/executionDetails";
import { InstanceTable } from './instancesTab/InstanceTable';
import { InstanceControls } from './instancesTab/InstanceControls';
import { InstancePagination } from './instancesTab/InstancePagination';
import { ScriptModal, DeleteConfirmDialog, ImagePreviewModal, NewInstanceModal, CloneInstanceModal } from '../modals/ProfileModals';
import { getLastExecutionTime } from './instancesTab/instanceUtils';
import { useInstanceMutations } from './instancesTab/useInstanceMutations';

interface InstanceManagerProps {
  profiles: Profile[];
  isLoading: boolean;
  onNavigateToTwitterCaring?: (profileId: number) => void;
  onNavigateToSettings?: () => void;
}

export default function InstanceManager({
  profiles,
  isLoading,
  onNavigateToTwitterCaring,
  onNavigateToSettings,
}: InstanceManagerProps) {
  // State management
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isProfileDetailsOpen, setIsProfileDetailsOpen] = useState(false);
  const [scriptDetails, setScriptDetails] = useState<{
    profileId: number;
    content: string;
  } | null>(null);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [editedScriptContent, setEditedScriptContent] = useState<string>("");
  const [logDetails, setLogDetails] = useState<{
    profileId: number;
    content: string;
  } | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [outputDetails, setOutputDetails] = useState<{
    profileId: number;
    files: any[];
    path: string;
  } | null>(null);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<any>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [isLoadingProfileDetails, setIsLoadingProfileDetails] = useState(false);
  const [isNewInstanceModalOpen, setIsNewInstanceModalOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [profileToClone, setProfileToClone] = useState<Profile | null>(null);

  // Settings state
  const [isTwitterCaring, setIsTwitterCaring] = useState(false);
  const [isAutoRunEnabled, setIsAutoRunEnabled] = useState(false);
  const [selectedScript, setSelectedScript] = useState<string | undefined>(undefined);
  const [lastExecutionTimes, setLastExecutionTimes] = useState<Map<number, string>>(new Map());

  // Filtering and sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'status' | 'lastRun'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Import mutations
  const {
    launchProfileMutation,
    deleteProfileMutation,
    duplicateProfileMutation,
    stopProfileMutation,
    createNewProfileMutation,
    updateScriptMutation,
    launchInstanceOnlyMutation,
    refreshStatusMutation
  } = useInstanceMutations();

  // Run All / Stop All state
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isStoppingAll, setIsStoppingAll] = useState(false);

  // Fetch settings and scheduled profiles
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings`);
        const data = await response.json();
        if (data.profileSettings?.isTwitterCaring !== undefined) {
          setIsTwitterCaring(data.profileSettings.isTwitterCaring);
        }
        if (data.profileSettings?.isAutoRunProfile !== undefined) {
          setIsAutoRunEnabled(data.profileSettings.isAutoRunProfile);
        }
        if (data.scriptSettings) {
          // Treat "none", empty string, or undefined as undefined for the Edit button logic
          const scriptValue = (!data.scriptSettings.selectedScript ||
                               data.scriptSettings.selectedScript === "none" ||
                               data.scriptSettings.selectedScript === "")
            ? undefined
            : data.scriptSettings.selectedScript;
          setSelectedScript(scriptValue);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };

    fetchSettings();
  }, []);

  // Update last execution times
  useEffect(() => {
    const newTimes = new Map();
    profiles.forEach((profile) => {
      const time = getLastExecutionTime(profile);
      if (time) {
        newTimes.set(profile.id, time);
      }
    });
    setLastExecutionTimes(newTimes);
  }, [profiles]);

  // Handler functions
  const handleProfileDetailsClick = async (profile: Profile) => {
    setIsLoadingProfileDetails(true);
    try {
      // Fetch latest profile data from API
      const response = await fetch(`${API_BASE_URL}/api/profiles/${profile.id}`);
      if (response.ok) {
        const fullProfileData = await response.json();
        setSelectedProfile(fullProfileData);
        setIsProfileDetailsOpen(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch profile details",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch profile details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProfileDetails(false);
    }
  };

  const handleDeleteClick = (profile: Profile) => {
    setProfileToDelete(profile);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (profileToDelete) {
      deleteProfileMutation.mutate(profileToDelete.id);
      setIsDeleteConfirmOpen(false);
      setProfileToDelete(null);
    }
  };

  const handleLogClick = async (profile: Profile) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profiles/${profile.id}/log`);
      if (response.ok) {
        const data = await response.json();
        setLogDetails({ profileId: profile.id, content: data.content });
        setIsLogModalOpen(true);
      } else {
        toast({
          title: "No Log Found",
          description: "No log file exists for this profile yet. Run the script first.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch log content",
        variant: "destructive",
      });
    }
  };

  const handleOutputClick = async (profile: Profile) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profiles/${profile.id}/output`);
      const data = await response.json();
      setOutputDetails({ profileId: profile.id, ...data });
      setIsOutputModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch output data:', error);
      toast({
        title: "Error",
        description: "Failed to load output files",
        variant: "destructive",
      });
    }
  };

  const handleFileDownload = async (file: any, profileId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profiles/${profileId}/output/${file.name}`);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading ${file.name}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const showScriptDetails = async (profileId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profiles/${profileId}/script`);
      if (response.ok) {
        const data = await response.json();
        setScriptDetails({ profileId, content: data.content || "" });
        setEditedScriptContent(data.content || "");
        setIsScriptModalOpen(true);
      } else {
        // Create new script file
        const defaultContent = '// New script file\nconsole.log("Hello from profile script!");';
        const createResponse = await fetch(`${API_BASE_URL}/api/profiles/${profileId}/script`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: defaultContent }),
        });
        if (createResponse.ok) {
          toast({
            title: "Success",
            description: "Script file created successfully",
          });
          setScriptDetails({ profileId, content: defaultContent });
          setEditedScriptContent(defaultContent);
          setIsScriptModalOpen(true);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load script",
        variant: "destructive",
      });
    }
  };

  const handleRunAll = async () => {
    setIsRunningAll(true);
    let launchSuccessCount = 0;
    let launchFailCount = 0;
    let scriptSuccessCount = 0;
    let scriptFailCount = 0;

    try {
      // PHASE 1: Launch all instances using resource-managed batch processing
      toast({
        title: "Starting Instances",
        description: "Launching instances with optimized resource allocation...",
      });

      // Separate profiles into already-active and need-to-launch
      const activeProfiles = profiles.filter(p => p.status === 'active');
      const inactiveProfiles = profiles.filter(p => p.status !== 'active');

      console.log(`[RUN ALL] Active: ${activeProfiles.length}, Inactive: ${inactiveProfiles.length}`);

      // Use server-side batch launch with resource management
      if (inactiveProfiles.length > 0) {
        const response = await fetch(`${API_BASE_URL}/api/profiles/batch-launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileIds: inactiveProfiles.map(p => p.id)
          })
        });

        const launchResults = await response.json();
        console.log(`[RUN ALL] Batch launch results:`, launchResults);

        // Count successes and failures
        launchSuccessCount = launchResults.results?.filter((r: any) => r.success).length || 0;
        launchFailCount = launchResults.results?.filter((r: any) => !r.success).length || 0;
      }

      // Count already-active profiles
      launchSuccessCount += activeProfiles.length;

      // Invalidate queries to refresh UI
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });

      // Show launch results
      toast({
        title: "Instances Launched",
        description: `${launchSuccessCount} instance${launchSuccessCount !== 1 ? 's' : ''} ready${launchFailCount > 0 ? `, ${launchFailCount} failed` : ''}`,
      });

      // Wait for instances to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));

      // PHASE 2: Execute scripts using resource-managed batch processing
      // Fetch FRESH profile data to get updated statuses after launching
      const freshProfilesResponse = await fetch(`${API_BASE_URL}/api/profiles`);
      const freshProfiles: Profile[] = await freshProfilesResponse.json();

      // Debug: Log all profile statuses
      console.log(`[RUN ALL] Fresh profile statuses:`, freshProfiles.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status
      })));

      // Run scripts on ALL ACTIVE profiles (using fresh data)
      const readyProfiles = freshProfiles.filter(p => p.status === 'active');

      console.log(`[RUN ALL] Ready profiles for scripts: ${readyProfiles.length}`);

      if (readyProfiles.length > 0) {
        toast({
          title: "Starting Scripts",
          description: `Executing scripts with concurrency control...`,
        });

        // Use server-side batch script execution
        const response = await fetch(`${API_BASE_URL}/api/profiles/batch-execute-scripts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileIds: readyProfiles.map(p => p.id)
          })
        });

        const scriptResults = await response.json();
        console.log(`[RUN ALL] Batch script results:`, scriptResults);

        // Count successes and failures
        scriptSuccessCount = scriptResults.results?.filter((r: any) => r.success).length || 0;
        scriptFailCount = scriptResults.results?.filter((r: any) => !r.success).length || 0;

        // Show final results
        toast({
          title: "Run All Complete",
          description: `${launchSuccessCount} launched, ${scriptSuccessCount} scripts executed${scriptFailCount > 0 ? `, ${scriptFailCount} failed` : ''}`,
        });
      }
    } catch (error) {
      console.error('Run All error:', error);
      toast({
        title: "Error",
        description: "Failed to run all instances",
        variant: "destructive",
      });
    } finally {
      setIsRunningAll(false);
      // Refresh profiles list
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });
    }
  };

  const handleStopAll = async () => {
    setIsStoppingAll(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Step 1: Refresh status to get ACTUAL running instances from LDPlayer
      toast({
        title: "Checking Running Instances",
        description: "Syncing with LDPlayer...",
      });

      await refreshStatusMutation.mutateAsync();

      // Step 2: Fetch fresh profile data
      const freshResponse = await fetch(`${API_BASE_URL}/api/profiles`);
      const freshProfiles: Profile[] = await freshResponse.json();

      // Step 3: Filter only ACTIVE/RUNNING profiles (actually running)
      const activeProfiles = freshProfiles.filter(p => p.status === 'active' || p.status === 'running');

      if (activeProfiles.length === 0) {
        toast({
          title: "No Active Instances",
          description: "All instances are already stopped",
        });
        return;
      }

      console.log(`[STOP ALL] Stopping ${activeProfiles.length} active instance(s)...`);

      // Stop sequentially with PROPER delay (2-3 seconds between each)
      for (let i = 0; i < activeProfiles.length; i++) {
        const profile = activeProfiles[i];

        try {
          console.log(`[STOP ALL] Stopping ${i + 1}/${activeProfiles.length}: ${profile.name} (ID: ${profile.id})`);

          await stopProfileMutation.mutateAsync({ profileId: profile.id });
          successCount++;

          console.log(`[STOP ALL] ✅ Stopped ${profile.name}`);

          // CRITICAL: Wait 2-3 seconds between stops to allow graceful shutdown
          if (i < activeProfiles.length - 1) {
            console.log(`[STOP ALL] Waiting 3 seconds before next stop...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // ✅ 3 seconds
          }
        } catch (error) {
          console.error(`[STOP ALL] ❌ Failed to stop profile ${profile.id}:`, error);
          failCount++;

          // Continue with delay even on error to prevent race conditions
          if (i < activeProfiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      // Refresh profiles list after all stops
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });

      // Show results
      if (successCount > 0) {
        toast({
          title: "Stop All Complete",
          description: `Stopped ${successCount} instance${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}`,
        });
      } else {
        toast({
          title: "Stop All Failed",
          description: "No instances were stopped successfully",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[STOP ALL] Error:', error);
      toast({
        title: "Error",
        description: "Failed to stop all instances",
        variant: "destructive",
      });
    } finally {
      setIsStoppingAll(false);
    }
  };


  // Filtering and sorting logic
  const filteredAndSortedProfiles = profiles
    .filter(profile => {
      const matchesSearch = profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           profile.id.toString().includes(searchTerm);
      const matchesStatus = !statusFilter || statusFilter === "all" ||
                           profile.status.toLowerCase().includes(statusFilter.toLowerCase());

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'id':
          comparison = a.id - b.id;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'lastRun':
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          comparison = aTime - bTime;
          break;
        default:
          comparison = a.id - b.id;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedProfiles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProfiles = filteredAndSortedProfiles.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (column: 'id' | 'name' | 'status' | 'lastRun') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const uniqueStatuses = Array.from(new Set(profiles.map(p => p.status).filter(s => s && s.trim() !== "")));

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <InstanceControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        uniqueStatuses={uniqueStatuses}
        onCreateNew={() => setIsNewInstanceModalOpen(true)}
        isCreating={createNewProfileMutation.isPending}
        onNavigateToSettings={onNavigateToSettings}
        isAutoRunEnabled={isAutoRunEnabled}
        totalProfiles={profiles.length}
        onRunAll={handleRunAll}
        onStopAll={handleStopAll}
        isRunningAll={isRunningAll}
        isStoppingAll={isStoppingAll}
        onRefresh={() => refreshStatusMutation.mutate()}
        isRefreshing={refreshStatusMutation.isPending}
      />

      {filteredAndSortedProfiles.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No instances
          </h3>
          <p className="text-gray-500 mb-6">
            Create your first instance to get started
          </p>
          <Button
            onClick={() => setIsNewInstanceModalOpen(true)}
            disabled={createNewProfileMutation.isPending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {createNewProfileMutation.isPending ? "Creating..." : "New Instance"}
          </Button>
        </div>
      ) : (
        <>
          <InstanceTable
            profiles={profiles}
            paginatedProfiles={paginatedProfiles}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onProfileClick={handleProfileDetailsClick}
            onScriptClick={showScriptDetails}
            onTwitterCaringClick={onNavigateToTwitterCaring}
            onRunProfile={(id) => launchProfileMutation.mutate({ profileId: id })}
            onStopProfile={(id) => stopProfileMutation.mutate({ profileId: id })}
            onLogClick={handleLogClick}
            onOutputClick={handleOutputClick}
            onOpenBrowser={(profile) => launchInstanceOnlyMutation.mutate(profile)}
            onDuplicate={(profile) => {
              setProfileToClone(profile);
              setIsCloneModalOpen(true);
            }}
            onDelete={handleDeleteClick}
            isTwitterCaring={isTwitterCaring}
            selectedScript={selectedScript}
            isOpeningBrowser={false}
            isDuplicating={duplicateProfileMutation.isPending}
          />

          <InstancePagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredAndSortedProfiles.length}
            startIndex={startIndex}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items);
              setCurrentPage(1);
            }}
          />
        </>
      )}

      {/* Modals */}
      <ProfileDetailsModal
        profileData={selectedProfile}
        isOpen={isProfileDetailsOpen}
        onClose={() => setIsProfileDetailsOpen(false)}
      />

      <ScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
        scriptDetails={scriptDetails}
        editedContent={editedScriptContent}
        onContentChange={setEditedScriptContent}
        onSave={() => {
          if (scriptDetails) {
            updateScriptMutation.mutate({
              profileId: scriptDetails.profileId,
              content: editedScriptContent,
            });
            setScriptDetails({ ...scriptDetails, content: editedScriptContent });
          }
        }}
        isSaving={updateScriptMutation.isPending}
      />

      <LogDetailsModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title={`Script Log - Profile ${logDetails?.profileId}`}
        content={logDetails?.content || ""}
        type="profile"
        id={logDetails?.profileId}
      />

      <OutputDetailsModal
        isOpen={isOutputModalOpen}
        onClose={() => setIsOutputModalOpen(false)}
        title={`Output Folder - Profile ${outputDetails?.profileId}`}
        path={outputDetails?.path || ""}
        files={outputDetails?.files || []}
        baseUrl={`${API_BASE_URL}/api/profiles/${outputDetails?.profileId}`}
      />

      <ImagePreviewModal
        isOpen={imagePreviewOpen}
        onClose={() => setImagePreviewOpen(false)}
        imageFile={selectedImageFile}
        onDownload={handleFileDownload}
      />

      <DeleteConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setProfileToDelete(null);
        }}
        onConfirm={confirmDelete}
        profileName={profileToDelete?.name}
        isDeleting={deleteProfileMutation.isPending}
      />

      <NewInstanceModal
        isOpen={isNewInstanceModalOpen}
        onClose={() => setIsNewInstanceModalOpen(false)}
        onSubmit={(config) => {
          createNewProfileMutation.mutate(config as any);
          setIsNewInstanceModalOpen(false);
        }}
        isCreating={createNewProfileMutation.isPending}
      />

      <CloneInstanceModal
        isOpen={isCloneModalOpen}
        onClose={() => {
          setIsCloneModalOpen(false);
          setProfileToClone(null);
        }}
        onSubmit={(newName, copyApps) => {
          if (profileToClone) {
            duplicateProfileMutation.mutate({
              profile: profileToClone,
              newName,
              copyApps
            });
            setIsCloneModalOpen(false);
            setProfileToClone(null);
          }
        }}
        isCloning={duplicateProfileMutation.isPending}
        originalName={profileToClone?.name}
      />
    </div>
  );
}
