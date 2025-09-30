import type { Profile } from '@shared/schema';

export const formatDate = (date: Date | string | null) => {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatTimeAgo = (date: Date | string | null) => {
  if (!date) return "Never";
  const now = new Date();
  const then = new Date(date);
  const diffInHours = Math.floor(
    (now.getTime() - then.getTime()) / (1000 * 60 * 60),
  );

  if (diffInHours < 1) return "Less than 1 hour ago";
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} days ago`;
};

export const getLastExecutionTime = (profile: Profile) => {
  return profile.updatedAt ? new Date(profile.updatedAt).toISOString() : null;
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
    return timeString; // Fallback to original string if parsing fails
  }
};

export const getBrowserIcon = (browser: string) => {
  switch (browser.toLowerCase()) {
    case "chrome":
    case "google chrome":
      return "🌐";
    case "firefox":
    case "mozilla firefox":
      return "🦊";
    case "edge":
    case "microsoft edge":
      return "🔷";
    case "safari":
      return "🧭";
    default:
      return "🌐";
  }
};