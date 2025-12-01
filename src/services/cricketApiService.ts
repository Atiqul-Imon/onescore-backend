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
      baseUrl: process.env.CRICKET_API_BASE_URL || 'https://api.cricapi.com/v1',
      apiKey: process.env.CRICKET_API_KEY || '',
      timeout: 10000,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        apikey: this.config.apiKey, // Cricket Data API uses query parameter
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

      // Cricket Data API format: /matches?apikey=KEY&status=live
      const response = await this.client.get('/matches', {
        params: { status: 'live' }
      });
      
      // Response format: { status: "success", data: [...], info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
      const matches = response.data.data || [];

      // Cache duration: 30 seconds in development, 15 minutes in production
      const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 30;
      await redisClient.set(cacheKey, JSON.stringify(matches), cacheDuration);

      return matches;
    } catch (error: any) {
      logger.error('Error fetching live cricket matches:', error);
      if (error.response) {
        logger.error('Response status:', error.response.status);
        logger.error('Response data:', error.response.data);
      }
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

      // Cricket Data API: Get all matches and filter for upcoming
      // Note: The API's status=upcoming might not work, so we fetch all and filter
      const response = await this.client.get('/matches', {
        params: {} // Get all matches, we'll filter client-side
      });
      
      // Response format: { status: "success", data: [...], info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
      const allMatches = response.data.data || [];
      
      // Filter for truly upcoming matches:
      // 1. Not started yet (matchStarted: false)
      // 2. Not ended (matchEnded: false)
      // 3. Date is in the future
      const now = new Date();
      const upcomingMatches = allMatches.filter((match: any) => {
        const matchDate = new Date(match.dateTimeGMT || match.date);
        return !match.matchStarted && 
               !match.matchEnded && 
               matchDate > now;
      });

      // Cache duration: 15 minutes in production, 5 minutes in development
      const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 300;
      await redisClient.set(cacheKey, JSON.stringify(upcomingMatches), cacheDuration);

      return upcomingMatches;
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

      // Cricket Data API format: /matches?apikey=KEY&status=completed
      const response = await this.client.get('/matches', {
        params: { status: 'completed' }
      });
      
      // Response format: { status: "success", data: [...], info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: {...}, info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: [...], info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: [...], info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: [...], info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: {...}, info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: {...}, info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: [...], info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: {...}, info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
      
      // Response format: { status: "success", data: [...], info: {...} }
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'API returned non-success status');
      }
      
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
