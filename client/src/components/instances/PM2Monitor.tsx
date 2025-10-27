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
  totalProcesses: number;
  onlineProcesses: number;
  totalMemory: number;
  totalCpu: number;
}

export function PM2Monitor() {
  const [systemInfo, setSystemInfo] = useState<PM2SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch system info
  const fetchSystemInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/pm2/system/info`);
      const data = await response.json();

      if (data.success) {
        setSystemInfo(data.info);
      }
    } catch (error) {
      console.error('Failed to fetch PM2 system info:', error);
    }
  };

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchSystemInfo();
    const interval = setInterval(fetchSystemInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  // Stop all instances
  const handleStopAll = async () => {
    if (!confirm('Are you sure you want to stop all PM2 instances?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/pm2/instances/stop-all`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: 'All PM2 Instances Stopped',
          description: data.message,
        });
        fetchSystemInfo();
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
        description: 'Failed to stop all PM2 instances',
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
          <h3 className="font-semibold">PM2 System Monitor</h3>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleStopAll}
          disabled={isLoading || systemInfo.totalProcesses === 0}
        >
          <Power className="w-4 h-4 mr-1" />
          Stop All
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Processes */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Activity className="w-8 h-8 text-blue-500" />
          <div>
            <div className="text-2xl font-bold">{systemInfo.totalProcesses}</div>
            <div className="text-xs text-muted-foreground">Total Processes</div>
          </div>
        </div>

        {/* Online Processes */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Server className="w-8 h-8 text-green-500" />
          <div>
            <div className="text-2xl font-bold text-green-500">{systemInfo.onlineProcesses}</div>
            <div className="text-xs text-muted-foreground">Online</div>
          </div>
        </div>

        {/* Total Memory */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <HardDrive className="w-8 h-8 text-purple-500" />
          <div>
            <div className="text-2xl font-bold">{systemInfo.totalMemory.toFixed(0)}MB</div>
            <div className="text-xs text-muted-foreground">Memory Usage</div>
          </div>
        </div>

        {/* Total CPU */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Cpu className="w-8 h-8 text-orange-500" />
          <div>
            <div className="text-2xl font-bold">{systemInfo.totalCpu.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">CPU Usage</div>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="mt-4 flex items-center gap-2 text-sm">
        <Badge variant={systemInfo.onlineProcesses > 0 ? "default" : "secondary"}>
          {systemInfo.onlineProcesses > 0 ? 'PM2 Active' : 'No Active Processes'}
        </Badge>
        {systemInfo.onlineProcesses > 0 && (
          <span className="text-muted-foreground">
            {systemInfo.onlineProcesses}/{systemInfo.totalProcesses} instances running
          </span>
        )}
      </div>
    </Card>
  );
}

export default PM2Monitor;
