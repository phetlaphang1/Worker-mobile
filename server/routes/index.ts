import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./auth";
import { registerTaskRoutes } from "./tasks";
import { registerProfileRoutes } from "./profiles";
import { registerSettingsRoutes } from "./settings";
import { registerTwitterCaringRoutes } from "./twitterCaring";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register modular routes
  registerAuthRoutes(app);
  registerTaskRoutes(app);
  registerProfileRoutes(app);
  registerSettingsRoutes(app);
  registerTwitterCaringRoutes(app);

  const server = createServer(app);

  return server;
}

