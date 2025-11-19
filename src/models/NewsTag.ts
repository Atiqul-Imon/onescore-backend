import mongoose, { Document, Schema } from 'mongoose';

export interface INewsTag extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsTagSchema = new Schema<INewsTag>({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  slug: { type: String, required: true, trim: true, unique: true, index: true },
}, {
  timestamps: true,
  collection: 'news_tags'
});

NewsTagSchema.index({ name: 1 });

export const NewsTag = mongoose.model<INewsTag>('NewsTag', NewsTagSchema);


