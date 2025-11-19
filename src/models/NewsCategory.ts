import mongoose, { Document, Schema } from 'mongoose';

export interface INewsCategory extends Document {
  name: string;
  slug: string;
  description?: string;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

const NewsCategorySchema = new Schema<INewsCategory>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, trim: true, unique: true, index: true },
  description: { type: String, trim: true, maxlength: 300 },
  order: { type: Number, default: 0, min: 0 },
}, {
  timestamps: true,
  collection: 'news_categories'
});

NewsCategorySchema.index({ order: 1 });

export const NewsCategory = mongoose.model<INewsCategory>('NewsCategory', NewsCategorySchema);


