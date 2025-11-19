import mongoose, { Document, Schema } from 'mongoose';

export interface IVote extends Document {
  user: mongoose.Types.ObjectId;
  targetType: 'thread' | 'comment';
  targetId: mongoose.Types.ObjectId;
  voteType: 'upvote' | 'downvote';
  createdAt: Date;
}

const VoteSchema = new Schema<IVote>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: ['thread', 'comment'],
    required: true,
    index: true
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  voteType: {
    type: String,
    enum: ['upvote', 'downvote'],
    required: true
  }
}, {
  timestamps: true,
  collection: 'votes'
});

// Compound index to ensure one vote per user per target
VoteSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });

// Index for efficient querying
VoteSchema.index({ targetType: 1, targetId: 1, voteType: 1 });

export const Vote = mongoose.model<IVote>('Vote', VoteSchema);
