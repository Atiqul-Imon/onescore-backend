module.exports = {
  apps: [
    {
      name: 'onescore-backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5000,
      },
    },
  ],
};

