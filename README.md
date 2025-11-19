# ⚙️ Sports Platform Backend

TypeScript/Express API that powers the Onescore sports experience. Provides auth, content, live scores, and real-time updates consumed by the Next.js frontend.

## 📦 Tech Stack
- Node.js 20+, TypeScript, Express
- MongoDB Atlas, Redis, Elasticsearch
- Socket.IO, Winston logging, Multer uploads

## 🧰 Prerequisites
- Node.js 20+ / npm 10+
- MongoDB connection string (Atlas recommended)
- Redis 7+ instance
- Optional: Elasticsearch 8+ (search features gracefully degrade if unavailable)

## ⚙️ Setup
```bash
cd backend
npm install
cp ../env.example .env   # or create your own env file
npm run dev              # starts nodemon with ts-node
```

### Key Environment Variables
| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas URI (required) |
| `REDIS_URL` | Redis connection string |
| `ELASTICSEARCH_URL` | Elasticsearch endpoint (optional) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Auth tokens |
| `SMTP_*` | Email notifications |
| `FRONTEND_URL`, `CORS_ORIGIN` | Allowed origins |
| `IMAGEKIT_*` / `CLOUDINARY_*` | Media uploads |

See `env.example` for the complete list.

## 🗂️ Scripts
```bash
npm run dev        # nodemon + ts-node
npm run build      # tsc -> dist/
npm start          # run compiled JS
npm run lint       # eslint
npm test           # jest test suite
```

## 📁 Project Structure
```
src/
├── controllers/
├── routes/
├── models/
├── middleware/
├── utils/
├── services/
└── scripts/        # create admin, seed data
```

## 🔐 Security / Ops
- Helmet, CORS, rate limiting, compression enabled
- Winston logs → `logs/` (ignored from git)
- Health endpoint: `GET /health`
- Graceful shutdown handlers for SIGINT/SIGTERM

## 🚀 Deployment
- Build: `npm run build`
- Start: `npm start` (or PM2 with `ecosystem.config.js`)
- Environment + service setup documented in [`DIGITALOCEAN_DEPLOYMENT.md`](./DIGITALOCEAN_DEPLOYMENT.md)

## 🧪 Testing
```
npm run test          # unit/integration
npm run test:watch
npm run test:coverage
```

## 🛟 Support Scripts
- `src/scripts/createAdmin.ts` – bootstrap a super admin
- `src/scripts/seedNews.ts` – seed sample news articles

Feel free to expand documentation as infrastructure evolves.***

