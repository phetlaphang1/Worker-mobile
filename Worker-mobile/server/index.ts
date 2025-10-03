import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import LDPlayerController from './core/LDPlayerController.js';
import ProfileManager from './services/ProfileManager.js';
import TaskExecutor from './services/TaskExecutor.js';
import MobileScriptExecutor from './services/MobileScriptExecutor.js';
import { setupRoutes } from './routes/index.js';
import { logger } from './utils/logger.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// CORS middleware - allow all origins in development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory (for React build)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Initialize core services
const ldPlayerController = new LDPlayerController();
const profileManager = new ProfileManager(ldPlayerController);
const taskExecutor = new TaskExecutor(ldPlayerController, profileManager, {
  taskCenterUrl: process.env.TASK_CENTER_URL,
  taskCenterApiKey: process.env.TASK_CENTER_API_KEY,
  taskCenterUserId: process.env.TASK_CENTER_USER_ID,
  maxConcurrentTasks: 5,
  taskCheckInterval: 30000
});
const scriptExecutor = new MobileScriptExecutor(ldPlayerController, profileManager);

// Inject scriptExecutor into profileManager (to avoid circular dependency)
profileManager.setScriptExecutor(scriptExecutor);

// WebSocket connection handling
wss.on('connection', (ws) => {
  logger.info('New WebSocket connection established');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'get_status':
          ws.send(JSON.stringify({
            type: 'status',
            data: {
              profiles: profileManager.getStatistics(),
              tasks: {
                pending: taskExecutor.getPendingTasks().length,
                running: taskExecutor.getRunningTasks().length,
                total: taskExecutor.getAllTasks().length
              },
              instances: ldPlayerController.getInstances()
            }
          }));
          break;

        case 'create_profile':
          const profile = await profileManager.createProfile(data.config);
          ws.send(JSON.stringify({
            type: 'profile_created',
            data: profile
          }));
          break;

        case 'activate_profile':
          await profileManager.activateProfile(data.profileId);
          ws.send(JSON.stringify({
            type: 'profile_activated',
            data: { profileId: data.profileId }
          }));
          break;

        case 'add_task':
          const task = await taskExecutor.addTask(data.task);
          ws.send(JSON.stringify({
            type: 'task_added',
            data: task
          }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`
          }));
      }
    } catch (error) {
      logger.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Broadcast function for real-time updates
export function broadcast(type: string, data: any): void {
  const message = JSON.stringify({ type, data });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Setup API routes
setupRoutes(app, {
  ldPlayerController,
  profileManager,
  taskExecutor,
  scriptExecutor
});

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  // Don't serve HTML for API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Express error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// Start services
async function startServices() {
  try {
    // Start task executor
    await taskExecutor.start();
    logger.info('Task executor started');

    // Server port
    const port = process.env.PORT || 5051;

    // Start server
    server.listen(port, () => {
      logger.info(`Mobile Worker server running on port ${port}`);
      logger.info(`WebSocket server ready on ws://localhost:${port}`);

      console.log(`
╔════════════════════════════════════════════╗
║       Mobile Worker System Started          ║
╠════════════════════════════════════════════╣
║  API Server: http://localhost:${port}         ║
║  WebSocket:  ws://localhost:${port}           ║
║  Environment: ${process.env.NODE_ENV || 'development'}                  ║
╚════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    logger.error('Failed to start services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  await taskExecutor.stop();
  await profileManager.deactivateAllProfiles();

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  await taskExecutor.stop();
  await profileManager.deactivateAllProfiles();

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start the application
startServices();