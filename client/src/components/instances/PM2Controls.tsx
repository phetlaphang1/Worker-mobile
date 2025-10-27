/**
 * PM2 Controls Component
 * Displays PM2 process status and controls for instances
 */

import { useState, useEffect } from 'react';
import { Activity, Power, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/api.config';

interface PM2Status {
  profileId: number;
  processName: string;
  status: string;
  pid?: number;
  memory?: number;
  cpu?: number;
  uptime?: number;
  restarts?: number;
}

interface PM2ControlsProps {
  profileId: number;
  isCompact?: boolean;
}

export function PM2Controls({ profileId, isCompact = false }: PM2ControlsProps) {
  const [pm2Status, setPM2Status] = useState<PM2Status | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch PM2 status
  const fetchPM2Status = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/pm2/instance/${profileId}/status`);
      const data = await response.json();

      if (data.success) {
        setPM2Status(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch PM2 status:', error);
    }
  };

  // Auto-refresh PM2 status every 5 seconds
  useEffect(() => {
    fetchPM2Status();
    const interval = setInterval(fetchPM2Status, 5000);
    return () => clearInterval(interval);
  }, [profileId]);

  // Start PM2 process
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/pm2/instance/${profileId}/start`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: 'PM2 Started',
          description: data.message,
        });
        fetchPM2Status();
      } else {
        toast({
          title: 'Failed to Start',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start PM2 process',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Stop PM2 process
  const handleStop = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/pm2/instance/${profileId}/stop`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: 'PM2 Stopped',
          description: data.message,
        });
        setPM2Status(null);
      } else {
        toast({
          title: 'Failed to Stop',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to stop PM2 process',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Restart PM2 process
  const handleRestart = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/pm2/instance/${profileId}/restart`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: 'PM2 Restarted',
          description: data.message,
        });
        fetchPM2Status();
      } else {
        toast({
          title: 'Failed to Restart',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to restart PM2 process',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'stopping':
        return 'bg-yellow-500';
      case 'stopped':
      case 'errored':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Format uptime
  const formatUptime = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (isCompact) {
    // Compact view - just status badge
    return (
      <div className="flex items-center gap-2">
        {pm2Status ? (
          <Badge className={`${getStatusColor(pm2Status.status)} text-white text-xs`}>
            PM2: {pm2Status.status}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">PM2: Off</Badge>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          <span className="font-semibold text-sm">PM2 Process</span>
        </div>
        {pm2Status && (
          <Badge className={`${getStatusColor(pm2Status.status)} text-white`}>
            {pm2Status.status}
          </Badge>
        )}
      </div>

      {pm2Status && (
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>PID: {pm2Status.pid || 'N/A'}</div>
          <div>Uptime: {formatUptime(pm2Status.uptime)}</div>
          <div>Memory: {pm2Status.memory ? `${pm2Status.memory}MB` : 'N/A'}</div>
          <div>CPU: {pm2Status.cpu !== undefined ? `${pm2Status.cpu.toFixed(1)}%` : 'N/A'}</div>
          <div className="col-span-2">Restarts: {pm2Status.restarts || 0}</div>
        </div>
      )}

      <div className="flex gap-2">
        {!pm2Status ? (
          <Button
            size="sm"
            onClick={handleStart}
            disabled={isLoading}
            className="flex-1"
          >
            <Power className="w-3 h-3 mr-1" />
            Start PM2
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestart}
              disabled={isLoading}
              className="flex-1"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Restart
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStop}
              disabled={isLoading}
              className="flex-1"
            >
              <X className="w-3 h-3 mr-1" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default PM2Controls;
