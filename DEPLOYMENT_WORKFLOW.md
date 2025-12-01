# 🚀 Deployment Workflow - Always Deploy via GitHub

This document outlines the standard deployment workflow for the Sports Platform backend.

## 📋 Standard Deployment Process

### 1. Make Changes Locally
```bash
cd backend
# Make your code changes
# Test locally if possible
```

### 2. Commit and Push to GitHub
```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat: Add new feature" 
# or
git commit -m "fix: Fix bug description"

# Push to GitHub
git push origin main
```

### 3. Deploy to Production Server
```bash
# SSH into production server
ssh root@161.35.190.242

# Navigate to backend directory
cd /opt/backend

# Pull latest changes from GitHub
git pull origin main

# Install any new dependencies
npm install

# Build the TypeScript project
npm run build

# Restart the backend with PM2 (updates environment variables)
pm2 restart onescore-backend --update-env

# Check logs to verify deployment
pm2 logs onescore-backend --lines 20
```

## 🔄 Quick Deploy Script

You can create a quick deploy script on the server:

```bash
# On the server, create: /opt/backend/deploy.sh
cat > /opt/backend/deploy.sh << 'EOF'
#!/bin/bash
set -e
cd /opt/backend
echo "🔄 Pulling latest changes from GitHub..."
git pull origin main
echo "📦 Installing dependencies..."
npm install
echo "🔨 Building TypeScript..."
npm run build
echo "🔄 Restarting backend..."
pm2 restart onescore-backend --update-env
echo "✅ Deployment complete!"
pm2 logs onescore-backend --lines 10 --nostream
EOF

chmod +x /opt/backend/deploy.sh
```

Then deploy with:
```bash
ssh root@161.35.190.242 "/opt/backend/deploy.sh"
```

## ⚠️ Important Notes

1. **Always commit and push to GitHub first** - Never edit files directly on the server
2. **Test locally when possible** - Catch errors before deploying
3. **Use descriptive commit messages** - Helps track changes
4. **Check logs after deployment** - Verify everything is working
5. **Environment variables** - Use `--update-env` flag to reload .env changes

## 🔍 Troubleshooting

### Build Fails
```bash
# Check if TypeScript is installed
npm list -g typescript

# Install if missing
npm install -g typescript
```

### PM2 Not Restarting
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs onescore-backend

# Manual restart
pm2 restart onescore-backend --update-env
```

### Git Pull Fails
```bash
# Check if there are local changes
git status

# Stash or commit local changes
git stash
# or
git commit -am "Local changes"
```

## 📝 Frontend Deployment

The frontend is a separate repository. Deploy it similarly:

```bash
cd frontend
git add .
git commit -m "feat: Description"
git push origin main

# Then on the frontend server (if separate)
# or trigger Vercel deployment (if using Vercel)
```

## 🎯 Best Practices

1. **Small, frequent commits** - Easier to track and rollback
2. **Test before pushing** - Run `npm run build` locally
3. **Monitor after deployment** - Check logs and API responses
4. **Use feature branches** - For major changes, use branches
5. **Document breaking changes** - Update README or CHANGELOG

