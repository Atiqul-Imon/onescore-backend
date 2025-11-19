import mongoose, { Document, Schema } from 'mongoose';

export interface INewsRevision extends Document {
  articleId: mongoose.Types.ObjectId;
  snapshot: any; // full snapshot JSON of article fields
  editorId: mongoose.Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsRevisionSchema = new Schema<INewsRevision>({
  articleId: { type: Schema.Types.ObjectId, ref: 'NewsArticle', required: true, index: true },
  snapshot: { type: Schema.Types.Mixed, required: true },
  editorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  note: { type: String, trim: true, maxlength: 200 },
}, {
  timestamps: true,
  collection: 'news_revisions'
});

export const NewsRevision = mongoose.model<INewsRevision>('NewsRevision', NewsRevisionSchema);


