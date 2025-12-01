import axios from 'axios';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';

interface SportsMonksConfig {
  baseUrl: string;
  apiToken: string;
  timeout: number;
}

class SportsMonksService {
  private config: SportsMonksConfig;
  private client: any;

  constructor() {
    this.config = {
      baseUrl: process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/cricket',
      apiToken: process.env.SPORTMONKS_API_TOKEN || '',
      timeout: 10000,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        api_token: this.config.apiToken, // SportsMonks uses api_token as query parameter
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`SportsMonks API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('SportsMonks API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`SportsMonks API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('SportsMonks API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Test with fixtures endpoint
      const response = await this.client.get('/fixtures/upcoming', {
        params: { per_page: 1 },
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Get live cricket matches
  async getLiveMatches(): Promise<any[]> {
    try {
      const cacheKey = 'sportsmonks:live_matches';
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // SportsMonks API 3.0 endpoint for live scores (matches docs structure)
      const response = await this.client.get('/livescores/inplay', {
        params: {
          include: 'scores,participants',
        },
      });

      const matches = response.data?.data || [];

      // Cache duration: 30 seconds in development, 15 minutes in production
      const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 30;
      await redisClient.set(cacheKey, JSON.stringify(matches), cacheDuration);

      return matches;
    } catch (error) {
      logger.error('Error fetching live cricket matches from SportsMonks:', error);
      throw new Error('Failed to fetch live cricket matches');
    }
  }

  // Get upcoming cricket matches
  async getUpcomingMatches(): Promise<any[]> {
    try {
      const cacheKey = 'sportsmonks:upcoming_matches';
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // SportsMonks API 3.0 endpoint for fixtures (matches docs structure)
      const response = await this.client.get('/fixtures/upcoming', {
        params: {
          include: 'participants',
        },
      });

      const allMatches = response.data?.data || [];
      const now = new Date();

      // Filter for truly upcoming matches
      const upcomingMatches = allMatches.filter((match: any) => {
        const matchDate = new Date(match.starting_at);
        return matchDate > now && match.state_id === 1; // 1 = Not Started
      });

      // Cache duration: 5 minutes in production, 30 seconds in development
      const cacheDuration = process.env.NODE_ENV === 'production' ? 300 : 30;
      await redisClient.set(cacheKey, JSON.stringify(upcomingMatches), cacheDuration);

      return upcomingMatches;
    } catch (error) {
      logger.error('Error fetching upcoming cricket matches from SportsMonks:', error);
      throw new Error('Failed to fetch upcoming cricket matches');
    }
  }

  // Get completed cricket matches
  async getCompletedMatches(): Promise<any[]> {
    try {
      const cacheKey = 'sportsmonks:completed_matches';
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // SportsMonks API 3.0 endpoint for results (matches docs structure)
      const response = await this.client.get('/fixtures/results', {
        params: {
          include: 'scores,participants',
        },
      });

      const matches = response.data?.data || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(matches), 3600);

      return matches;
    } catch (error) {
      logger.error('Error fetching completed cricket matches from SportsMonks:', error);
      throw new Error('Failed to fetch completed cricket matches');
    }
  }

  // Get match details by ID
  async getMatchDetails(matchId: string): Promise<any> {
    try {
      const cacheKey = `sportsmonks:match:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/fixtures/${matchId}`, {
        params: {
          include: 'scores,participants,lineups,events',
        },
      });

      const match = response.data?.data;

      // Cache for 1 minute
      await redisClient.set(cacheKey, JSON.stringify(match), 60);

      return match;
    } catch (error) {
      logger.error(`Error fetching match details from SportsMonks for ${matchId}:`, error);
      throw new Error('Failed to fetch match details');
    }
  }

  // Get match commentary
  async getCommentary(matchId: string): Promise<any[]> {
    try {
      const cacheKey = `sportsmonks:commentary:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/commentaries/fixtures/${matchId}`, {
        params: {
          include: 'comments',
        },
      });

      const commentary = response.data?.data || [];

      // Cache for 30 seconds
      await redisClient.set(cacheKey, JSON.stringify(commentary), 30);

      return commentary;
    } catch (error) {
      logger.error(`Error fetching commentary from SportsMonks for ${matchId}:`, error);
      throw new Error('Failed to fetch commentary');
    }
  }
}

export const sportsmonksService = new SportsMonksService();

