/**
 * PM2 Ecosystem Configuration for Worker-mobile + Appium
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    // ========================================
    // 1. Worker-mobile Backend Server
    // ========================================
    {
      name: 'worker-mobile-server',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false, // Don't watch in production
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5051,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5051,
      },
      error_file: './logs/pm2/worker-mobile-error.log',
      out_file: './logs/pm2/worker-mobile-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Auto-restart if crashes
      min_uptime: '10s',
      max_restarts: 10,
      // Exponential backoff restart delay
      restart_delay: 4000,
    },

    // ========================================
    // 2. Appium Server (Port 4723)
    // ========================================
    {
      name: 'appium-server',
      script: 'appium',
      args: '--address 127.0.0.1 --port 4723 --allow-cors --log-level info',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/pm2/appium-error.log',
      out_file: './logs/pm2/appium-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Auto-restart if crashes
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
    },

    // ========================================
    // 3. Frontend Dev Server (Vite on port 7000)
    // ========================================
    {
      name: 'worker-mobile-frontend',
      script: 'npm',
      args: 'run dev:client',
      cwd: __dirname,
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
