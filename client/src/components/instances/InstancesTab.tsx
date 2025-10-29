import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import InstanceManager from './InstanceManager';
import { api } from '@/libs/api';
import type { Profile } from '@shared/schema';
import { getWebSocketUrl } from '@shared/socket';

interface DeviceStatus {
  instanceName: string;
  index: number;
  port: number;
  isRunning: boolean;
  isAdbConnected: boolean;
  lastChecked: Date;
  health?: {
    cpuUsage?: number;
    memoryUsage?: number;
    batteryLevel?: number;
    temperature?: number;
  };
}

export function InstancesTab() {
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading, refetch } = useQuery<Profile[]>({
    queryKey: ["/api/profiles"],
    queryFn: api.profiles.list,
    // No polling - rely entirely on WebSocket for real-time updates
    // Only refetch when explicitly triggered by user actions or WebSocket events
    refetchInterval: false,
    // Refetch when window regains focus (user comes back to tab)
    refetchOnWindowFocus: true,
    // Don't use stale cache data - always fetch fresh on mount
    staleTime: 0,
  });

  // Fetch device monitor statuses
  // Server-side DeviceMonitor already runs background monitoring every 5s
  // Client only fetches when needed (on mount, after user actions)
  const { data: deviceMonitor } = useQuery({
    queryKey: ["/api/monitor/devices"],
    queryFn: async () => {
      const response = await fetch('/api/monitor/devices');
      if (!response.ok) {
        throw new Error('Failed to fetch device statuses');
      }
      return response.json();
    },
    // Only poll when devices are actually starting up (transitional state)
    refetchInterval: (query) => {
      const data = query.state.data as any;
      const devices = data?.devices || [];
      const hasTransitionalDevices = devices.some((d: DeviceStatus) =>
        d.isRunning && !d.isAdbConnected // Device is running but not ADB connected yet
      );
      // Poll every 3s ONLY if devices are starting, otherwise disable polling
      return hasTransitionalDevices ? 3000 : false;
    },
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
    // Don't use stale cache - always fetch fresh
    staleTime: 0,
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl = getWebSocketUrl();
    console.log('[WebSocket] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WebSocket] Received message:', message);

        // Handle profile status updates
        if (message.type === 'profile_status_update') {
          console.log('[WebSocket] Profile status update:', message.data);
          // Invalidate query to trigger refetch
          queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    ws.onclose = () => {
      console.log('[WebSocket] Connection closed');
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [queryClient]);

  // Fetch task statuses from DirectMobileScriptService
  // Only fetch and poll when there are actually running tasks
  const { data: taskStatuses } = useQuery({
    queryKey: ["/api/direct/tasks"],
    queryFn: async () => {
      const response = await fetch('/api/direct/tasks');
      if (!response.ok) {
        throw new Error('Failed to fetch task statuses');
      }
      return response.json();
    },
    // Only poll when there are actually running/pending tasks
    refetchInterval: (query) => {
      const data = query.state.data as any[];
      const hasRunningTasks = data?.some(task =>
        task.status === 'running' || task.status === 'pending'
      );
      // Poll every 2s ONLY if tasks are running, otherwise disable polling completely
      return hasRunningTasks ? 2000 : false;
    },
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
    // Don't use stale cache - always fetch fresh
    staleTime: 0,
  });

  // Merge device monitor data and task status with profiles
  const profilesWithDeviceStatus = profiles.map(profile => {
    const deviceStatus = deviceMonitor?.devices?.find(
      (d: DeviceStatus) => d.instanceName === profile.instanceName
    );

    // Find latest task for this profile
    const profileTasks = taskStatuses?.filter((task: any) => task.profileId === profile.id) || [];
    const latestTask = profileTasks.length > 0
      ? profileTasks.reduce((latest: any, current: any) => {
          const latestTime = new Date(latest.startedAt || 0).getTime();
          const currentTime = new Date(current.startedAt || 0).getTime();
          return currentTime > latestTime ? current : latest;
        })
      : null;

    // Determine task status
    let taskStatus = 'idle';
    if (latestTask) {
      if (latestTask.status === 'running' || latestTask.status === 'pending') {
        taskStatus = 'running';
      } else if (latestTask.status === 'completed') {
        taskStatus = 'completed';
      } else if (latestTask.status === 'failed') {
        taskStatus = 'failed';
      }
    }

    return {
      ...profile,
      // Device status (LDPlayer instance status)
      deviceStatus: deviceStatus ? {
        isRunning: deviceStatus.isRunning,
        isAdbConnected: deviceStatus.isAdbConnected,
        lastChecked: deviceStatus.lastChecked,
        health: deviceStatus.health
      } : null,
      // Task status (Script execution status)
      taskStatus: taskStatus,
      latestTask: latestTask
    };
  });

  return (
    <InstanceManager
      profiles={profilesWithDeviceStatus}
      isLoading={isLoading}
      deviceMonitorStats={deviceMonitor?.statistics}
      onNavigateToTwitterCaring={(profileId) => {
        console.log('Navigate to Twitter Caring:', profileId);
      }}
      onNavigateToSettings={() => {
        console.log('Navigate to Settings');
      }}
    />
  );
}
