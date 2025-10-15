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
import AppiumScriptService from './services/AppiumScriptService.js';
import DirectMobileScriptService from './services/DirectMobileScriptService.js';
import UIInspectorService from './services/UIInspectorService.js';
import DeviceMonitor from './services/DeviceMonitor.js';
import FingerprintService from './services/FingerprintService.js';
import { setupRoutes } from './routes/index.js';
import { logger } from './utils/logger.js';
import { initializeProxyManager } from './routes/proxy.js';

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// Script services - Choose one or use both!
const appiumScriptService = new AppiumScriptService(ldPlayerController, profileManager); // Needs Appium server
const directScriptService = new DirectMobileScriptService(ldPlayerController, profileManager); // ADB only, no server!

// UI Inspector Service - Auto XPath generation
const uiInspectorService = new UIInspectorService(ldPlayerController);

// Device Monitor - Real-time instance monitoring and logcat
const deviceMonitor = new DeviceMonitor(ldPlayerController, {
  checkInterval: 5000, // Check every 5 seconds
  enableLogcat: true,
  enableHealthCheck: true
});

// Fingerprint Service - Device fingerprint randomization (GemLogin-like)
const fingerprintService = new FingerprintService(ldPlayerController);

// TaskExecutor can use either service
// For simplicity, we default to DirectScriptService (no Appium server needed)
const taskExecutor = new TaskExecutor(ldPlayerController, profileManager, {
  taskCenterUrl: process.env.TASK_CENTER_URL,
  taskCenterApiKey: process.env.TASK_CENTER_API_KEY,
  taskCenterUserId: process.env.TASK_CENTER_USER_ID,
  maxConcurrentTasks: 5,
  taskCheckInterval: 30000
}, directScriptService); // Using ADB-based service by default

const scriptExecutor = new MobileScriptExecutor(ldPlayerController, profileManager);

// Inject scriptExecutor into profileManager (to avoid circular dependency)
profileManager.setScriptExecutor(scriptExecutor);

// Inject fingerprintService into profileManager (for auto-apply on create/clone)
profileManager.setFingerprintService(fingerprintService);

// Broadcast log function will be defined after clientSubscriptions
// We'll set it up after the WebSocket server is configured

// Track client subscriptions for logs
// Map: clientId -> { type: 'task'|'profile', id: number }
const clientSubscriptions = new Map<any, { type: string; id: number }>();

// Broadcast log to subscribed clients
function broadcastLog(logType: 'task' | 'profile', id: number, logMessage: string, timestamp: string): void {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      const subscription = clientSubscriptions.get(client);

      // Only send to clients subscribed to this specific type and id
      if (subscription && subscription.type === logType && subscription.id === id) {
        client.send(JSON.stringify({
          type: logType,
          id: id,
          message: logMessage,
          timestamp: timestamp
        }));
      }
    }
  });
}

// Inject broadcast functions into services for WebSocket updates
taskExecutor.setBroadcast(broadcast);
directScriptService.setBroadcast(broadcastLog);
directScriptService.setBroadcastStatus(broadcast); // For profile status updates

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Suppress noisy connection logs
  // logger.info('New WebSocket connection established');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'task':
        case 'profile':
          // Client subscribing to logs for a specific task or profile
          clientSubscriptions.set(ws, { type: data.type, id: data.id });
          // Suppress subscription logs
          // logger.info(`Client subscribed to ${data.type} logs for ID: ${data.id}`);
          ws.send(JSON.stringify({
            type: 'subscribed',
            message: `Subscribed to ${data.type} ${data.id} logs`
          }));
          break;

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
    clientSubscriptions.delete(ws);
    // Suppress close logs
    // logger.info('WebSocket connection closed and subscription removed');
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Broadcast function for real-time updates (general broadcasts)
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
  scriptExecutor,
  appiumScriptService, // For advanced users who want Appium
  directScriptService, // For most users - simple ADB automation
  uiInspectorService, // Auto XPath generation
  deviceMonitor, // Real-time monitoring and logcat
  fingerprintService // Device fingerprint randomization (GemLogin-like)
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
    // Load all instances from LDPlayer FIRST (critical!)
    await ldPlayerController.getAllInstancesFromLDConsole();
    // logger.info('LDPlayer instances loaded');

    // Initialize profile manager first
    await profileManager.initialize();
    // logger.info('Profile manager initialized');

    // Start task executor
    await taskExecutor.start();
    // logger.info('Task executor started');

    // Start device monitor
    await deviceMonitor.start();
    // logger.info('Device monitor started');

    // Initialize proxy manager
    const proxyManager = initializeProxyManager({
      proxies: [],
      rotationStrategy: 'least-used',
      maxUsagePerProxy: 100
    });
    // logger.info('Proxy manager initialized');

    // Try to load proxies from file (optional)
    try {
      const count = await proxyManager.loadProxiesFromFile();
      // logger.info(`Loaded ${count} proxies from file`);
    } catch (error) {
      // logger.info('No proxies file found, starting with empty pool');
    }

    // Server port
    const port = process.env.PORT || 5051;

    // Start server
    server.listen(port, () => {
      // Suppress startup logs - only show if error occurs
      // logger.info(`Mobile Worker server running on port ${port}`);
      // logger.info(`WebSocket server ready on ws://localhost:${port}`);

      // Suppress banner - too noisy for production
      // console.log(`
      // ╔════════════════════════════════════════════╗
      // ║       Mobile Worker System Started          ║
      // ╠════════════════════════════════════════════╣
      // ║  API Server: http://localhost:${port}         ║
      // ║  WebSocket:  ws://localhost:${port}           ║
      // ║  Environment: ${process.env.NODE_ENV || 'development'}                  ║
      // ╚════════════════════════════════════════════╝
      // `);
    });

  } catch (error) {
    logger.error('Failed to start services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);

  try {
    // Step 1: Stop device monitor
    // logger.info('Stopping device monitor...');
    await deviceMonitor.stop();

    // Step 2: Stop task executor (no new tasks)
    // logger.info('Stopping task executor...');
    await taskExecutor.stop();

    // Step 3: Deactivate all profiles (stops scripts)
    // logger.info('Deactivating all profiles...');
    await profileManager.deactivateAllProfiles();

    // Step 4: Stop all LDPlayer instances properly
    // logger.info('Stopping all LDPlayer instances...');
    const stopResult = await ldPlayerController.stopAllInstances({
      onlyRunning: true,
      delay: 2000
    });
    // logger.info(`Stopped ${stopResult.successCount} instances, ${stopResult.failCount} failed`);

    // Step 5: Close server
    server.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.warn('Graceful shutdown timeout, forcing exit...');
      process.exit(1);
    }, 10000);

  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections (crash scenarios)
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  await gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the application
startServices();