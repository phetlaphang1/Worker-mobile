/**
 * PM2 Ecosystem Configuration - Worker-mobile Core Services
 *
 * CORE SERVICES:
 *   - worker-server: Main backend API server (port 5051)
 *   - worker-frontend: Vite dev server (port 7000)
 *
 * COMMANDS:
 *   npm run pm2:start       - Start core services
 *   npm run pm2:stop        - Stop all
 *   npm run pm2:restart     - Restart core services
 *   npm run pm2:logs        - View logs
 *   npm run pm2:status      - Check status
 *   npm run pm2:delete      - Delete all processes
 *   pm2 monit               - Real-time monitoring
 *
 * INSTANCE MANAGEMENT (Dynamic LDPlayer instances):
 *   See PM2_COMMANDS.md for full documentation
 *   npx tsx scripts/pm2-instances.ts start <profileId>
 *   npx tsx scripts/pm2-instances.ts stop <profileId>
 *   npx tsx scripts/pm2-instances.ts list
 */

module.exports = {
  apps: [
    // ========================================
    // CORE: Backend Server (Main Controller)
    // ========================================
    {
      name: 'worker-server',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5051,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5051,
      },
      error_file: './logs/pm2/server-error.log',
      out_file: './logs/pm2/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
    },

    // ========================================
    // CORE: Frontend (Vite Dev Server)
    // ========================================
    {
      name: 'worker-frontend',
      script: 'C:\\Program Files\\nodejs\\npx.cmd',
      args: 'vite --host',
      cwd: './client',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/pm2/frontend-error.log',
      out_file: './logs/pm2/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
    },

    // ========================================
    // Instance Workers
    // ========================================
    // NOTE: Instance workers are now managed by InstanceWorkerService
    // instead of PM2 due to Windows environment variable issues.
    // Workers are started automatically via the API:
    //   POST /api/pm2/spawn-all-workers
    // Or individually via:
    //   POST /api/pm2/instance/:profileId/start
  ],

  // ========================================
  // Deployment Configuration (Optional)
  // ========================================
  deploy: {
    production: {
      user: 'admin',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/phetlaphang1/Worker-mobile.git',
      path: '/var/www/worker-mobile',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.cjs --env production',
    },
  },
};
