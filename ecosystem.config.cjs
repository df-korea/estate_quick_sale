module.exports = {
  apps: [
    {
      name: 'estate-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001 -H 127.0.0.1',
      cwd: __dirname + '/web',

      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,           // Next.js manages its own workers
      exec_mode: 'fork',      // cluster mode not compatible with Next.js
      autorestart: true,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/estate-web-error.log',
      out_file: 'logs/estate-web-out.log',
      merge_logs: true,
    },
  ],
};
