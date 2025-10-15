/**
 * Proxy Management API Routes
 *
 * Endpoints:
 * - GET /api/proxies - List all proxies
 * - POST /api/proxies - Add new proxy
 * - DELETE /api/proxies/:host/:port - Remove proxy
 * - GET /api/proxies/stats - Get proxy statistics
 * - POST /api/proxies/health-check - Trigger health check
 * - POST /api/proxies/assign/:instanceName - Assign proxy to instance
 * - POST /api/proxies/rotate/:instanceName - Rotate proxy for instance
 * - DELETE /api/proxies/assign/:instanceName - Remove proxy assignment
 * - POST /api/proxies/load - Load proxies from file
 */

import { Router, Request, Response } from 'express';
import ProxyManager from '../services/ProxyManager.js';
import { ProxyConfig, ProxyPoolConfig } from '../types/proxy.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Global proxy manager instance
let proxyManager: ProxyManager | null = null;

/**
 * Initialize proxy manager
 */
export function initializeProxyManager(config: ProxyPoolConfig): ProxyManager {
  proxyManager = new ProxyManager(config);
  logger.info('Proxy manager initialized');
  return proxyManager;
}

/**
 * Get proxy manager instance
 */
export function getProxyManager(): ProxyManager | null {
  return proxyManager;
}

// Middleware to check if proxy manager is initialized
function requireProxyManager(req: Request, res: Response, next: Function) {
  if (!proxyManager) {
    return res.status(503).json({
      error: 'Proxy manager not initialized'
    });
  }
  next();
}

/**
 * GET /api/proxies
 * List all proxies in pool
 */
router.get('/proxies', requireProxyManager, (req: Request, res: Response) => {
  try {
    const proxies = proxyManager!.getAllProxies();
    res.json({
      total: proxies.length,
      proxies: proxies.map(p => ({
        type: p.type,
        host: p.host,
        port: p.port,
        hasAuth: !!(p.username && p.password)
      }))
    });
  } catch (error) {
    logger.error('Error listing proxies:', error);
    res.status(500).json({ error: 'Failed to list proxies' });
  }
});

/**
 * POST /api/proxies
 * Add new proxy to pool
 * Body: { type, host, port, username?, password? }
 */
router.post('/proxies', requireProxyManager, (req: Request, res: Response) => {
  try {
    const { type, host, port, username, password } = req.body;

    if (!type || !host || !port) {
      return res.status(400).json({
        error: 'Missing required fields: type, host, port'
      });
    }

    const proxy: ProxyConfig = {
      type,
      host,
      port: parseInt(port),
      username,
      password
    };

    proxyManager!.addProxy(proxy);

    res.json({
      success: true,
      proxy: {
        type: proxy.type,
        host: proxy.host,
        port: proxy.port,
        hasAuth: !!(proxy.username && proxy.password)
      }
    });

  } catch (error) {
    logger.error('Error adding proxy:', error);
    res.status(500).json({ error: 'Failed to add proxy' });
  }
});

/**
 * DELETE /api/proxies/:host/:port
 * Remove proxy from pool
 */
router.delete('/proxies/:host/:port', requireProxyManager, (req: Request, res: Response) => {
  try {
    const { host, port } = req.params;

    proxyManager!.removeProxy(host, parseInt(port));

    res.json({
      success: true,
      message: `Removed proxy ${host}:${port}`
    });

  } catch (error) {
    logger.error('Error removing proxy:', error);
    res.status(500).json({ error: 'Failed to remove proxy' });
  }
});

/**
 * GET /api/proxies/stats
 * Get proxy statistics
 */
router.get('/proxies/stats', requireProxyManager, (req: Request, res: Response) => {
  try {
    const stats = proxyManager!.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting proxy stats:', error);
    res.status(500).json({ error: 'Failed to get proxy stats' });
  }
});

/**
 * POST /api/proxies/health-check
 * Trigger health check for all proxies
 */
router.post('/proxies/health-check', requireProxyManager, async (req: Request, res: Response) => {
  try {
    // Run health check asynchronously
    proxyManager!.checkAllProxiesHealth().catch(error => {
      logger.error('Health check error:', error);
    });

    res.json({
      success: true,
      message: 'Health check started'
    });

  } catch (error) {
    logger.error('Error starting health check:', error);
    res.status(500).json({ error: 'Failed to start health check' });
  }
});

/**
 * POST /api/proxies/assign/:instanceName
 * Assign proxy to instance
 * Body: { sticky?: boolean, proxyIndex?: number }
 */
router.post('/proxies/assign/:instanceName', requireProxyManager, (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;
    const { sticky = true, proxyIndex } = req.body;

    let proxy: ProxyConfig | null;

    if (proxyIndex !== undefined) {
      // Manual assignment
      proxy = proxyManager!.assignSpecificProxy(instanceName, proxyIndex, sticky);
    } else {
      // Auto assignment
      proxy = proxyManager!.assignProxyToInstance(instanceName, sticky);
    }

    if (!proxy) {
      return res.status(404).json({
        error: 'No proxy available'
      });
    }

    res.json({
      success: true,
      instanceName,
      proxy: {
        type: proxy.type,
        host: proxy.host,
        port: proxy.port
      },
      sticky
    });

  } catch (error) {
    logger.error('Error assigning proxy:', error);
    res.status(500).json({ error: 'Failed to assign proxy' });
  }
});

/**
 * POST /api/proxies/rotate/:instanceName
 * Rotate proxy for instance (force change)
 */
router.post('/proxies/rotate/:instanceName', requireProxyManager, (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;

    const proxy = proxyManager!.rotateProxyForInstance(instanceName);

    if (!proxy) {
      return res.status(404).json({
        error: 'No proxy available'
      });
    }

    res.json({
      success: true,
      instanceName,
      newProxy: {
        type: proxy.type,
        host: proxy.host,
        port: proxy.port
      }
    });

  } catch (error) {
    logger.error('Error rotating proxy:', error);
    res.status(500).json({ error: 'Failed to rotate proxy' });
  }
});

/**
 * DELETE /api/proxies/assign/:instanceName
 * Remove proxy assignment from instance
 */
router.delete('/proxies/assign/:instanceName', requireProxyManager, (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;

    proxyManager!.removeAssignment(instanceName);

    res.json({
      success: true,
      message: `Removed proxy assignment for ${instanceName}`
    });

  } catch (error) {
    logger.error('Error removing proxy assignment:', error);
    res.status(500).json({ error: 'Failed to remove proxy assignment' });
  }
});

/**
 * POST /api/proxies/load
 * Load proxies from file
 * Body: { filePath?: string }
 */
router.post('/proxies/load', requireProxyManager, async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;

    const count = await proxyManager!.loadProxiesFromFile(filePath);

    res.json({
      success: true,
      loaded: count,
      message: `Loaded ${count} proxies from file`
    });

  } catch (error) {
    logger.error('Error loading proxies from file:', error);
    res.status(500).json({ error: 'Failed to load proxies from file' });
  }
});

/**
 * POST /api/proxies/save
 * Save current proxies to file
 * Body: { filePath?: string }
 */
router.post('/proxies/save', requireProxyManager, async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;

    await proxyManager!.saveProxiesToFile(filePath);

    res.json({
      success: true,
      message: 'Proxies saved to file'
    });

  } catch (error) {
    logger.error('Error saving proxies to file:', error);
    res.status(500).json({ error: 'Failed to save proxies to file' });
  }
});

/**
 * GET /api/proxies/assignments
 * Get all proxy assignments
 */
router.get('/proxies/assignments', requireProxyManager, (req: Request, res: Response) => {
  try {
    const assignments = proxyManager!.getAllAssignments();

    const list = Array.from(assignments.entries()).map(([instanceName, assignment]) => ({
      instanceName,
      proxy: {
        type: assignment.proxy.type,
        host: assignment.proxy.host,
        port: assignment.proxy.port
      },
      assignedAt: assignment.assignedAt,
      sticky: assignment.sticky
    }));

    res.json({
      total: list.length,
      assignments: list
    });

  } catch (error) {
    logger.error('Error getting proxy assignments:', error);
    res.status(500).json({ error: 'Failed to get proxy assignments' });
  }
});

/**
 * GET /api/proxies/assignment/:instanceName
 * Get proxy assigned to specific instance
 */
router.get('/proxies/assignment/:instanceName', requireProxyManager, (req: Request, res: Response) => {
  try {
    const { instanceName } = req.params;

    const proxy = proxyManager!.getAssignedProxy(instanceName);

    if (!proxy) {
      return res.status(404).json({
        error: `No proxy assigned to instance ${instanceName}`
      });
    }

    res.json({
      instanceName,
      proxy: {
        type: proxy.type,
        host: proxy.host,
        port: proxy.port,
        hasAuth: !!(proxy.username && proxy.password)
      }
    });

  } catch (error) {
    logger.error('Error getting proxy assignment:', error);
    res.status(500).json({ error: 'Failed to get proxy assignment' });
  }
});

/**
 * POST /api/proxies/start-health-check
 * Start automatic health checking
 * Body: { intervalMs?: number }
 */
router.post('/proxies/start-health-check', requireProxyManager, (req: Request, res: Response) => {
  try {
    const { intervalMs = 300000 } = req.body; // Default 5 minutes

    proxyManager!.startHealthCheck(intervalMs);

    res.json({
      success: true,
      message: `Started health check every ${intervalMs}ms`
    });

  } catch (error) {
    logger.error('Error starting health check:', error);
    res.status(500).json({ error: 'Failed to start health check' });
  }
});

/**
 * POST /api/proxies/stop-health-check
 * Stop automatic health checking
 */
router.post('/proxies/stop-health-check', requireProxyManager, (req: Request, res: Response) => {
  try {
    proxyManager!.stopHealthCheck();

    res.json({
      success: true,
      message: 'Stopped health check'
    });

  } catch (error) {
    logger.error('Error stopping health check:', error);
    res.status(500).json({ error: 'Failed to stop health check' });
  }
});

export default router;
