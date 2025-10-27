/**
 * PM2 Ecosystem Configuration for Instance Workers
 * Each profile gets its own PM2 process
 */

module.exports = {
  apps: [
    // Worker for Profile 13 (ccccc)
    {
      name: 'instance-13',
      script: './dist/workers/instance-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PROFILE_ID: '13',
        INSTANCE_NAME: 'ccccc_13',
        ADB_PORT: '5633'
      },
      error_file: './logs/pm2/instances/instance-13-error.log',
      out_file: './logs/pm2/instances/instance-13-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: 5000,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // Worker for Profile 14 (ddddd)
    {
      name: 'instance-14',
      script: './dist/workers/instance-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PROFILE_ID: '14',
        INSTANCE_NAME: 'ddddd_14',
        ADB_PORT: '5637'
      },
      error_file: './logs/pm2/instances/instance-14-error.log',
      out_file: './logs/pm2/instances/instance-14-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: 5000,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // Profile 15 does not exist (no JSON file)
    // Worker for Profile 16 (worker_16)
    {
      name: 'instance-16',
      script: './dist/workers/instance-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PROFILE_ID: '16',
        INSTANCE_NAME: 'worker_16_16',
        ADB_PORT: '5643'
      },
      error_file: './logs/pm2/instances/instance-16-error.log',
      out_file: './logs/pm2/instances/instance-16-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: 5000,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // Worker for Profile 17 (worker_17)
    {
      name: 'instance-17',
      script: './dist/workers/instance-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PROFILE_ID: '17',
        INSTANCE_NAME: 'worker_17_17',
        ADB_PORT: '5645'
      },
      error_file: './logs/pm2/instances/instance-17-error.log',
      out_file: './logs/pm2/instances/instance-17-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: 5000,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // Worker for Profile 18 (worker_18)
    {
      name: 'instance-18',
      script: './dist/workers/instance-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PROFILE_ID: '18',
        INSTANCE_NAME: 'worker_18_18',
        ADB_PORT: '5647'
      },
      error_file: './logs/pm2/instances/instance-18-error.log',
      out_file: './logs/pm2/instances/instance-18-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: 5000,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // Worker for Profile 19 (worker_19)
    {
      name: 'instance-19',
      script: './dist/workers/instance-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PROFILE_ID: '19',
        INSTANCE_NAME: 'worker_19_19',
        ADB_PORT: '5649'
      },
      error_file: './logs/pm2/instances/instance-19-error.log',
      out_file: './logs/pm2/instances/instance-19-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: 5000,
      max_restarts: 10,
      restart_delay: 3000,
    }
  ]
};
