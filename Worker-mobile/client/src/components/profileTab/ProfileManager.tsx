import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ProfileCard } from './ProfileCard';
import { Plus, RefreshCw, Search, Smartphone } from 'lucide-react';
import axios from 'axios';
import { useMobileLDPlayer } from '../../hooks/use-mobile-ldplayer';

interface Profile {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  port?: number;
  apps?: string[];
}

interface ProfileStats {
  total: number;
  active: number;
  inactive: number;
}

export function ProfileManager() {
  const { isMobile } = useMobileLDPlayer();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [stats, setStats] = useState<ProfileStats>({
    total: 0,
    active: 0,
    inactive: 0,
  });

  // Fetch profiles from API
  const fetchProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get<Profile[]>('http://localhost:5051/api/profiles');
      const profilesData = response.data;
      setProfiles(profilesData);
      setFilteredProfiles(profilesData);

      // Calculate stats
      const total = profilesData.length;
      const active = profilesData.filter((p) => p.status === 'active').length;
      const inactive = total - active;
      setStats({ total, active, inactive });
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
      // Set empty data if server is not available
      setProfiles([]);
      setFilteredProfiles([]);
      setStats({ total: 0, active: 0, inactive: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  // Create new profile
  const handleCreateProfile = async () => {
    const profileName = prompt('Enter profile name:');
    if (!profileName || profileName.trim() === '') {
      return;
    }

    try {
      setIsCreating(true);
      await axios.post('http://localhost:5051/api/profiles', {
        name: profileName.trim(),
      });
      await fetchProfiles();
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Failed to create profile. Please check the server.');
    } finally {
      setIsCreating(false);
    }
  };

  // Search/filter profiles
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProfiles(profiles);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = profiles.filter((profile) =>
        profile.name.toLowerCase().includes(query) ||
        profile.id.toLowerCase().includes(query)
      );
      setFilteredProfiles(filtered);
    }
  }, [searchQuery, profiles]);

  // Initial fetch
  useEffect(() => {
    fetchProfiles();
  }, []);

  return (
    <div className="h-full w-full overflow-auto p-4 pb-20">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-7 h-7 text-blue-500" />
            LDPlayer Profiles
          </h1>
          <Button
            onClick={fetchProfiles}
            disabled={isLoading}
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-3 gap-4'} mb-6`}>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Profiles</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Instances</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Inactive</p>
                <p className="text-3xl font-bold text-gray-600">{stats.inactive}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-3`}>
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search profiles by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreateProfile}
            disabled={isCreating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Profile
          </Button>
        </div>
      </div>

      {/* Profiles Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400">Loading profiles...</p>
          </div>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {searchQuery ? 'No profiles found' : 'No profiles yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first LDPlayer profile to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={handleCreateProfile} disabled={isCreating}>
                <Plus className="w-4 h-4 mr-2" />
                Create Profile
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* Results Count */}
          {searchQuery && (
            <div className="mb-4">
              <Badge variant="secondary">
                {filteredProfiles.length} {filteredProfiles.length === 1 ? 'result' : 'results'} found
              </Badge>
            </div>
          )}

          {/* Grid */}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
            {filteredProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onRefresh={fetchProfiles}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
