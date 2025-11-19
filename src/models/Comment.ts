import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  content: string;
  author: mongoose.Types.ObjectId;
  thread?: mongoose.Types.ObjectId;
  article?: mongoose.Types.ObjectId;
  parentComment?: mongoose.Types.ObjectId;
  replies: mongoose.Types.ObjectId[];
  upvotes: number;
  downvotes: number;
  score: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  editedAt?: Date;
  editedBy?: mongoose.Types.ObjectId;
  editReason?: string;
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
  depth: number; // For nested comments
  path: string; // For efficient querying of nested comments
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  thread: {
    type: Schema.Types.ObjectId,
    ref: 'Thread',
    index: true
  },
  article: {
    type: Schema.Types.ObjectId,
    ref: 'NewsArticle',
    index: true
  },
  parentComment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    index: true
  },
  replies: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }],
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
  depth: {
    type: Number,
    default: 0,
    max: 10, // Limit nesting depth
    index: true
  },
  path: {
    type: String,
    index: true
  }
}, {
  timestamps: true,
  collection: 'comments'
});

// Validation: either thread or article must be present
CommentSchema.pre('validate', function(next) {
  if (!this.thread && !this.article) {
    return next(new Error('Either thread or article must be specified'));
  }
  next();
});

// Indexes for better performance
CommentSchema.index({ thread: 1, score: -1, createdAt: -1 });
CommentSchema.index({ article: 1, score: -1, createdAt: -1 });
CommentSchema.index({ author: 1, createdAt: -1 });
CommentSchema.index({ parentComment: 1, createdAt: 1 });
CommentSchema.index({ path: 1 });
CommentSchema.index({ isDeleted: 1 });

// Virtual for score calculation
CommentSchema.virtual('calculatedScore').get(function() {
  return this.upvotes - this.downvotes;
});

// Pre-save middleware to update score
CommentSchema.pre('save', function(next) {
  this.score = this.upvotes - this.downvotes;
  next();
});

// Pre-save middleware to set path for nested comments
CommentSchema.pre('save', function(next) {
  if (this.parentComment) {
    // Get parent comment to build path
    Comment.findById(this.parentComment).then((parent: any) => {
      if (parent) {
        this.path = parent.path ? `${parent.path}.${this._id}` : this._id.toString();
        this.depth = parent.depth + 1;
      } else {
        this.path = this._id.toString();
        this.depth = 0;
      }
      next();
    }).catch(next);
  } else {
    this.path = this._id.toString();
    this.depth = 0;
    next();
  }
});

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
