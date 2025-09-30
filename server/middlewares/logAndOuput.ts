import { Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LOCAL_PROFILE} from "../config";
import { getTaskPathFromTaskId } from "./utils";

interface FileInfo {
  name: string;
  size: number;
  type: 'file' | 'directory';
  extension?: string;
  lastModified?: string;
}

/**
 * Get log content for a profile or task
 */
export async function getLog(req: Request, res: Response, isTask: boolean = false): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID parameter' });
      return;
    }

    let logContent: string | null;
    let logPath;
    
    if (isTask) {
      // For tasks, read from profiles_from_tasks folder
      const taskPath = await getTaskPathFromTaskId(id) || "";
      logPath = path.join(taskPath, 'script.log');
           
    } else {
      // For profiles, read from profiles folder
      const taskPath = path.join(LOCAL_PROFILE, id.toString(), 'local');
      logPath = path.join(taskPath, 'script.log');            
    }

    try {
      logContent = await fs.readFile(logPath, 'utf8');
    } catch (error) {
      logContent = 'No log available for this profile.';
    }

    res.json({ content: logContent });
  } catch (error) {
    console.error('Error reading log:', error);
    res.status(500).json({ error: 'Failed to read log file' });
  }
}

/**
 * Get output folder contents for a profile or task
 */
export async function getOutput(req: Request, res: Response, isTask: boolean = false): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID parameter' });
      return;
    }

    let outputPath: string;
    let files: FileInfo[] = [];

    if (isTask) {
      // For tasks, read from profiles_from_tasks folder
      const taskPath = await getTaskPathFromTaskId(id) || "";
      outputPath = path.join(taskPath, 'output');
    } else {
      // For profiles, read from profiles folder
      const taskPath = path.join(LOCAL_PROFILE, id.toString(), 'local');
      outputPath = path.join(taskPath, 'output');
    }

    // If files array is empty (for tasks), read directory manually
    if (files.length === 0) {
      try {
        const entries = await fs.readdir(outputPath, { withFileTypes: true });
        files = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(outputPath, entry.name);
            const stats = await fs.stat(fullPath);
            return {
              name: entry.name,
              size: stats.size,
              type: entry.isDirectory() ? 'directory' : 'file',
              extension: entry.isFile() ? path.extname(entry.name).slice(1) : undefined,
              lastModified: stats.mtime.toISOString(),
            };
          })
        );
      } catch (error) {
        // Output folder doesn't exist yet
        files = [];
      }
    }

    res.json({
      path: outputPath,
      files: files,
    });
  } catch (error) {
    console.error('Error reading output folder:', error);
    res.status(500).json({ error: 'Failed to read output folder' });
  }
}

/**
 * Serve a specific file from the output folder and update file metadata on each request
 */
export async function getOutputFile(req: Request, res: Response, isTask: boolean = false): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const filename = req.params.filename;
    
    if (isNaN(id) || !filename) {
      res.status(400).json({ error: 'Invalid ID or filename parameter' });
      return;
    }

    let outputPath: string;
    
    if (isTask) {
      // For tasks, read from profiles_from_tasks folder
      const taskPath = await getTaskPathFromTaskId(id) || "";
      outputPath = path.join(taskPath, 'output');
    } else {
      // For profiles, read from profiles folder
      const profilePath = path.join(LOCAL_PROFILE, id.toString(), 'local');
      outputPath = path.join(profilePath, 'output');
    }

    const filePath = path.join(outputPath, filename);
    
    // Security check: ensure the file is within the output directory
    const resolvedPath = path.resolve(filePath);
    const resolvedOutputPath = path.resolve(outputPath);
    if (!resolvedPath.startsWith(resolvedOutputPath)) {
      res.status(403).json({ error: 'Access denied: Invalid file path' });
      return;
    }

    try {
      // Always get fresh file stats on each request to update metadata
      const stats = await fs.stat(filePath);
      const fileExtension = path.extname(filename).toLowerCase();
      
      // Set appropriate content type based on file extension
      const mimeTypes: { [key: string]: string } = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.json': 'application/json',
        '.txt': 'text/plain',
        '.log': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
      };

      const contentType = mimeTypes[fileExtension] || 'application/octet-stream';
      
      // Force fresh content by disabling all caching
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('ETag', `"${stats.mtime.getTime()}-${stats.size}"`);
      
      // Log file serving for debugging with updated metadata
      console.log(`Serving file: ${filename} for ${isTask ? 'task' : 'profile'} ${id}`);
      console.log(`File path: ${filePath}`);
      console.log(`File size: ${stats.size} bytes`);
      console.log(`Last modified: ${stats.mtime.toISOString()}`);
      console.log(`Content type: ${contentType}`);

      // Read fresh file content on each request
      const fileContent = await fs.readFile(filePath);
      res.send(fileContent);
      
      console.log(`Successfully served fresh file: ${filename}`);
    } catch (fileError) {
      console.error(`File not found: ${filePath}`, fileError);
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error serving output file:', error);
    res.status(500).json({ error: 'Failed to serve output file' });
  }
}
