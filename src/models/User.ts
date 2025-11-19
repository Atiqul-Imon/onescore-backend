import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatar?: string;
  role: 'user' | 'admin' | 'moderator';
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  preferences: {
    favoriteTeams: string[];
    favoriteSports: string[];
    notifications: {
      email: boolean;
      push: boolean;
      matchUpdates: boolean;
      contentUpdates: boolean;
    };
  };
  stats: {
    contentSubmitted: number;
    contentApproved: number;
    totalViews: number;
    totalLikes: number;
  };
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAdmin(): boolean;
  isModerator(): boolean;
  updateLastLogin(): Promise<IUser>;
  incrementContentSubmitted(): Promise<IUser>;
  incrementContentApproved(): Promise<IUser>;
  addViews(views: number): Promise<IUser>;
  addLikes(likes: number): Promise<IUser>;
  
  // Virtuals
  approvalRate: number;
  engagementScore: number;
}

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  verificationToken: {
    type: String
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  preferences: {
    favoriteTeams: [{
      type: String,
      trim: true
    }],
    favoriteSports: [{
      type: String,
      enum: ['cricket', 'football'],
      default: []
    }],
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      matchUpdates: {
        type: Boolean,
        default: true
      },
      contentUpdates: {
        type: Boolean,
        default: true
      }
    }
  },
  stats: {
    contentSubmitted: {
      type: Number,
      default: 0,
      min: 0
    },
    contentApproved: {
      type: Number,
      default: 0,
      min: 0
    },
    totalViews: {
      type: Number,
      default: 0,
      min: 0
    },
    totalLikes: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isVerified: 1 });
UserSchema.index({ createdAt: -1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user is admin
UserSchema.methods.isAdmin = function(): boolean {
  return this.role === 'admin';
};

// Method to check if user is moderator
UserSchema.methods.isModerator = function(): boolean {
  return this.role === 'moderator' || this.role === 'admin';
};

// Method to update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Method to increment content stats
UserSchema.methods.incrementContentSubmitted = function() {
  this.stats.contentSubmitted += 1;
  return this.save();
};

UserSchema.methods.incrementContentApproved = function() {
  this.stats.contentApproved += 1;
  return this.save();
};

UserSchema.methods.addViews = function(views: number) {
  this.stats.totalViews += views;
  return this.save();
};

UserSchema.methods.addLikes = function(likes: number) {
  this.stats.totalLikes += likes;
  return this.save();
};

// Virtual for user's approval rate
UserSchema.virtual('approvalRate').get(function() {
  if (this.stats.contentSubmitted === 0) return 0;
  return (this.stats.contentApproved / this.stats.contentSubmitted) * 100;
});

// Virtual for user's engagement score
UserSchema.virtual('engagementScore').get(function() {
  return this.stats.totalViews + (this.stats.totalLikes * 2);
});

// Static method to find by email
UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to get top contributors
UserSchema.statics.getTopContributors = function(limit = 10) {
  return this.find({ role: 'user' })
    .sort({ 'stats.contentApproved': -1, 'stats.totalViews': -1 })
    .limit(limit)
    .select('name email avatar stats');
};

export const User = mongoose.model<IUser>('User', UserSchema);
