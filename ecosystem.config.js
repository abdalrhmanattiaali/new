/**
 * PM2 Ecosystem Configuration
 * إعدادات PM2 لتشغيل التطبيق بشكل دائم
 */

module.exports = {
  apps: [
    {
      name: 'whatsapp-family-ai',
      script: './src/index.js',
      instances: 1,
      autorestart: true,
      watch: false, // Set to true for development if you want auto-reload on file changes
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      // Restart delay in case of crash
      min_uptime: '10s',
      max_restarts: 10,
      // Cron restart (optional - restart daily at 4 AM to clear memory)
      cron_restart: '0 4 * * *',
      // Kill timeout
      kill_timeout: 5000,
      // Wait time before restart
      restart_delay: 4000
    }
  ]
};
