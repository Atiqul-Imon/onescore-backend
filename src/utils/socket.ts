import { Server as SocketIOServer } from 'socket.io';
import { logger } from './logger';
import { redisClient } from './redis';

// Socket.IO event types
interface ServerToClientEvents {
  liveScoreUpdate: (data: any) => void;
  matchStarted: (data: any) => void;
  matchEnded: (data: any) => void;
  goalScored: (data: any) => void;
  wicketFallen: (data: any) => void;
  newContent: (data: any) => void;
  notification: (data: any) => void;
}

interface ClientToServerEvents {
  joinMatch: (matchId: string) => void;
  leaveMatch: (matchId: string) => void;
  subscribeToTeam: (teamId: string) => void;
  unsubscribeFromTeam: (teamId: string) => void;
}

interface InterServerEvents {
  ping: () => void;
}

export const initializeSocketIO = (io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents>) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      // You can add JWT authentication here
      // const token = socket.handshake.auth.token;
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // socket.userId = decoded.userId;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Handle joining match rooms
    socket.on('joinMatch', async (matchId: string) => {
      try {
        await socket.join(`match:${matchId}`);
        logger.info(`Socket ${socket.id} joined match ${matchId}`);
        
        // Send current match data if available
        const matchData = await redisClient.get(`match:${matchId}`);
        if (matchData) {
          socket.emit('liveScoreUpdate', matchData);
        }
      } catch (error) {
        logger.error(`Error joining match ${matchId}:`, error);
        socket.emit('notification', { type: 'error', message: 'Failed to join match' });
      }
    });

    // Handle leaving match rooms
    socket.on('leaveMatch', (matchId: string) => {
      socket.leave(`match:${matchId}`);
      logger.info(`Socket ${socket.id} left match ${matchId}`);
    });

    // Handle team subscriptions
    socket.on('subscribeToTeam', async (teamId: string) => {
      try {
        await socket.join(`team:${teamId}`);
        logger.info(`Socket ${socket.id} subscribed to team ${teamId}`);
      } catch (error) {
        logger.error(`Error subscribing to team ${teamId}:`, error);
        socket.emit('notification', { type: 'error', message: 'Failed to subscribe to team' });
      }
    });

    // Handle team unsubscriptions
    socket.on('unsubscribeFromTeam', (teamId: string) => {
      socket.leave(`team:${teamId}`);
      logger.info(`Socket ${socket.id} unsubscribed from team ${teamId}`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Set up Redis pub/sub for real-time updates
  setupRedisPubSub(io);

  logger.info('Socket.IO initialized successfully');
};

// Redis pub/sub setup for real-time updates
const setupRedisPubSub = (io: SocketIOServer) => {
  // This would typically be set up with a separate Redis client for pub/sub
  // For now, we'll use a simple polling mechanism
  setInterval(async () => {
    try {
      // Get live matches from Redis
      const liveMatches = await redisClient.keys('live:match:*');
      
      for (const matchKey of liveMatches) {
        const matchData = await redisClient.get(matchKey);
        if (matchData) {
          const matchId = matchKey.replace('live:match:', '');
          
          // Emit to all clients in the match room
          io.to(`match:${matchId}`).emit('liveScoreUpdate', matchData);
          
          // Emit to team subscribers
          const match = JSON.parse(matchData);
          if (match.teams) {
            io.to(`team:${match.teams.home.id}`).emit('liveScoreUpdate', matchData);
            io.to(`team:${match.teams.away.id}`).emit('liveScoreUpdate', matchData);
          }
        }
      }
    } catch (error) {
      logger.error('Error in Redis pub/sub setup:', error);
    }
  }, 5000); // Check every 5 seconds
};

// Utility functions for broadcasting updates
export const broadcastMatchUpdate = (io: SocketIOServer, matchId: string, data: any) => {
  io.to(`match:${matchId}`).emit('liveScoreUpdate', data);
};

export const broadcastTeamUpdate = (io: SocketIOServer, teamId: string, data: any) => {
  io.to(`team:${teamId}`).emit('liveScoreUpdate', data);
};

export const broadcastNotification = (io: SocketIOServer, data: any) => {
  io.emit('notification', data);
};

export const broadcastNewContent = (io: SocketIOServer, content: any) => {
  io.emit('newContent', content);
};

// Match event handlers
export const handleMatchStart = (io: SocketIOServer, matchId: string, matchData: any) => {
  // Store in Redis
  redisClient.set(`live:match:${matchId}`, JSON.stringify(matchData), 3600); // 1 hour TTL
  
  // Broadcast to match room
  broadcastMatchUpdate(io, matchId, matchData);
  
  // Broadcast to team subscribers
  if (matchData.teams) {
    broadcastTeamUpdate(io, matchData.teams.home.id, matchData);
    broadcastTeamUpdate(io, matchData.teams.away.id, matchData);
  }
  
  logger.info(`Match started: ${matchId}`);
};

export const handleMatchEnd = (io: SocketIOServer, matchId: string, finalData: any) => {
  // Remove from Redis
  redisClient.del(`live:match:${matchId}`);
  
  // Broadcast final result
  broadcastMatchUpdate(io, matchId, { ...finalData, status: 'completed' });
  
  logger.info(`Match ended: ${matchId}`);
};

export const handleGoalScored = async (io: SocketIOServer, matchId: string, goalData: any) => {
  // Update match data in Redis
  const currentData = await redisClient.get(`live:match:${matchId}`);
  if (currentData) {
    const matchData = JSON.parse(currentData);
    matchData.events = matchData.events || [];
    matchData.events.push(goalData);
    
    await redisClient.set(`live:match:${matchId}`, JSON.stringify(matchData), 3600);
    
    // Broadcast goal event
    io.to(`match:${matchId}`).emit('goalScored', goalData);
  }
};

export const handleWicketFallen = async (io: SocketIOServer, matchId: string, wicketData: any) => {
  // Update match data in Redis
  const currentData = await redisClient.get(`live:match:${matchId}`);
  if (currentData) {
    const matchData = JSON.parse(currentData);
    matchData.events = matchData.events || [];
    matchData.events.push(wicketData);
    
    redisClient.set(`live:match:${matchId}`, JSON.stringify(matchData), 3600);
    
    // Broadcast wicket event
    io.to(`match:${matchId}`).emit('wicketFallen', wicketData);
  }
};
