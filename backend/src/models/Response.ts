import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { env } from '../config/env';

const responseSchema = new Schema(
  {
    url: { type: String, required: true },
    method: { type: String, required: true, default: 'POST' },
    requestPayload: { type: Schema.Types.Mixed, default: {} },
    status: { type: Number, required: true },
    ok: { type: Boolean, required: true },
    responseTimeMs: { type: Number, required: true, min: 0 },
    responseSizeBytes: { type: Number, required: true, min: 0 },
    responseBody: { type: Schema.Types.Mixed, default: {} },
    headers: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, default: null },
    isAnomaly: { type: Boolean, default: false, index: true },
    zScore: { type: Number, default: null },
    predictedResponseTimeMs: { type: Number, default: null },
    anomalyReason: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

responseSchema.index({ createdAt: -1 });
responseSchema.index({ isAnomaly: 1, createdAt: -1 });

// Retention: auto-evict rows older than `RESPONSE_TTL_DAYS` days.
// Set to 0 to disable (useful for tests and forensic/archival deployments).
if (env.RESPONSE_TTL_DAYS > 0) {
  responseSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: env.RESPONSE_TTL_DAYS * 24 * 60 * 60 },
  );
}

export type ResponseDoc = HydratedDocument<InferSchemaType<typeof responseSchema>>;

export const ResponseModel = model('Response', responseSchema);
