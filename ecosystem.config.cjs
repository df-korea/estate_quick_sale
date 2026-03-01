module.exports = {
  apps: [
    {
      name: 'estate-api',
      script: 'server.mjs',
      cwd: __dirname,

      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/estate-api-error.log',
      out_file: 'logs/estate-api-out.log',
      merge_logs: true,
    },
  ],
};
