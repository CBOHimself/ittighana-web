import mongoose, { type SchemaDefinition } from 'mongoose';

const { Schema } = mongoose;

/** Common options: timestamps, clean JSON output, and soft delete. */
export function baseSchema<const D extends SchemaDefinition>(definition: D) {
  return new Schema(
    {
      ...definition,
      createdBy: { type: String },
      updatedBy: { type: String },
      deletedAt: { type: Date, default: null, index: true },
    },
    {
      timestamps: true,
      minimize: false,
      toJSON: {
        versionKey: false,
        transform: (_doc, ret: Record<string, unknown>) => {
          ret._id = String(ret._id);
          delete ret.deletedAt;
          return ret;
        },
      },
    },
  );
}

/** Shared sub-schema for MediaRef. */
export const mediaRefSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, ref: 'Media' },
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    width: Number,
    height: Number,
    caption: String,
  },
  { _id: false },
);

export const seoSchema = new Schema(
  { title: String, description: String, ogImage: String, noindex: Boolean, canonical: String },
  { _id: false },
);

export const publishStatusDef = {
  type: String,
  enum: ['draft', 'review', 'published', 'archived'],
  default: 'draft',
  index: true,
};

/** Blocks are validated by Zod at the API boundary; stored as flexible sub-documents. */
export const blocksDef = { type: [Schema.Types.Mixed], default: [] };
