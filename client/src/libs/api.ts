import { apiRequest } from "./queryClient";
// import type { Task, Profile, InsertProfile } from "@shared/schema";

// Temporary types (should be shared from server)
type Task = any;
type Profile = any;
type InsertProfile = any;

export const api = {
  // Task operations
  tasks: {
    list: () => fetch("http://localhost:5050/api/tasks").then(res => res.json()) as Promise<Task[]>,
    get: (id: number) => fetch(`http://localhost:5050/api/tasks/${id}`).then(res => res.json()) as Promise<Task>,
    fetchFromTaskCenter: () => apiRequest("POST", "http://localhost:5050/api/tasks/fetch-from-task-center"),
    update: (id: number, data: Partial<Task>) => apiRequest("PUT", `http://localhost:5050/api/tasks/${id}`, data),
    delete: (id: number) => apiRequest("DELETE", `http://localhost:5050/api/tasks/${id}`),
    run: (params: { taskId: number; headless?: boolean }) => 
      apiRequest("POST", `http://localhost:5050/api/tasks/${params.taskId}/run`, { headless: params.headless || false }),
  },
  
  // Profile operations
  profiles: {
    list: () => fetch("http://localhost:5050/api/profiles").then(res => res.json()) as Promise<Profile[]>,
    get: (id: number) => fetch(`http://localhost:5050/api/profiles/${id}`).then(res => res.json()) as Promise<Profile>,
    create: async (data: InsertProfile) => {
      const response = await apiRequest("POST", "http://localhost:5050/api/profiles", data);
      return response.json() as Promise<Profile>;
    },
    update: (id: number, data: Partial<InsertProfile>) => apiRequest("PUT", `http://localhost:5050/api/profiles/${id}`, data),
    launch: (params: { profileId: number; headless?: boolean }) => 
      apiRequest("POST", `http://localhost:5050/api/profiles/${params.profileId}/launch`, { headless: params.headless }),
    stop: (id: number) => apiRequest("POST", `http://localhost:5050/api/profiles/${id}/stop`),
    delete: (id: number) => apiRequest("DELETE", `http://localhost:5050/api/profiles/${id}`),
    getScript: (id: number) => apiRequest("GET", `http://localhost:5050/api/profiles/${id}/script`),
    getLog: (id: number) => apiRequest("GET", `http://localhost:5050/api/profiles/${id}/log`),
    getOutput: (id: number) => apiRequest("GET", `http://localhost:5050/api/profiles/${id}/output`),
  }
};
