import mongoose, { Document, Schema } from 'mongoose';

export interface INewsAuthor extends Document {
  name: string;
  bio?: string;
  avatar?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsAuthorSchema = new Schema<INewsAuthor>({
  name: { type: String, required: true, trim: true, maxlength: 120, index: true },
  bio: { type: String, trim: true, maxlength: 800 },
  avatar: { type: String, trim: true },
  twitter: { type: String, trim: true },
  instagram: { type: String, trim: true },
  linkedin: { type: String, trim: true },
}, {
  timestamps: true,
  collection: 'news_authors'
});

NewsAuthorSchema.index({ name: 1 });

export const NewsAuthor = mongoose.model<INewsAuthor>('NewsAuthor', NewsAuthorSchema);


