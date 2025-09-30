import { Profile, Task } from "../../shared/schema";

export interface ExecutionConfig {
  type: string,  
  taskId: number,  
  taskPath: string,
  task: Task | null,
  profileId: number,
  profilePath: string,
  profile: Profile,  
  config: any,       
}

export interface ExecutionResult {
  status: "COMPLETED" | "FAILED";
  message: string;
  duration: number;
  timestamp: string;
  browserType: string;
  details?: any;
  error?: string;
}