// Mock data for Worker-mobile to match browser API responses

export const mockTasks = [
  {
    id: 1,
    taskId: "TASK001",
    platform: "twitter",
    action: "like",
    status: "pending",
    profileId: null,
    data: {
      url: "https://twitter.com/example/status/123",
      description: "Like tweet"
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const mockProfiles = [
  {
    id: 1,
    name: "Profile 1",
    platform: "twitter",
    username: "user1",
    status: "active",
    cookies: "[]",
    userAgent: "Mozilla/5.0...",
    proxy: null,
    lastUsed: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const mockSettings = {
  autoRun: false,
  autoRunInterval: 30,
  headless: false,
  maxConcurrentProfiles: 3,
  defaultProxy: null,
  taskCenter: {
    url: process.env.TASK_CENTER_URL,
    apiKey: process.env.TASK_CENTER_API_KEY,
    userId: process.env.TASK_CENTER_USER_ID
  }
};

export const mockStatistics = {
  totalTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  pendingTasks: 0,
  totalProfiles: 0,
  activeProfiles: 0,
  successRate: 0
};