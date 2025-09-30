import { WebSocket, WebSocketServer } from "ws";
import { WEB_SOCKET_PORT } from "@shared/socket";

// Store WebSocket connections for real-time logging
let logClients = new Map<string, Set<WebSocket>>();

// Store the original console.log to avoid recursion
const originalConsoleLog = console.log;

// Function to broadcast log messages to subscribed clients
export function broadcastLog(type: string, id: number, logMessage: string, logType: 'info' | 'error' | 'success' = 'info') {
  const key = `${type}-${id}`;
  const clients = logClients.get(key);

  if (!clients) {
    // originalConsoleLog('[WebSocket] logClients not initialized yet');
    return;
  }
   
  if (clients && clients.size > 0) {
    const message = JSON.stringify({
      type: type,
      id: id,
      message: logMessage,
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });
    
    // Only log if there's an issue or for debugging
    if (sentCount === 0) {
      originalConsoleLog(`[WebSocket] Warning: No active clients for ${key}`);
    }
  }
}

// WebSocket server instance
let wss: WebSocketServer | null = null;

// Initialize WebSocket server
export function initializeWebSocketServer() {
  if (wss) {
    console.log('WebSocket server already initialized');
    return wss;
  }

  // Create WebSocket server for real-time logs
  wss = new WebSocketServer({ port: WEB_SOCKET_PORT});
  console.log(`WebSocket server started on port ${WEB_SOCKET_PORT}`);

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected for real-time logs');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Commented out verbose logging - uncomment for debugging
        // console.log(`[WebSocket] Received message:`, data);
        
        if (data.id) {
          // Subscribe to logs for specific profile
          const key = `${data.type}-${data.id}`;
          if (!logClients.has(key)) {
            logClients.set(key, new Set());
          }
          logClients.get(key)!.add(ws);
          
          console.log(`[WebSocket] Client subscribed to ${key}`);
          // originalConsoleLog('logClients: ', logClients);                  
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove client from all subscriptions
      logClients.forEach((clients, key) => {
        clients.delete(ws);
        if (clients.size === 0) {
          logClients.delete(key);
        }
        console.log(`WebSocket client with key ${key} disconnected`);
      });
      
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
}


