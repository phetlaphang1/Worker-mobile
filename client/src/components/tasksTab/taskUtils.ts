import type { Task } from '@shared/schema';

export const getLastExecutionTime = (task: Task) => {
  return task.updatedAt ? new Date(task.updatedAt).toISOString() : null;
};

export const formatExecutionTimeAgo = (timeString: string) => {
  try {
    const executionTime = new Date(timeString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - executionTime.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  } catch (error) {
    return timeString;
  }
};

export const getLocalProfileId = (task: Task, taskCenterUserId?: string | null): number | null => {
  const profile = (task as any).profile;
  if (!profile) return null;

  // First check if local_worker_id matches TASK_CENTER_USER_ID
  if (profile.localWorkerId && taskCenterUserId && profile.localWorkerId.toString() === taskCenterUserId.toString()) {
    // Only return localProfileId if worker ID matches
    if (profile.localProfileId) {
      return profile.localProfileId;
    }
  }

  return null;
};

export const searchAllTaskInfo = (task: Task, searchTerm: string): boolean => {
  if (!searchTerm) return true;
  
  const search = searchTerm.toLowerCase();
  
  // Search in basic task properties
  if (task.name?.toLowerCase().includes(search)) return true;
  if (task.id.toString().includes(search)) return true;
  if (task.status?.toLowerCase().includes(search)) return true;
  
  // Search in profile name
  const profileName = (task as any).profile?.name;
  if (profileName?.toLowerCase().includes(search)) return true;
  
  // Search in script name
  const scriptName = (task as any).script?.name;
  if (scriptName?.toLowerCase().includes(search)) return true;
  
  // Search in request data
  const requestData = (task as any).requestData;
  if (requestData) {
    const requestString = JSON.stringify(requestData).toLowerCase();
    if (requestString.includes(search)) return true;
  }
  
  // Search in response data
  const responseData = (task as any).responseData;
  if (responseData) {
    const responseString = JSON.stringify(responseData).toLowerCase();
    if (responseString.includes(search)) return true;
  }
  
  return false;
};