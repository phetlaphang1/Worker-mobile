/**
 * PM2 System Monitor
 * Shows detailed worker status for all instances
 */

import { useState, useEffect } from 'react';
import { Activity, Server, RefreshCw, Power } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/api.config';

interface WorkerStatus {
  profileId: number;
  instanceName: string;
  status: string;
  pid: number;
  uptime: number;
  restarts: number;
}

export function PM2Monitor() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Fetch all workers status
  const fetchWorkers = async () => {
    try {
      console.log('[PM2Monitor] Fetching workers status...');
      const response = await fetch(`${API_BASE_URL}/api/pm2/instances/status`);
      const data = await response.json();
      console.log('[PM2Monitor] Workers response:', data);

      if (data.success) {
        setWorkers(data.instances || []);
        console.log('[PM2Monitor] Found', data.instances?.length || 0, 'workers');
      }
    } catch (error) {
      console.error('[PM2Monitor] Failed to fetch workers:', error);
    }
  };

  // Refresh workers
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWorkers();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Fetch on mount
  useEffect(() => {
    fetchWorkers();
  }, []);

  // Stop all workers
  const handleStopAll = async () => {
    if (!confirm(`Are you sure you want to stop all ${workers.length} worker(s)?`)) {
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
          description: `Stopped ${data.stopped} worker(s)`,
        });
        console.log(`[PM2Monitor] ✅ Stopped ${data.stopped} workers`);
        await fetchWorkers();
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

  // Format uptime
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    if (status === 'running') return 'default';
    if (status === 'stopped') return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h3 className="font-semibold">Instance Workers Monitor</h3>
          <Badge variant="secondary" className="ml-2">
            {workers.length} Active
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStopAll}
            disabled={isLoading || workers.length === 0}
          >
            <Power className="w-4 h-4 mr-1" />
            Stop All
          </Button>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Server className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p>No active workers</p>
          <p className="text-sm">Start instances to see workers here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-2 font-medium">Instance</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">PID</th>
                <th className="pb-2 font-medium">Uptime</th>
                <th className="pb-2 font-medium">Restarts</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.profileId} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{worker.instanceName}</div>
                        <div className="text-xs text-muted-foreground">ID: {worker.profileId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <Badge variant={getStatusVariant(worker.status)}>
                      {worker.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-sm font-mono">{worker.pid}</td>
                  <td className="py-3 text-sm">{formatUptime(worker.uptime)}</td>
                  <td className="py-3 text-sm">
                    <span className={worker.restarts > 0 ? 'text-yellow-600 font-medium' : ''}>
                      {worker.restarts}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default PM2Monitor;
