import axios from 'axios';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';

interface SportsMonksConfig {
  apiToken: string;
  timeout: number;
}

type Sport = 'cricket' | 'football';

class SportsMonksService {
  private config: SportsMonksConfig;
  private clients: Map<Sport, any>;

  constructor() {
    this.config = {
      apiToken: process.env.SPORTMONKS_API_TOKEN || '',
      timeout: 10000,
    };

    // Create separate clients for each sport
    this.clients = new Map();
    this.clients.set('cricket', this.createClient('cricket'));
    this.clients.set('football', this.createClient('football'));

    if (!this.config.apiToken) {
      logger.warn('SPORTMONKS_API_TOKEN is not configured');
    }
  }

  private createClient(sport: Sport) {
    const baseURL = `https://api.sportmonks.com/v3/${sport}`;
    
    const client = axios.create({
      baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        api_token: this.config.apiToken,
      },
    });

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        logger.info(`SportsMonks ${sport} API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`SportsMonks ${sport} API Request Error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        logger.info(`SportsMonks ${sport} API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          url: error.config?.url,
          method: error.config?.method,
          params: error.config?.params,
          headers: error.config?.headers,
        };
        
        logger.error(`SportsMonks ${sport} API Response Error:`, JSON.stringify(errorDetails, null, 2));
        
        // Log token info (first 10 chars only for security)
        if (error.config?.params?.api_token) {
          const token = error.config.params.api_token;
          logger.error(`Token used: ${token.substring(0, 10)}... (length: ${token.length})`);
        }
        
        return Promise.reject(error);
      }
    );

    return client;
  }

  private getClient(sport: Sport) {
    return this.clients.get(sport);
  }

  // Get live matches for a specific sport
  async getLiveMatches(sport: Sport = 'cricket'): Promise<any[]> {
    try {
      const cacheKey = `sportsmonks:live_matches:${sport}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        logger.info(`Returning cached live ${sport} matches`);
        return JSON.parse(cachedData);
      }

      const client = this.getClient(sport);
      if (!client) {
        throw new Error(`No client configured for ${sport}`);
      }

      if (!this.config.apiToken) {
        throw new Error('SPORTMONKS_API_TOKEN is not configured');
      }

      logger.info(`Fetching live ${sport} matches from SportsMonks...`);
      logger.info(`Using base URL: ${client.defaults.baseURL}`);
      logger.info(`Token configured: ${this.config.apiToken ? 'Yes' : 'No'} (length: ${this.config.apiToken?.length || 0})`);
      
      // Try /livescores/inplay first (requires paid plan)
      try {
        const response = await client.get('/livescores/inplay', {
          params: {
            include: 'scores,participants',
          },
        });

        if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
          const matches = response.data.data;
          logger.info(`Received ${matches.length} live ${sport} matches from /livescores/inplay`);

          // Cache duration: 30 seconds in development, 15 minutes in production
          const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 30;
          await redisClient.set(cacheKey, JSON.stringify(matches), cacheDuration);

          return matches;
        }
      } catch (inplayError: any) {
        // If /livescores/inplay fails (404/403), try /fixtures with state_id filter
        if (inplayError.response?.status === 404 || inplayError.response?.status === 403) {
          logger.info(`/livescores/inplay not available (${inplayError.response?.status}), trying /fixtures with state filter...`);
          
          try {
            const fixturesResponse = await client.get('/fixtures', {
              params: {
                include: 'scores,participants',
                per_page: 50,
              },
            });

            const allFixtures = fixturesResponse.data?.data || [];
            const now = new Date();
            
            // Filter for matches that are currently in progress (state_id 3 = In Progress)
            const liveMatches = allFixtures.filter((match: any) => {
              if (match.state_id === 3) return true; // In Progress
              // Also check if match started but not finished
              if (match.starting_at) {
                const startTime = new Date(match.starting_at);
                const endTime = match.ending_at ? new Date(match.ending_at) : new Date(startTime.getTime() + 3 * 60 * 60 * 1000); // Default 3 hours
                return now >= startTime && now <= endTime && match.state_id !== 5;
              }
              return false;
            });

            if (liveMatches.length > 0) {
              logger.info(`Found ${liveMatches.length} live ${sport} matches from /fixtures`);
              const cacheDuration = process.env.NODE_ENV === 'production' ? 900 : 30;
              await redisClient.set(cacheKey, JSON.stringify(liveMatches), cacheDuration);
              return liveMatches;
            }
          } catch (fixturesError: any) {
            logger.error(`Error fetching fixtures for live matches:`, fixturesError.message);
          }
        }
        throw inplayError; // Re-throw if it's not a 404/403
      }

      return [];
    } catch (error: any) {
      logger.error(`Error fetching live ${sport} matches from SportsMonks:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  }

  // Get all live matches (cricket + football)
  async getAllLiveMatches(): Promise<{ cricket: any[]; football: any[] }> {
    try {
      const [cricketMatches, footballMatches] = await Promise.allSettled([
        this.getLiveMatches('cricket'),
        this.getLiveMatches('football'),
      ]);

      return {
        cricket: cricketMatches.status === 'fulfilled' ? cricketMatches.value : [],
        football: footballMatches.status === 'fulfilled' ? footballMatches.value : [],
      };
    } catch (error: any) {
      logger.error('Error fetching all live matches:', error);
      return { cricket: [], football: [] };
    }
  }

  // Get upcoming matches for a specific sport
  async getUpcomingMatches(sport: Sport = 'cricket'): Promise<any[]> {
    try {
      const cacheKey = `sportsmonks:upcoming_matches:${sport}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const client = this.getClient(sport);
      if (!client) {
        throw new Error(`No client configured for ${sport}`);
      }

      // Get all fixtures and filter for upcoming on client side
      const response = await client.get('/fixtures', {
        params: {
          include: 'participants',
          per_page: 100, // Get more to filter
        },
      });

      const allMatches = response.data?.data || [];
      const now = new Date();

      // Filter for truly upcoming matches
      // State IDs: 1 = Not Started, 2 = Not Started (alternative), 3 = In Progress, 5 = Finished
      const upcomingMatches = allMatches.filter((match: any) => {
        if (!match.starting_at) return false;
        const matchDate = new Date(match.starting_at);
        // Include matches that haven't started yet (state_id 1 or 2) and are in the future
        return matchDate > now && (match.state_id === 1 || match.state_id === 2);
      });

      // Cache duration: 5 minutes in production, 30 seconds in development
      const cacheDuration = process.env.NODE_ENV === 'production' ? 300 : 30;
      await redisClient.set(cacheKey, JSON.stringify(upcomingMatches), cacheDuration);

      return upcomingMatches;
    } catch (error: any) {
      logger.error(`Error fetching upcoming ${sport} matches from SportsMonks:`, error);
      throw error;
    }
  }

  // Get completed matches for a specific sport
  async getCompletedMatches(sport: Sport = 'cricket'): Promise<any[]> {
    try {
      const cacheKey = `sportsmonks:completed_matches:${sport}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const client = this.getClient(sport);
      if (!client) {
        throw new Error(`No client configured for ${sport}`);
      }

      // Get all fixtures and filter for completed on client side
      const response = await client.get('/fixtures', {
        params: {
          include: 'scores,participants',
          per_page: 100, // Get more to filter
        },
      });

      const allMatches = response.data?.data || [];

      // Filter for completed matches (state_id 5 = Finished)
      const completedMatches = allMatches.filter((match: any) => {
        return match.state_id === 5; // 5 = Finished
      });

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(completedMatches), 3600);

      return completedMatches;
    } catch (error: any) {
      logger.error(`Error fetching completed ${sport} matches from SportsMonks:`, error);
      throw error;
    }
  }

  // Get match details by ID
  async getMatchDetails(matchId: string, sport: Sport = 'cricket'): Promise<any> {
    try {
      const cacheKey = `sportsmonks:match:${sport}:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const client = this.getClient(sport);
      if (!client) {
        throw new Error(`No client configured for ${sport}`);
      }

      const response = await client.get(`/fixtures/${matchId}`, {
        params: {
          include: 'scores,participants,lineups,events',
        },
      });

      const match = response.data?.data;

      // Cache for 1 minute
      await redisClient.set(cacheKey, JSON.stringify(match), 60);

      return match;
    } catch (error: any) {
      logger.error(`Error fetching ${sport} match details from SportsMonks for ${matchId}:`, error);
      throw error;
    }
  }

  // Get match commentary
  async getCommentary(matchId: string, sport: Sport = 'cricket'): Promise<any[]> {
    try {
      const cacheKey = `sportsmonks:commentary:${sport}:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const client = this.getClient(sport);
      if (!client) {
        throw new Error(`No client configured for ${sport}`);
      }

      const response = await client.get(`/commentaries/fixtures/${matchId}`, {
        params: {
          include: 'comments',
        },
      });

      const commentary = response.data?.data || [];

      // Cache for 30 seconds
      await redisClient.set(cacheKey, JSON.stringify(commentary), 30);

      return commentary;
    } catch (error: any) {
      logger.error(`Error fetching ${sport} commentary from SportsMonks for ${matchId}:`, error);
      throw error;
    }
  }

  // Health check for a specific sport
  async healthCheck(sport: Sport = 'cricket'): Promise<boolean> {
    try {
      const client = this.getClient(sport);
      if (!client) {
        return false;
      }

      const response = await client.get('/fixtures/upcoming', {
        params: { per_page: 1 },
      });
      return response.status === 200;
    } catch (error: any) {
      logger.error(`SportsMonks ${sport} health check failed:`, error.response?.data || error.message);
      return false;
    }
  }
}

export const sportsmonksService = new SportsMonksService();

