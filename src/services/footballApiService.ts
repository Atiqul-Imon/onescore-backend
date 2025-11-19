import axios from 'axios';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';

interface FootballApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

class FootballApiService {
  private config: FootballApiConfig;
  private client: any;

  constructor() {
    this.config = {
      baseUrl: process.env.FOOTBALL_API_BASE_URL || 'https://api.football-data.org/v4',
      apiKey: process.env.FOOTBALL_API_KEY || '',
      timeout: 10000,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'X-Auth-Token': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`Football API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Football API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`Football API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Football API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Get live football matches
  async getLiveMatches(): Promise<any[]> {
    try {
      const cacheKey = 'football_api:live_matches';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/matches', {
        params: { status: 'LIVE' }
      });
      const matches = response.data.matches || [];

      // Cache for 30 seconds
      await redisClient.set(cacheKey, JSON.stringify(matches), 30);

      return matches;
    } catch (error) {
      logger.error('Error fetching live football matches:', error);
      throw new Error('Failed to fetch live football matches');
    }
  }

  // Get upcoming football matches
  async getUpcomingMatches(): Promise<any[]> {
    try {
      const cacheKey = 'football_api:upcoming_matches';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/matches', {
        params: { status: 'SCHEDULED' }
      });
      const matches = response.data.matches || [];

      // Cache for 5 minutes
      await redisClient.set(cacheKey, JSON.stringify(matches), 300);

      return matches;
    } catch (error) {
      logger.error('Error fetching upcoming football matches:', error);
      throw new Error('Failed to fetch upcoming football matches');
    }
  }

  // Get completed football matches
  async getCompletedMatches(): Promise<any[]> {
    try {
      const cacheKey = 'football_api:completed_matches';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/matches', {
        params: { status: 'FINISHED' }
      });
      const matches = response.data.matches || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(matches), 3600);

      return matches;
    } catch (error) {
      logger.error('Error fetching completed football matches:', error);
      throw new Error('Failed to fetch completed football matches');
    }
  }

  // Get specific match details
  async getMatchDetails(matchId: string): Promise<any> {
    try {
      const cacheKey = `football_api:match:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/matches/${matchId}`);
      const match = response.data;

      // Cache for 1 minute
      await redisClient.set(cacheKey, JSON.stringify(match), 60);

      return match;
    } catch (error) {
      logger.error(`Error fetching match details for ${matchId}:`, error);
      throw new Error('Failed to fetch match details');
    }
  }

  // Get football competitions (leagues)
  async getCompetitions(): Promise<any[]> {
    try {
      const cacheKey = 'football_api:competitions';
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/competitions');
      const competitions = response.data.competitions || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(competitions), 3600);

      return competitions;
    } catch (error) {
      logger.error('Error fetching football competitions:', error);
      throw new Error('Failed to fetch football competitions');
    }
  }

  // Get football teams
  async getTeams(competitionId?: string): Promise<any[]> {
    try {
      const cacheKey = `football_api:teams${competitionId ? `:${competitionId}` : ''}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const url = competitionId ? `/competitions/${competitionId}/teams` : '/teams';
      const response = await this.client.get(url);
      const teams = response.data.teams || response.data || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(teams), 3600);

      return teams;
    } catch (error) {
      logger.error('Error fetching football teams:', error);
      throw new Error('Failed to fetch football teams');
    }
  }

  // Get team details
  async getTeamDetails(teamId: string): Promise<any> {
    try {
      const cacheKey = `football_api:team:${teamId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/teams/${teamId}`);
      const team = response.data;

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(team), 3600);

      return team;
    } catch (error) {
      logger.error(`Error fetching team details for ${teamId}:`, error);
      throw new Error('Failed to fetch team details');
    }
  }

  // Get team matches
  async getTeamMatches(teamId: string, status?: string): Promise<any[]> {
    try {
      const cacheKey = `football_api:team_matches:${teamId}:${status || 'all'}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const params = status ? { status } : {};
      const response = await this.client.get(`/teams/${teamId}/matches`, { params });
      const matches = response.data.matches || [];

      // Cache for 5 minutes
      await redisClient.set(cacheKey, JSON.stringify(matches), 300);

      return matches;
    } catch (error) {
      logger.error(`Error fetching team matches for ${teamId}:`, error);
      throw new Error('Failed to fetch team matches');
    }
  }

  // Get football players
  async getPlayers(teamId: string): Promise<any[]> {
    try {
      const cacheKey = `football_api:players:${teamId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/teams/${teamId}`);
      const players = response.data.squad || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(players), 3600);

      return players;
    } catch (error) {
      logger.error(`Error fetching players for team ${teamId}:`, error);
      throw new Error('Failed to fetch team players');
    }
  }

  // Get player details
  async getPlayerDetails(playerId: string): Promise<any> {
    try {
      const cacheKey = `football_api:player:${playerId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/persons/${playerId}`);
      const player = response.data;

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(player), 3600);

      return player;
    } catch (error) {
      logger.error(`Error fetching player details for ${playerId}:`, error);
      throw new Error('Failed to fetch player details');
    }
  }

  // Get match statistics
  async getMatchStats(matchId: string): Promise<any> {
    try {
      const cacheKey = `football_api:match_stats:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/matches/${matchId}`);
      const stats = response.data;

      // Cache for 5 minutes
      await redisClient.set(cacheKey, JSON.stringify(stats), 300);

      return stats;
    } catch (error) {
      logger.error(`Error fetching match stats for ${matchId}:`, error);
      throw new Error('Failed to fetch match statistics');
    }
  }

  // Get standings
  async getStandings(competitionId: string): Promise<any[]> {
    try {
      const cacheKey = `football_api:standings:${competitionId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/competitions/${competitionId}/standings`);
      const standings = response.data.standings || [];

      // Cache for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(standings), 3600);

      return standings;
    } catch (error) {
      logger.error(`Error fetching standings for ${competitionId}:`, error);
      throw new Error('Failed to fetch standings');
    }
  }

  // Search matches
  async searchMatches(query: string, filters: any = {}): Promise<any[]> {
    try {
      const cacheKey = `football_api:search:${JSON.stringify({ query, filters })}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get('/matches', {
        params: { ...filters }
      });
      const matches = response.data.matches || [];

      // Filter by query if provided
      const filteredMatches = query 
        ? matches.filter((match: any) => 
            match.homeTeam.name.toLowerCase().includes(query.toLowerCase()) ||
            match.awayTeam.name.toLowerCase().includes(query.toLowerCase())
          )
        : matches;

      // Cache for 5 minutes
      await redisClient.set(cacheKey, JSON.stringify(filteredMatches), 300);

      return filteredMatches;
    } catch (error) {
      logger.error('Error searching football matches:', error);
      throw new Error('Failed to search football matches');
    }
  }

  // Get live score updates
  async getLiveScore(matchId: string): Promise<any> {
    try {
      const cacheKey = `football_api:live_score:${matchId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const response = await this.client.get(`/matches/${matchId}`);
      const liveScore = response.data;

      // Cache for 10 seconds
      await redisClient.set(cacheKey, JSON.stringify(liveScore), 10);

      return liveScore;
    } catch (error) {
      logger.error(`Error fetching live score for ${matchId}:`, error);
      throw new Error('Failed to fetch live score');
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/competitions');
      return response.status === 200;
    } catch (error) {
      logger.error('Football API health check failed:', error);
      return false;
    }
  }
}

export const footballApiService = new FootballApiService();
