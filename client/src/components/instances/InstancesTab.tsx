import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import InstanceManager from './InstanceManager';
import { api } from '@/libs/api';
import type { Profile } from '@shared/schema';

export function InstancesTab() {
  const { data: profiles = [], isLoading, refetch } = useQuery<Profile[]>({
    queryKey: ["http://localhost:5050/api/profiles"],
    queryFn: api.profiles.list,
    refetchInterval: 3000, // Auto refresh every 3 seconds
  });

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
