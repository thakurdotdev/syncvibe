module.exports = {
  apps: [
    {
      name: 'syncvibe-api',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
