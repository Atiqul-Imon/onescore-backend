import mongoose, { Document, Schema } from 'mongoose';

export interface ICricketTeamHighlight {
  name: string;
  runs?: number;
  innings?: number;
  average?: number;
  strikeRate?: number;
  wickets?: number;
  economy?: number;
  description?: string;
}

export interface ICricketTeamTimeline {
  year: number;
  title: string;
  description?: string;
}

export interface ICricketTeamRecordLink {
  label: string;
  format?: string;
  url?: string;
}

export interface ICricketTeamKeyPlayer {
  name: string;
  role: string;
  image?: string;
  spotlight?: string;
  stats?: {
    matches?: number;
    runs?: number;
    wickets?: number;
    average?: number;
    strikeRate?: number;
  };
}

export interface ICricketTeam extends Document {
  slug: string;
  name: string;
  shortName: string;
  matchKey: string;
  flag: string;
  crest?: string;
  heroImage?: string;
  summary?: string;
  board?: string;
  coach?: string;
  captains: {
    test?: string;
    odi?: string;
    t20?: string;
  };
  ranking?: {
    test?: number;
    odi?: number;
    t20?: number;
  };
  firstTestYear?: number;
  colors?: {
    primary: string;
    secondary: string;
    accent?: string;
  };
  fanPulse?: {
    rating: number;
    votes: number;
  };
  iccTitles?: Array<{
    name: string;
    year: number;
    result?: string;
  }>;
  keyPlayers?: ICricketTeamKeyPlayer[];
  statLeaders?: {
    batting?: ICricketTeamHighlight[];
    bowling?: ICricketTeamHighlight[];
  };
  recordLinks?: ICricketTeamRecordLink[];
  timeline?: ICricketTeamTimeline[];
  newsTags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CricketTeamSchema = new Schema<ICricketTeam>({
  slug: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  matchKey: { type: String, required: true, unique: true, index: true },
  flag: { type: String, required: true },
  crest: { type: String, trim: true },
  heroImage: { type: String, trim: true },
  summary: { type: String, trim: true, maxlength: 600 },
  board: { type: String, trim: true },
  coach: { type: String, trim: true },
  captains: {
    test: { type: String, trim: true },
    odi: { type: String, trim: true },
    t20: { type: String, trim: true },
  },
  ranking: {
    test: { type: Number, min: 1 },
    odi: { type: Number, min: 1 },
    t20: { type: Number, min: 1 },
  },
  firstTestYear: { type: Number, min: 1800, max: 2100 },
  colors: {
    primary: { type: String, trim: true },
    secondary: { type: String, trim: true },
    accent: { type: String, trim: true },
  },
  fanPulse: {
    rating: { type: Number, min: 0, max: 5 },
    votes: { type: Number, min: 0 },
  },
  iccTitles: [{
    name: { type: String, trim: true },
    year: { type: Number, min: 1800, max: 2100 },
    result: { type: String, trim: true },
  }],
  keyPlayers: [{
    name: { type: String, required: true },
    role: { type: String, required: true },
    image: { type: String, trim: true },
    spotlight: { type: String, trim: true },
    stats: {
      matches: { type: Number, min: 0 },
      runs: { type: Number, min: 0 },
      wickets: { type: Number, min: 0 },
      average: { type: Number, min: 0 },
      strikeRate: { type: Number, min: 0 },
    },
  }],
  statLeaders: {
    batting: [{
      name: { type: String, required: true },
      runs: { type: Number, min: 0 },
      innings: { type: Number, min: 0 },
      average: { type: Number, min: 0 },
      strikeRate: { type: Number, min: 0 },
      description: { type: String, trim: true },
    }],
    bowling: [{
      name: { type: String, required: true },
      wickets: { type: Number, min: 0 },
      innings: { type: Number, min: 0 },
      average: { type: Number, min: 0 },
      economy: { type: Number, min: 0 },
      description: { type: String, trim: true },
    }],
  },
  recordLinks: [{
    label: { type: String, required: true },
    format: { type: String, trim: true },
    url: { type: String, trim: true },
  }],
  timeline: [{
    year: { type: Number, min: 1800, max: 2100 },
    title: { type: String, required: true },
    description: { type: String, trim: true },
  }],
  newsTags: [{ type: String, lowercase: true, trim: true }],
}, {
  timestamps: true,
  collection: 'cricket_teams',
});

CricketTeamSchema.index({ slug: 1 });
CricketTeamSchema.index({ matchKey: 1 });

export const CricketTeam = mongoose.model<ICricketTeam>('CricketTeam', CricketTeamSchema);

