import mongoose, { Document, Schema } from 'mongoose';

export interface IContent extends Document {
  title: string;
  content: string;
  type: 'video' | 'audio' | 'article';
  contributor: mongoose.Types.ObjectId;
  category: 'cricket' | 'football' | 'general';
  tags: string[];
  mediaUrl?: string;
  thumbnailUrl?: string;
  duration?: number; // in seconds for video/audio
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  featured: boolean;
  views: number;
  likes: number;
  dislikes: number;
  comments: Array<{
    user: mongoose.Types.ObjectId;
    content: string;
    createdAt: Date;
    likes: number;
  }>;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ContentSchema = new Schema<IContent>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['video', 'audio', 'article'],
    required: true,
    index: true
  },
  contributor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['cricket', 'football', 'general'],
    required: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  mediaUrl: {
    type: String,
    trim: true
  },
  thumbnailUrl: {
    type: String,
    trim: true
  },
  duration: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'draft'],
    default: 'pending',
    index: true
  },
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  likes: {
    type: Number,
    default: 0,
    min: 0
  },
  dislikes: {
    type: Number,
    default: 0,
    min: 0
  },
  comments: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    likes: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  publishedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'content'
});

// Indexes for better performance
ContentSchema.index({ status: 1, publishedAt: -1 });
ContentSchema.index({ category: 1, type: 1, status: 1 });
ContentSchema.index({ contributor: 1, status: 1 });
ContentSchema.index({ tags: 1 });
ContentSchema.index({ featured: 1, status: 1, publishedAt: -1 });
ContentSchema.index({ title: 'text', content: 'text' }); // Text search index

// Virtual for engagement score
ContentSchema.virtual('engagementScore').get(function() {
  return this.likes + (this.views * 0.1) + (this.comments.length * 2);
});

// Virtual for approval status
ContentSchema.virtual('isApproved').get(function() {
  return this.status === 'approved';
});

// Virtual for published status
ContentSchema.virtual('isPublished').get(function() {
  return this.status === 'approved' && this.publishedAt;
});

// Method to increment views
ContentSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to like content
ContentSchema.methods.like = function() {
  this.likes += 1;
  return this.save();
};

// Method to dislike content
ContentSchema.methods.dislike = function() {
  this.dislikes += 1;
  return this.save();
};

// Method to add comment
ContentSchema.methods.addComment = function(userId: string, content: string) {
  this.comments.push({
    user: userId,
    content: content,
    createdAt: new Date(),
    likes: 0
  });
  return this.save();
};

// Static method to get featured content
ContentSchema.statics.getFeatured = function(limit = 10) {
  return this.find({ featured: true, status: 'approved' })
    .populate('contributor', 'name email')
    .sort({ publishedAt: -1 })
    .limit(limit);
};

// Static method to get content by category
ContentSchema.statics.getByCategory = function(category: string, limit = 20) {
  return this.find({ category, status: 'approved' })
    .populate('contributor', 'name email')
    .sort({ publishedAt: -1 })
    .limit(limit);
};

// Static method to search content
ContentSchema.statics.search = function(query: string, limit = 20) {
  return this.find(
    { 
      $text: { $search: query },
      status: 'approved'
    },
    { score: { $meta: 'textScore' } }
  )
    .populate('contributor', 'name email')
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

export const Content = mongoose.model<IContent>('Content', ContentSchema);
