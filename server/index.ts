import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";
import { initializeWebSocketServer } from "./services/websocket";
import { initializeTasks } from "./middlewares/taskManager";
import { initializeProfiles } from "./middlewares/profileManager";
import {innitializeConfig} from "./config";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    setupVite(app, server).catch((err) => {
      console.error('Error setting up Vite:', err);
    });
  } else {
    serveStatic(app);
  }

  await initialize();

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  const host = process.env.HOST || "0.0.0.0"; // Listen on all interfaces for LDPlayer access

  server.listen({
    port,
    host,
    // reusePort: trueregisterRoutes,
  }, () => {
    log(`serving on port ${port}`);

    // Show access URLs
    import('os').then(os => {
      const networkInterfaces = os.networkInterfaces();
      console.log('\n📱 Access URLs:');
      console.log(`   Local:    http://localhost:${port}`);

      // Show all network interfaces
      Object.keys(networkInterfaces).forEach(interfaceName => {
        const interfaces = networkInterfaces[interfaceName];
        interfaces?.forEach(iface => {
          if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`   Network:  http://${iface.address}:${port}`);
          }
        });
      });

      console.log('\n🔐 Login:');
      console.log('   Username: admin');
      console.log('   Password: securepassword123\n');
    });
  });
})();

async function initialize(){
  initializeWebSocketServer();
  innitializeConfig();
  await initializeProfiles();
  await initializeTasks();  
}

