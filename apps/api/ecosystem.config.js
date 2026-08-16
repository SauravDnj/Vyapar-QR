// PM2 process definition for running the built API directly on a VPS —
// no Docker. `pnpm build` first (produces dist/main.js), then
// `pm2 start ecosystem.config.js --env production`.
module.exports = {
  apps: [
    {
      name: 'qrhub-api',
      cwd: __dirname,
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
