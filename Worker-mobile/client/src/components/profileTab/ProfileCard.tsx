import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Smartphone, Play, Square, Twitter, Trash2, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useMobileLDPlayer } from '../../hooks/use-mobile-ldplayer';

interface ProfileCardProps {
  profile: {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    port?: number;
    apps?: string[];
  };
  onRefresh: () => void;
}

export function ProfileCard({ profile, onRefresh }: ProfileCardProps) {
  const { isMobile } = useMobileLDPlayer();
  const [isLaunching, setIsLaunching] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isOpeningX, setIsOpeningX] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isActive = profile.status === 'active';
  const hasTwitter = profile.apps?.includes('twitter') || profile.apps?.includes('com.twitter.android');

  const handleLaunch = async () => {
    try {
      setIsLaunching(true);
      await axios.post(`http://localhost:5051/api/profiles/${profile.id}/activate`);
      onRefresh();
    } catch (error) {
      console.error('Failed to launch profile:', error);
      alert('Failed to launch profile. Please check the server.');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStop = async () => {
    try {
      setIsStopping(true);
      await axios.post(`http://localhost:5051/api/profiles/${profile.id}/deactivate`);
      onRefresh();
    } catch (error) {
      console.error('Failed to stop profile:', error);
      alert('Failed to stop profile. Please check the server.');
    } finally {
      setIsStopping(false);
    }
  };

  const handleOpenX = async () => {
    if (!isActive) {
      alert('Please launch the profile first before opening X/Twitter.');
      return;
    }

    try {
      setIsOpeningX(true);
      await axios.post(`http://localhost:5051/api/profiles/${profile.id}/execute-script`, {
        script: {
          action: 'open-app',
          packageName: 'com.twitter.android'
        }
      });
    } catch (error) {
      console.error('Failed to open X:', error);
      alert('Failed to open X/Twitter. Make sure the app is installed.');
    } finally {
      setIsOpeningX(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete profile "${profile.name}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await axios.delete(`http://localhost:5051/api/profiles/${profile.id}`);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete profile:', error);
      alert('Failed to delete profile. Please check the server.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Smartphone className={`w-5 h-5 ${isActive ? 'text-green-500' : 'text-gray-400'}`} />
            <CardTitle className="text-lg truncate">{profile.name}</CardTitle>
          </div>
          <Badge
            variant={isActive ? 'default' : 'secondary'}
            className={isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'}
          >
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Profile Info */}
        <div className="mb-4 space-y-1">
          {profile.port && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Port: <span className="font-mono font-semibold">{profile.port}</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Apps:</p>
            {hasTwitter ? (
              <div className="flex items-center gap-1 text-blue-500">
                <Twitter className="w-4 h-4" />
                <span className="text-xs">X/Twitter</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">None</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-2'}`}>
          {/* Launch/Stop Button */}
          {isActive ? (
            <Button
              variant="destructive"
              size={isMobile ? 'default' : 'sm'}
              onClick={handleStop}
              disabled={isStopping}
              className="w-full"
            >
              {isStopping ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              size={isMobile ? 'default' : 'sm'}
              onClick={handleLaunch}
              disabled={isLaunching}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Launch
                </>
              )}
            </Button>
          )}

          {/* Open X Button */}
          <Button
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
            onClick={handleOpenX}
            disabled={!isActive || isOpeningX || !hasTwitter}
            className="w-full"
          >
            {isOpeningX ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <Twitter className="w-4 h-4 mr-2" />
                Open X
              </>
            )}
          </Button>

          {/* Delete Button */}
          <Button
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
            onClick={handleDelete}
            disabled={isDeleting || isActive}
            className={`w-full ${isMobile ? 'col-span-1' : 'col-span-2'} text-red-600 hover:text-red-700 hover:bg-red-50`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Profile
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
