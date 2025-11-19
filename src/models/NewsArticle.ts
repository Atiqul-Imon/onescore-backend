import mongoose, { Document, Schema } from 'mongoose';

export type ArticleType = 'breaking' | 'match_report' | 'analysis' | 'feature' | 'interview' | 'opinion';

export interface INewsSEO {
  title?: string;
  description?: string;
  ogImage?: string;
  twitterImage?: string;
}

export interface INewsArticle extends Document {
  title: string;
  slug: string;
  summary?: string;
  body: string;
  type: ArticleType;
  category: string; // e.g., cricket, football, general
  tags: string[];
  heroImage?: string;
  gallery: string[];
  author: mongoose.Types.ObjectId;
  entityRefs?: {
    teamIds?: mongoose.Types.ObjectId[];
    playerIds?: mongoose.Types.ObjectId[];
    matchIds?: mongoose.Types.ObjectId[];
    seriesIds?: mongoose.Types.ObjectId[];
  };
  seo?: INewsSEO;
  state: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';
  scheduledAt?: Date | null;
  publishedAt?: Date | null;
  canonicalUrl?: string;
  viewCount: number;
  likes: number;
  dislikes: number;
  readingTimeMinutes: number;
  revisionIds: mongoose.Types.ObjectId[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NewsArticleSchema = new Schema<INewsArticle>({
  title: { type: String, required: true, trim: true, maxlength: 200, index: true },
  slug: { type: String, required: true, unique: true, index: true },
  summary: { type: String, trim: true, maxlength: 400 },
  body: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['breaking', 'match_report', 'analysis', 'feature', 'interview', 'opinion'],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['cricket', 'football', 'general'],
    required: true,
    index: true
  },
  tags: [{ type: String, trim: true, lowercase: true, index: true }],
  heroImage: { type: String, trim: true },
  gallery: [{ type: String, trim: true }],
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  entityRefs: {
    teamIds: [{ type: Schema.Types.ObjectId, ref: 'Team', index: true }],
    playerIds: [{ type: Schema.Types.ObjectId, ref: 'Player', index: true }],
    matchIds: [{ type: Schema.Types.ObjectId, ref: 'CricketMatch', index: true }],
    seriesIds: [{ type: Schema.Types.ObjectId, ref: 'Series', index: true }],
  },
  seo: {
    title: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 300 },
    ogImage: { type: String, trim: true },
    twitterImage: { type: String, trim: true },
  },
  state: { 
    type: String, 
    enum: ['draft', 'in_review', 'scheduled', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  scheduledAt: { type: Date, index: true, default: null },
  publishedAt: { type: Date, index: true, default: null },
  canonicalUrl: { type: String, trim: true },
  viewCount: { type: Number, default: 0, min: 0 },
  likes: { type: Number, default: 0, min: 0 },
  dislikes: { type: Number, default: 0, min: 0 },
  readingTimeMinutes: { type: Number, default: 0, min: 0 },
  revisionIds: [{ type: Schema.Types.ObjectId, ref: 'NewsRevision' }],
  isDeleted: { type: Boolean, default: false, index: true },
}, {
  timestamps: true,
  collection: 'news_articles'
});

NewsArticleSchema.index({ state: 1, publishedAt: -1 });
NewsArticleSchema.index({ category: 1, type: 1, state: 1 });
NewsArticleSchema.index({ tags: 1, state: 1 });
NewsArticleSchema.index({ title: 'text', summary: 'text', body: 'text' });

// Calculate reading time before saving
NewsArticleSchema.pre('save', function(next) {
  if (this.isModified('body') || this.isNew) {
    // Average reading speed: 200 words per minute
    const text = this.body.replace(/<[^>]*>/g, ''); // Strip HTML tags
    const wordCount = text.trim().split(/\s+/).length;
    this.readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  }
  next();
});

NewsArticleSchema.methods = {
  async incrementViews(this: INewsArticle) {
    this.viewCount += 1;
    await this.save();
  }
} as any;

export const NewsArticle = mongoose.model<INewsArticle>('NewsArticle', NewsArticleSchema);


