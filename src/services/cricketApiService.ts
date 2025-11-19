import axios from 'axios';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';

interface CricketApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

class CricketApiService {
  private config: CricketApiConfig;
  private client: any;

  constructor() {
    this.config = {
      baseUrl: process.env.CRICKET_API_BASE_URL || 'https://cricket-api.com/api',
      apiKey: process.env.CRICKET_API_KEY || '',
      timeout: 10000,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`Cricket API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Cricket API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`Cricket API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Cricket API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Get live cricket matches
  async getLiveMatches(): Promise<any[]> {
    try {
      const cacheKey = 'cricket_api:live_matches';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/matches/live');
      const matches = response.data.data || [];

      // Cache for 30 seconds
      await redisClient.set(cacheKey, JSON.stringify(matches), 30);

      return matches;
    } catch (error) {
      logger.error('Error fetching live cricket matches:', error);
      throw new Error('Failed to fetch live cricket matches');
    }
  }

  // Get upcoming cricket matches
  async getUpcomingMatches(): Promise<any[]> {
    try {
      const cacheKey = 'cricket_api:upcoming_matches';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/matches/upcoming');
      const matches = response.data.data || [];

      // Cache for 5 minutes
      await redisClient.set(cacheKey, JSON.stringify(matches), 300);

      return matches;
    } catch (error) {
      logger.error('Error fetching upcoming cricket matches:', error);
      throw new Error('Failed to fetch upcoming cricket matches');
    }
  }

  // Get completed cricket matches
  async getCompletedMatches(): Promise<any[]> {
    try {
      const cacheKey = 'cricket_api:completed_matches';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/matches/completed');
      const matches = response.data.data || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(matches), 3600);

      return matches;
    } catch (error) {
      logger.error('Error fetching completed cricket matches:', error);
      throw new Error('Failed to fetch completed cricket matches');
    }
  }

  // Get specific match details
  async getMatchDetails(matchId: string): Promise<any> {
    try {
      const cacheKey = `cricket_api:match:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/matches/${matchId}`);
      const match = response.data.data;

      // Cache for 1 minute
      await redisClient.set(cacheKey, JSON.stringify(match), 60);

      return match;
    } catch (error) {
      logger.error(`Error fetching match details for ${matchId}:`, error);
      throw new Error('Failed to fetch match details');
    }
  }

  // Get cricket series
  async getSeries(): Promise<any[]> {
    try {
      const cacheKey = 'cricket_api:series';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/series');
      const series = response.data.data || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(series), 3600);

      return series;
    } catch (error) {
      logger.error('Error fetching cricket series:', error);
      throw new Error('Failed to fetch cricket series');
    }
  }

  // Get cricket teams
  async getTeams(): Promise<any[]> {
    try {
      const cacheKey = 'cricket_api:teams';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/teams');
      const teams = response.data.data || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(teams), 3600);

      return teams;
    } catch (error) {
      logger.error('Error fetching cricket teams:', error);
      throw new Error('Failed to fetch cricket teams');
    }
  }

  // Get cricket players
  async getPlayers(teamId?: string): Promise<any[]> {
    try {
      const cacheKey = `cricket_api:players${teamId ? `:${teamId}` : ''}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const url = teamId ? `/teams/${teamId}/players` : '/players';
      const response = await this.client.get(url);
      const players = response.data.data || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(players), 3600);

      return players;
    } catch (error) {
      logger.error('Error fetching cricket players:', error);
      throw new Error('Failed to fetch cricket players');
    }
  }

  // Get player statistics
  async getPlayerStats(playerId: string): Promise<any> {
    try {
      const cacheKey = `cricket_api:player_stats:${playerId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/players/${playerId}/stats`);
      const stats = response.data.data;

      // Cache for 30 minutes
      await redisClient.set(cacheKey, JSON.stringify(stats), 1800);

      return stats;
    } catch (error) {
      logger.error(`Error fetching player stats for ${playerId}:`, error);
      throw new Error('Failed to fetch player statistics');
    }
  }

  // Get match statistics
  async getMatchStats(matchId: string): Promise<any> {
    try {
      const cacheKey = `cricket_api:match_stats:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/matches/${matchId}/stats`);
      const stats = response.data.data;

      // Cache for 5 minutes
      await redisClient.set(cacheKey, JSON.stringify(stats), 300);

      return stats;
    } catch (error) {
      logger.error(`Error fetching match stats for ${matchId}:`, error);
      throw new Error('Failed to fetch match statistics');
    }
  }

  // Search matches
  async searchMatches(query: string, filters: any = {}): Promise<any[]> {
    try {
      const cacheKey = `cricket_api:search:${JSON.stringify({ query, filters })}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/matches/search', {
        params: { q: query, ...filters }
      });
      const matches = response.data.data || [];

      // Cache for 5 minutes
      await redisClient.set(cacheKey, JSON.stringify(matches), 300);

      return matches;
    } catch (error) {
      logger.error('Error searching cricket matches:', error);
      throw new Error('Failed to search cricket matches');
    }
  }

  // Get live score updates
  async getLiveScore(matchId: string): Promise<any> {
    try {
      const cacheKey = `cricket_api:live_score:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/matches/${matchId}/live`);
      const liveScore = response.data.data;

      // Cache for 10 seconds
      await redisClient.set(cacheKey, JSON.stringify(liveScore), 10);

      return liveScore;
    } catch (error) {
      logger.error(`Error fetching live score for ${matchId}:`, error);
      throw new Error('Failed to fetch live score');
    }
  }

  // Get ball-by-ball commentary
  async getCommentary(matchId: string): Promise<any[]> {
    try {
      const cacheKey = `cricket_api:commentary:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/matches/${matchId}/commentary`);
      const commentary = response.data.data || [];

      // Cache for 30 seconds
      await redisClient.set(cacheKey, JSON.stringify(commentary), 30);

      return commentary;
    } catch (error) {
      logger.error(`Error fetching commentary for ${matchId}:`, error);
      throw new Error('Failed to fetch commentary');
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('Cricket API health check failed:', error);
      return false;
    }
  }
}

export const cricketApiService = new CricketApiService();
