// Load environment variables FIRST before any imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import 'express-async-errors';

// Import routes
import cricketRoutes from './routes/cricket';
import footballRoutes from './routes/football';
import contentRoutes from './routes/content';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import threadRoutes from './routes/thread';
import commentRoutes from './routes/comment';
import newsRoutes from './routes/news';
import mediaRoutes from './routes/media';
import adminRoutes from './routes/admin';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { connectDatabase } from './utils/database';
import { connectRedis } from './utils/redis';
import { connectElasticsearch } from './utils/elasticsearch';
import { logger } from './utils/logger';
import { initializeSocketIO } from './utils/socket';

const app = express();
const server = createServer(app);
// Socket.IO CORS configuration - support multiple origins
const socketCorsOrigins = process.env['CORS_ORIGIN'] 
  ? process.env['CORS_ORIGIN'].split(',').map(origin => origin.trim())
  : ["http://localhost:3000"];

const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (socketCorsOrigins.includes(origin) || socketCorsOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  transports: ['websocket', 'polling'], // Support both WebSocket and polling
  allowEIO3: true, // Allow Engine.IO v3 clients
});

const PORT = process.env['PORT'] || 5000;

// Trust proxy (required for rate limiting behind reverse proxy)
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration - support multiple origins for production
const corsOrigins = process.env['CORS_ORIGIN'] 
  ? process.env['CORS_ORIGIN'].split(',').map(origin => origin.trim())
  : ["http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting - more lenient in development
const defaultMaxRequests = process.env.NODE_ENV === 'development' ? '1000' : '100';
const limiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
  max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || defaultMaxRequests), // Higher limit in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and news/article read endpoints
    if (req.path === '/health') return true;
    // Skip rate limiting for GET requests to news endpoints (read operations)
    if (req.method === 'GET' && req.path.startsWith('/api/news')) return true;
    return false;
  },
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV']
  });
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cricket', cricketRoutes);
app.use('/api/football', footballRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/admin', adminRoutes);

// Initialize Socket.IO
initializeSocketIO(io);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Database connections
const initializeApp = async () => {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();
    await connectElasticsearch();
    
    logger.info('All database connections established');
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env['NODE_ENV']}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize the application
initializeApp();

export default app;
