# 🚀 Deploying the Backend to a DigitalOcean Droplet

This guide covers a manual deployment of the Sports Platform backend on an Ubuntu 22.04 droplet.

---

## 1. Provision Infrastructure
1. Create a Droplet (Ubuntu 22.04, 2 vCPU / 4 GB RAM recommended).
2. Enable SSH keys and configure a firewall (DigitalOcean Cloud Firewall or UFW later).
3. Obtain connection strings for external services:
   - MongoDB Atlas (`MONGODB_URI`)
   - Redis instance (`REDIS_URL`)
   - Optional: Elasticsearch cluster (`ELASTICSEARCH_URL`)

---

## 2. Base Server Setup
```bash
ssh root@<droplet-ip>
apt update && apt upgrade -y
apt install -y build-essential git ufw

# Install Node.js 20 + npm 10
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v && npm -v
```

### Create deploy user (optional but recommended)
```bash
adduser deploy
usermod -aG sudo deploy
rsync -a ~/.ssh /home/deploy/
```
Then reconnect as `deploy`.

---

## 3. Fetch the Code
```bash
cd /var/www
git clone https://github.com/<you>/onescore-backend.git
cd onescore-backend/backend
npm install --production
```

---

## 4. Environment Variables
Create `.env` inside `backend/`:
```
MONGODB_URI=...
REDIS_URL=...
ELASTICSEARCH_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain
FRONTEND_URL=https://your-frontend-domain
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```
(See `env.example` for the full list.)

Keep permissions tight:
```bash
chmod 600 .env
```

---

## 5. Build & Test
```bash
npm run build
npm run lint    # optional but recommended
```
Compiled files go to `dist/`.

---

## 6. Process Manager (PM2)
Install PM2 globally and use the provided ecosystem file.
```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js        # uses dist/index.js
pm2 save
pm2 startup systemd                  # follow the prompt to enable auto-start
```

`ecosystem.config.js` default values:
- name: `onescore-backend`
- script: `dist/index.js`
- env: `NODE_ENV=production`, `PORT=5000`
Adjust if necessary.

---

## 7. Reverse Proxy (Nginx)
```bash
apt install -y nginx
rm /etc/nginx/sites-enabled/default
```

Create `/etc/nginx/sites-available/onescore-backend`:
```
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:
```bash
ln -s /etc/nginx/sites-available/onescore-backend /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### SSL (Let’s Encrypt)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.your-domain.com
```

---

## 8. Firewall Hardening
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 9. Monitoring & Logs
- Logs stored in `logs/` (`winston`).
- `pm2 logs onescore-backend` for runtime logs.
- Optional: install `pm2-logrotate`, `fail2ban`, and `htop`.

Health endpoint for uptime checks: `GET https://api.your-domain.com/health`.

---

## 10. Updating
```bash
cd /var/www/onescore-backend/backend
git pull origin main
npm install --production
npm run build
pm2 reload onescore-backend
```

---

## 11. Troubleshooting
| Symptom | Check |
| --- | --- |
| 500 errors | `pm2 logs onescore-backend` |
| Port in use | `sudo lsof -i :5000` |
| Mongo connection fails | Security group / IP allow list in Atlas |
| CORS issues | `CORS_ORIGIN` & Nginx proxy headers |
| Socket.IO blocked | Ensure `Upgrade` / `Connection` headers present in Nginx |

---

This backend is now ready to serve traffic on DigitalOcean. For frontend deployment use the Vercel guide in the root of the repo.***

