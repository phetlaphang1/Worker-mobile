import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Profile } from '@shared/schema';

// Import components
import ProfileDetailsModal from "../modals-details/profileDetails";
import { LogDetailsModal, OutputDetailsModal } from "../modals-details/executionDetails";
import { InstanceTable } from './instancesTab/InstanceTable';
import { InstanceControls } from './instancesTab/InstanceControls';
import { InstancePagination } from './instancesTab/InstancePagination';
import { ScriptModal, DeleteConfirmDialog, ImagePreviewModal } from '../modals/ProfileModals';
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
    openBrowserMutation
  } = useInstanceMutations();

  // Fetch settings and scheduled profiles
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('http://localhost:5050/api/settings');
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
      const response = await fetch(`http://localhost:5050/api/profiles/${profile.id}`);
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
      const response = await fetch(`http://localhost:5050/api/profiles/${profile.id}/log`);
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
      const response = await fetch(`http://localhost:5050/api/profiles/${profile.id}/output`);
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
      const response = await fetch(`http://localhost:5050/api/profiles/${profileId}/output/${file.name}`);
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
      const response = await fetch(`http://localhost:5050/api/profiles/${profileId}/script`);
      if (response.ok) {
        const data = await response.json();
        setScriptDetails({ profileId, content: data.content || "" });
        setEditedScriptContent(data.content || "");
        setIsScriptModalOpen(true);
      } else {
        // Create new script file
        const defaultContent = '// New script file\nconsole.log("Hello from profile script!");';
        const createResponse = await fetch(`http://localhost:5050/api/profiles/${profileId}/script`, {
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
        onCreateNew={() => createNewProfileMutation.mutate(profiles)}
        isCreating={createNewProfileMutation.isPending}
        onNavigateToSettings={onNavigateToSettings}
        isAutoRunEnabled={isAutoRunEnabled}
        totalProfiles={profiles.length}
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
            onClick={() => createNewProfileMutation.mutate(profiles)}
            disabled={createNewProfileMutation.isPending}
            className="bg-accent text-white hover:bg-emerald-600"
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
            onOpenBrowser={(profile) => openBrowserMutation.mutate(profile)}
            onDuplicate={(profile) => duplicateProfileMutation.mutate(profile)}
            onDelete={handleDeleteClick}
            isTwitterCaring={isTwitterCaring}
            selectedScript={selectedScript}
            isOpeningBrowser={openBrowserMutation.isPending}
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
        baseUrl={`http://localhost:5050/api/profiles/${outputDetails?.profileId}`}
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
    </div>
  );
}
