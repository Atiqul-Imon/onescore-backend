import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis(REDIS_URL, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info('Redis disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  public isReady(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  // Cache methods
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  public async get(key: string): Promise<any> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  public async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      throw error;
    }
  }

  // Hash methods for complex data
  public async hset(key: string, field: string, value: any): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.client.hset(key, field, serializedValue);
    } catch (error) {
      logger.error(`Redis HSET error for key ${key}, field ${field}:`, error);
      throw error;
    }
  }

  public async hget(key: string, field: string): Promise<any> {
    try {
      const value = await this.client.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis HGET error for key ${key}, field ${field}:`, error);
      return null;
    }
  }

  public async hdel(key: string, field: string): Promise<void> {
    try {
      await this.client.hdel(key, field);
    } catch (error) {
      logger.error(`Redis HDEL error for key ${key}, field ${field}:`, error);
      throw error;
    }
  }

  // List methods for queues
  public async lpush(key: string, value: any): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.client.lpush(key, serializedValue);
    } catch (error) {
      logger.error(`Redis LPUSH error for key ${key}:`, error);
      throw error;
    }
  }

  public async rpop(key: string): Promise<any> {
    try {
      const value = await this.client.rpop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis RPOP error for key ${key}:`, error);
      return null;
    }
  }

  // Set methods for unique values
  public async sadd(key: string, value: any): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.client.sadd(key, serializedValue);
    } catch (error) {
      logger.error(`Redis SADD error for key ${key}:`, error);
      throw error;
    }
  }

  public async smembers(key: string): Promise<any[]> {
    try {
      const values = await this.client.smembers(key);
      return values.map(value => JSON.parse(value));
    } catch (error) {
      logger.error(`Redis SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  // Pattern-based operations
  public async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }

  // Flush database (use with caution)
  public async flushdb(): Promise<void> {
    try {
      await this.client.flushdb();
      logger.info('Redis database flushed');
    } catch (error) {
      logger.error('Redis FLUSHDB error:', error);
      throw error;
    }
  }

  // Get Redis info
  public async info(): Promise<string> {
    try {
      return await this.client.info();
    } catch (error) {
      logger.error('Redis INFO error:', error);
      return '';
    }
  }
}

// Create singleton instance
export const redisClient = new RedisClient();

// Export connection function
export const connectRedis = async (): Promise<void> => {
  await redisClient.connect();
};

// Export disconnect function
export const disconnectRedis = async (): Promise<void> => {
  await redisClient.disconnect();
};
