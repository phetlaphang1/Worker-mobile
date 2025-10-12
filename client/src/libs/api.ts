import { apiRequest } from "./queryClient";
import { apiUrl } from "../config/api.config";
// import type { Task, Profile, InsertProfile } from "@shared/schema";

// Temporary types (should be shared from server)
type Task = any;
type Profile = any;
type InsertProfile = any;

export const api = {
  // Task operations
  tasks: {
    list: () => fetch(apiUrl("/api/tasks")).then(res => res.json()) as Promise<Task[]>,
    get: (id: number) => fetch(apiUrl(`/api/tasks/${id}`)).then(res => res.json()) as Promise<Task>,
    fetchFromTaskCenter: () => apiRequest("POST", apiUrl("/api/tasks/fetch-from-task-center")),
    update: (id: number, data: Partial<Task>) => apiRequest("PUT", apiUrl(`/api/tasks/${id}`), data),
    delete: (id: number) => apiRequest("DELETE", apiUrl(`/api/tasks/${id}`)),
    run: (params: { taskId: number; headless?: boolean }) =>
      apiRequest("POST", apiUrl(`/api/tasks/${params.taskId}/run`), { headless: params.headless || false }),
  },

  // Profile operations
  profiles: {
    list: () => fetch(apiUrl("/api/profiles")).then(res => res.json()) as Promise<Profile[]>,
    get: (id: number) => fetch(apiUrl(`/api/profiles/${id}`)).then(res => res.json()) as Promise<Profile>,
    create: async (data: InsertProfile) => {
      const response = await apiRequest("POST", apiUrl("/api/profiles"), data);
      return response.json() as Promise<Profile>;
    },
    update: (id: number, data: Partial<InsertProfile>) => apiRequest("PUT", apiUrl(`/api/profiles/${id}`), data),
    launch: (params: { profileId: number; headless?: boolean }) =>
      apiRequest("POST", apiUrl(`/api/profiles/${params.profileId}/launch`), { headless: params.headless }),
    stop: (id: number) => apiRequest("POST", apiUrl(`/api/profiles/${id}/stop`)),
    delete: (id: number) => apiRequest("DELETE", apiUrl(`/api/profiles/${id}`)),
    getScript: (id: number) => apiRequest("GET", apiUrl(`/api/profiles/${id}/script`)),
    getLog: (id: number) => apiRequest("GET", apiUrl(`/api/profiles/${id}/log`)),
    getOutput: (id: number) => apiRequest("GET", apiUrl(`/api/profiles/${id}/output`)),
  }
};
