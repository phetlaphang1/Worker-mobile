import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tasks from Task Center API
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey(), // Using Task Center ID as primary key
  name: text("name").notNull().default('Untitled Task'),  
  profileId: integer("profile_id"), // Profile ID from Task Center  
  scriptId: integer("script_id"), // Script ID from Task Center
  subWorkerId: integer("sub_worker_id"), // Sub Worker ID from Task Center
  description: text("description").notNull(),
  status: text("status").notNull(), // READY, RUNNING, COMPLETED, FAILED  
  profile: json("profile_data"), // Full profile object from API
  script: json("script_data"), // Full script object from API
  request: json("request"), // Request data from Task Center
  response: json("response"), // Response data from Task Center
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at"),
});

// Profiles (stored locally)
export const profiles = pgTable("browser_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isHeadless: boolean("is_headless").default(false),
  isIncognito: boolean("is_incognito").default(false),
  description: text("description"),
  browser: text("browser").notNull(), // chrome-windows, chrome-linux, firefox-windows, etc.
  userAgent: text("user_agent"),
  customUserAgent: text("custom_user_agent"),
  viewportWidth: integer("viewport_width").default(1280),
  viewportHeight: integer("viewport_height").default(720),
  timezone: text("timezone").default("America/New_York"),
  language: text("language").default("en-US"),
  useProxy: boolean("use_proxy").default(false),
  proxyType: text("proxy_type").default("http"), // http, https, socks5
  proxyHost: text("proxy_host"),
  proxyPort: text("proxy_port"),
  proxyUsername: text("proxy_username"),
  proxyPassword: text("proxy_password"),
  customField: json("custom_field"),
  localWorkerId: integer("local_worker_id"), // Worker ID from Task Center  
  localProfileId: integer("local_profile_id"), // Profile ID from Task Center    
  status: text("status").notNull().default("READY"), // READY, RUNNING, COMPLETED, FAILED
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertTaskSchema = createInsertSchema(tasks);

export const insertProfileSchema = createInsertSchema(profiles);

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export const ProfileStatus = z.enum([
  "READY",
  "RUNNING",
  "COMPLETED", 
  "FAILED"
]);

export type ProfileStatus = z.infer<typeof ProfileStatus>;

// Task Center API response types
export interface TaskCenterTask {
  id: number;
  name?: string;
  description?: string;
  status: string;  
  created_at: string;
  updated_at?: string;
  request?: any;
  response?: any; // Adding new response field
  profile?: {
    id: number;
    description: string;
    userId: number;
    isHeadless: boolean;
    isIncognito: boolean;
    name: string;    
    browser: string;
    userAgent: string;
    customUserAgent: string;
    proxy: any;
    customField?: any;
    localWorerkId: number;
    localProfileId: number;
    createdAt: string;
    updatedAt: string;    
  };
  script?: {
    id: number;
    name: string;
    content: string;
    description: string;
    size: number;
    createdAt: string;
    updatedAt: string;
  };
}
