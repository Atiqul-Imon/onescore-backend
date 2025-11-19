import mongoose, { Document, Schema } from 'mongoose';

export interface IThread extends Document {
  title: string;
  content: string;
  author: mongoose.Types.ObjectId;
  category: 'cricket' | 'football' | 'general' | 'news' | 'discussion';
  tags: string[];
  flair?: string;
  isLocked: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  upvotes: number;
  downvotes: number;
  score: number; // calculated field: upvotes - downvotes
  views: number;
  comments: mongoose.Types.ObjectId[];
  commentCount: number;
  lastActivity: Date;
  editedAt?: Date;
  editedBy?: mongoose.Types.ObjectId;
  editReason?: string;
  media?: {
    type: 'image' | 'video' | 'link';
    url: string;
    thumbnail?: string;
    title?: string;
    description?: string;
  };
  poll?: {
    question: string;
    options: Array<{
      text: string;
      votes: number;
    }>;
    expiresAt: Date;
    allowMultiple: boolean;
    totalVotes: number;
  };
  awards: Array<{
    type: string;
    count: number;
    givenBy: mongoose.Types.ObjectId;
    givenAt: Date;
  }>;
  reports: Array<{
    reportedBy: mongoose.Types.ObjectId;
    reason: string;
    reportedAt: Date;
    status: 'pending' | 'resolved' | 'dismissed';
  }>;
  moderators: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40000
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['cricket', 'football', 'general', 'news', 'discussion'],
    required: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  }],
  flair: {
    type: String,
    trim: true,
    maxlength: 100
  },
  isLocked: {
    type: Boolean,
    default: false,
    index: true
  },
  isPinned: {
    type: Boolean,
    default: false,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  upvotes: {
    type: Number,
    default: 0,
    min: 0
  },
  downvotes: {
    type: Number,
    default: 0,
    min: 0
  },
  score: {
    type: Number,
    default: 0,
    index: true
  },
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  commentCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  editedAt: {
    type: Date
  },
  editedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  editReason: {
    type: String,
    trim: true,
    maxlength: 200
  },
  media: {
    type: {
      type: String,
      enum: ['image', 'video', 'link']
    },
    url: {
      type: String,
      trim: true
    },
    thumbnail: {
      type: String,
      trim: true
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  poll: {
    question: {
      type: String,
      trim: true,
      maxlength: 300
    },
    options: [{
      text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
      },
      votes: {
        type: Number,
        default: 0,
        min: 0
      }
    }],
    expiresAt: {
      type: Date
    },
    allowMultiple: {
      type: Boolean,
      default: false
    },
    totalVotes: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  awards: [{
    type: {
      type: String,
      required: true,
      trim: true
    },
    count: {
      type: Number,
      required: true,
      min: 1
    },
    givenBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    givenAt: {
      type: Date,
      default: Date.now
    }
  }],
  reports: [{
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      enum: ['spam', 'harassment', 'hate_speech', 'misinformation', 'violence', 'other']
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending'
    }
  }],
  moderators: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  collection: 'threads'
});

// Indexes for better performance
ThreadSchema.index({ category: 1, score: -1, createdAt: -1 });
ThreadSchema.index({ author: 1, createdAt: -1 });
ThreadSchema.index({ tags: 1 });
ThreadSchema.index({ isPinned: -1, score: -1, createdAt: -1 });
ThreadSchema.index({ lastActivity: -1 });
ThreadSchema.index({ isDeleted: 1, isLocked: 1 });

// Virtual for score calculation
ThreadSchema.virtual('calculatedScore').get(function() {
  return this.upvotes - this.downvotes;
});

// Pre-save middleware to update score
ThreadSchema.pre('save', function(next) {
  this.score = this.upvotes - this.downvotes;
  next();
});

// Pre-save middleware to update lastActivity
ThreadSchema.pre('save', function(next) {
  if (this.isModified('comments') || this.isModified('upvotes') || this.isModified('downvotes')) {
    this.lastActivity = new Date();
  }
  next();
});

export const Thread = mongoose.model<IThread>('Thread', ThreadSchema);
