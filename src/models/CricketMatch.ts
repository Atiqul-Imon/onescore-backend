import mongoose, { Document, Schema } from 'mongoose';

export interface ICricketMatch extends Document {
  matchId: string;
  series: string;
  teams: {
    home: {
      id: string;
      name: string;
      flag: string;
      shortName: string;
    };
    away: {
      id: string;
      name: string;
      flag: string;
      shortName: string;
    };
  };
  venue: {
    name: string;
    city: string;
    country: string;
    capacity?: number;
  };
  status: 'live' | 'completed' | 'upcoming' | 'cancelled';
  format: 'test' | 'odi' | 't20i' | 't20' | 'first-class' | 'list-a';
  startTime: Date;
  endTime?: Date;
  currentScore?: {
    home: {
      runs: number;
      wickets: number;
      overs: number;
      balls: number;
    };
    away: {
      runs: number;
      wickets: number;
      overs: number;
      balls: number;
    };
  };
  liveData?: {
    currentOver: number;
    currentBatsman: string;
    currentBowler: string;
    lastBall: string;
    requiredRunRate?: number;
    currentRunRate?: number;
  };
  innings?: Array<{
    number: number;
    team: string;
    runs: number;
    wickets: number;
    overs: number;
    balls: number;
    runRate: number;
  }>;
  players?: Array<{
    id: string;
    name: string;
    team: string;
    role: 'batsman' | 'bowler' | 'all-rounder' | 'wicket-keeper';
    runs?: number;
    balls?: number;
    wickets?: number;
    overs?: number;
    economy?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const CricketMatchSchema = new Schema<ICricketMatch>({
  matchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  series: {
    type: String,
    required: true,
    index: true
  },
  teams: {
    home: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      flag: { type: String, required: true },
      shortName: { type: String, required: true }
    },
    away: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      flag: { type: String, required: true },
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
    enum: ['live', 'completed', 'upcoming', 'cancelled'],
    required: true,
    index: true
  },
  format: {
    type: String,
    enum: ['test', 'odi', 't20i', 't20', 'first-class', 'list-a'],
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
  currentScore: {
    home: {
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 }
    },
    away: {
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      overs: { type: Number, default: 0 },
      balls: { type: Number, default: 0 }
    }
  },
  liveData: {
    currentOver: { type: Number },
    currentBatsman: { type: String },
    currentBowler: { type: String },
    lastBall: { type: String },
    requiredRunRate: { type: Number },
    currentRunRate: { type: Number }
  },
  innings: [{
    number: { type: Number, required: true },
    team: { type: String, required: true },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    runRate: { type: Number, default: 0 }
  }],
  players: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    team: { type: String, required: true },
    role: {
      type: String,
      enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'],
      required: true
    },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    economy: { type: Number, default: 0 }
  }]
}, {
  timestamps: true,
  collection: 'cricket_matches'
});

// Indexes for better performance
CricketMatchSchema.index({ startTime: 1, status: 1 });
CricketMatchSchema.index({ 'teams.home.id': 1, 'teams.away.id': 1 });
CricketMatchSchema.index({ series: 1, format: 1 });
CricketMatchSchema.index({ status: 1, startTime: 1 });

// Virtual for match duration
CricketMatchSchema.virtual('duration').get(function() {
  if (this.endTime && this.startTime) {
    return this.endTime.getTime() - this.startTime.getTime();
  }
  return null;
});

// Method to check if match is live
CricketMatchSchema.methods.isLive = function() {
  return this.status === 'live';
};

// Method to get current run rate
CricketMatchSchema.methods.getCurrentRunRate = function() {
  if (this.currentScore && this.currentScore.home.overs > 0) {
    return this.currentScore.home.runs / this.currentScore.home.overs;
  }
  return 0;
};

export const CricketMatch = mongoose.model<ICricketMatch>('CricketMatch', CricketMatchSchema);
