import mongoose, { Document, Schema } from 'mongoose';

export interface IFootballMatch extends Document {
  matchId: string;
  league: string;
  season: string;
  teams: {
    home: {
      id: string;
      name: string;
      logo: string;
      shortName: string;
    };
    away: {
      id: string;
      name: string;
      logo: string;
      shortName: string;
    };
  };
  venue: {
    name: string;
    city: string;
    country: string;
    capacity?: number;
  };
  status: 'live' | 'finished' | 'scheduled' | 'postponed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  score: {
    home: number;
    away: number;
    halftime?: {
      home: number;
      away: number;
    };
    fulltime?: {
      home: number;
      away: number;
    };
    extraTime?: {
      home: number;
      away: number;
    };
    penalties?: {
      home: number;
      away: number;
    };
  };
  events: Array<{
    id: string;
    type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'penalty' | 'own_goal';
    player: string;
    team: string;
    minute: number;
    description: string;
    timestamp: Date;
  }>;
  statistics?: {
    possession: {
      home: number;
      away: number;
    };
    shots: {
      home: number;
      away: number;
    };
    shotsOnTarget: {
      home: number;
      away: number;
    };
    corners: {
      home: number;
      away: number;
    };
    fouls: {
      home: number;
      away: number;
    };
    yellowCards: {
      home: number;
      away: number;
    };
    redCards: {
      home: number;
      away: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const FootballMatchSchema = new Schema<IFootballMatch>({
  matchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  league: {
    type: String,
    required: true,
    index: true
  },
  season: {
    type: String,
    required: true,
    index: true
  },
  teams: {
    home: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      logo: { type: String, required: true },
      shortName: { type: String, required: true }
    },
    away: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      logo: { type: String, required: true },
      shortName: { type: String, required: true }
    }
  },
  venue: {
    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    capacity: { type: Number }
  },
  status: {
    type: String,
    enum: ['live', 'finished', 'scheduled', 'postponed', 'cancelled'],
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  endTime: {
    type: Date
  },
  score: {
    home: { type: Number, default: 0 },
    away: { type: Number, default: 0 },
    halftime: {
      home: { type: Number },
      away: { type: Number }
    },
    fulltime: {
      home: { type: Number },
      away: { type: Number }
    },
    extraTime: {
      home: { type: Number },
      away: { type: Number }
    },
    penalties: {
      home: { type: Number },
      away: { type: Number }
    }
  },
  events: [{
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['goal', 'yellow_card', 'red_card', 'substitution', 'penalty', 'own_goal'],
      required: true
    },
    player: { type: String, required: true },
    team: { type: String, required: true },
    minute: { type: Number, required: true },
    description: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  statistics: {
    possession: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 }
    },
    shots: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 }
    },
    shotsOnTarget: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 }
    },
    corners: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 }
    },
    fouls: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 }
    },
    yellowCards: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 }
    },
    redCards: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 }
    }
  }
}, {
  timestamps: true,
  collection: 'football_matches'
});

// Indexes for better performance
FootballMatchSchema.index({ startTime: 1, status: 1 });
FootballMatchSchema.index({ 'teams.home.id': 1, 'teams.away.id': 1 });
FootballMatchSchema.index({ league: 1, season: 1 });
FootballMatchSchema.index({ status: 1, startTime: 1 });

// Virtual for match duration
FootballMatchSchema.virtual('duration').get(function() {
  if (this.endTime && this.startTime) {
    return this.endTime.getTime() - this.startTime.getTime();
  }
  return null;
});

// Method to check if match is live
FootballMatchSchema.methods.isLive = function() {
  return this.status === 'live';
};

// Method to get total goals
FootballMatchSchema.methods.getTotalGoals = function() {
  return this.score.home + this.score.away;
};

// Method to get goal difference
FootballMatchSchema.methods.getGoalDifference = function() {
  return this.score.home - this.score.away;
};

export const FootballMatch = mongoose.model<IFootballMatch>('FootballMatch', FootballMatchSchema);
