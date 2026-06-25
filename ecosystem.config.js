/**
 * PM2 Ecosystem Configuration for VPS Deployment
 * 
 * This file configures PM2 to run B1Api as a persistent service
 * with automatic restarts, log management, and cron jobs.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'b1api-server',
      script: 'dist/vps-server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'prod'
      },
      env_demo: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'demo'
      },
      env_staging: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'staging'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10
    },
    {
      name: 'b1api-cron-15min',
      script: 'dist/vps-cron-jobs.js',
      args: '15min',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '*/30 * * * *', // Every 30 minutes
      watch: false,
      env: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'prod'
      },
      env_demo: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'demo'
      },
      env_staging: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'staging'
      },
      error_file: './logs/cron-15min-error.log',
      out_file: './logs/cron-15min-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'b1api-cron-midnight',
      script: 'dist/vps-cron-jobs.js',
      args: 'midnight',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 5 * * *', // Daily at 5 AM UTC
      watch: false,
      env: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'prod'
      },
      env_demo: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'demo'
      },
      env_staging: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'staging'
      },
      error_file: './logs/cron-midnight-error.log',
      out_file: './logs/cron-midnight-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'b1api-cron-scheduled',
      script: 'dist/vps-cron-jobs.js',
      args: 'scheduled-tasks',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 5 * * *', // Daily at 5 AM UTC
      watch: false,
      env: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'prod'
      },
      env_demo: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'demo'
      },
      env_staging: {
        NODE_ENV: 'production',
        ENVIRONMENT: 'staging'
      },
      error_file: './logs/cron-scheduled-error.log',
      out_file: './logs/cron-scheduled-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
