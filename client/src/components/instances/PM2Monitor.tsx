/**
 * PM2 System Monitor
 * Shows overall PM2 status and system info
 */

import { useState, useEffect } from 'react';
import { Activity, Server, Cpu, HardDrive, Power } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/api.config';

interface PM2SystemInfo {
  totalWorkers: number;
  runningWorkers: number;
  crashedWorkers: number;
}

export function PM2Monitor() {
  const [systemInfo, setSystemInfo] = useState<PM2SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const { toast } = useToast();

  // Fetch system info
  const fetchSystemInfo = async () => {
    try {
      console.log('[PM2Monitor] Fetching system info...');
      const response = await fetch(`${API_BASE_URL}/api/pm2/system/info`);
      const data = await response.json();
      console.log('[PM2Monitor] System info response:', data);

      if (data.success) {
        setSystemInfo(data.info);
        setHasFetched(true);
        console.log('[PM2Monitor] System info:', {
          total: data.info.totalWorkers,
          running: data.info.runningWorkers,
          crashed: data.info.crashedWorkers
        });
      }
    } catch (error) {
      console.error('[PM2Monitor] Failed to fetch system info:', error);
      setHasFetched(true);
    }
  };

  // ONLY fetch ONCE on mount - NO POLLING
  // PM2 status doesn't change frequently enough to warrant constant polling
  // User can manually refresh page if needed
  useEffect(() => {
    fetchSystemInfo();
  }, []);

  // Stop all instances
  const handleStopAll = async () => {
    if (!confirm('Are you sure you want to stop all worker instances?')) {
      return;
    }

    setIsLoading(true);
    try {
      console.log('[PM2Monitor] Stopping all workers...');
      const response = await fetch(`${API_BASE_URL}/api/pm2/instances/stop-all`, {
        method: 'POST',
      });
      const data = await response.json();
      console.log('[PM2Monitor] Stop all response:', data);

      if (data.success) {
        toast({
          title: 'All Workers Stopped',
          description: data.message,
        });
        console.log(`[PM2Monitor] ✅ Stopped ${data.stopped} workers`);
        fetchSystemInfo();
      } else {
        console.error('[PM2Monitor] ❌ Failed to stop all workers:', data.message);
        toast({
          title: 'Failed to Stop',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[PM2Monitor] ❌ Error stopping all workers:', error);
      toast({
        title: 'Error',
        description: 'Failed to stop all worker instances',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!systemInfo) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          <h3 className="font-semibold">Instance Workers Monitor</h3>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleStopAll}
          disabled={isLoading || systemInfo.totalWorkers === 0}
        >
          <Power className="w-4 h-4 mr-1" />
          Stop All
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Total Workers */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Activity className="w-8 h-8 text-blue-500" />
          <div>
            <div className="text-2xl font-bold">{systemInfo.totalWorkers}</div>
            <div className="text-xs text-muted-foreground">Total Workers</div>
          </div>
        </div>

        {/* Running Workers */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Server className="w-8 h-8 text-green-500" />
          <div>
            <div className="text-2xl font-bold text-green-500">{systemInfo.runningWorkers}</div>
            <div className="text-xs text-muted-foreground">Running</div>
          </div>
        </div>

        {/* Crashed Workers */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Activity className="w-8 h-8 text-red-500" />
          <div>
            <div className="text-2xl font-bold text-red-500">{systemInfo.crashedWorkers}</div>
            <div className="text-xs text-muted-foreground">Crashed</div>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="mt-4 flex items-center gap-2 text-sm">
        <Badge variant={systemInfo.runningWorkers > 0 ? "default" : "secondary"}>
          {systemInfo.runningWorkers > 0 ? 'Workers Active' : 'No Active Workers'}
        </Badge>
        {systemInfo.runningWorkers > 0 && (
          <span className="text-muted-foreground">
            {systemInfo.runningWorkers}/{systemInfo.totalWorkers} workers running
          </span>
        )}
      </div>
    </Card>
  );
}

export default PM2Monitor;
