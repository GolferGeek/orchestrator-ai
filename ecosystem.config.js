module.exports = {
  apps: [
    {
      name: 'orchestrator-api',
      cwd: './apps/api',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        ENV_FILE: '../../.env.production',
        API_PORT: 9000
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      // Load environment from .env.production
      env_file: '../../.env.production'
    },
    {
      name: 'orchestrator-web',
      cwd: './apps/web',
      script: './node_modules/.bin/serve',
      args: 'dist -l 9001 -s',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 9001
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};