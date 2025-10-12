import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import InstanceManager from './InstanceManager';
import { api } from '@/libs/api';
import type { Profile } from '@shared/schema';
import { getWebSocketUrl } from '@shared/socket';

export function InstancesTab() {
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading, refetch } = useQuery<Profile[]>({
    queryKey: ["http://localhost:5051/api/profiles"],
    queryFn: api.profiles.list,
    refetchInterval: 3000, // Auto refresh every 3 seconds
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
          queryClient.invalidateQueries({ queryKey: ["http://localhost:5051/api/profiles"] });
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

  return (
    <InstanceManager
      profiles={profiles}
      isLoading={isLoading}
      onNavigateToTwitterCaring={(profileId) => {
        console.log('Navigate to Twitter Caring:', profileId);
      }}
      onNavigateToSettings={() => {
        console.log('Navigate to Settings');
      }}
    />
  );
}
