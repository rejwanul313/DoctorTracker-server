import { model, Schema, type InferSchemaType } from 'mongoose';
import { SPECIALIZATIONS } from '@dt/shared';

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    specialization: { type: String, enum: SPECIALIZATIONS, required: true },
    hospital: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    /** Derived from name/email/phone by the service layer — see utils/search.ts. */
    searchTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true, versionKey: false },
);

// Equality → Sort → Range: filter field first, then createdAt (sort key + "joined" range),
// then _id so the deterministic sort `{ createdAt: -1, _id: -1 }` is fully served by the index.
doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ searchTokens: 1 });
doctorSchema.index({ createdAt: -1, _id: -1 });
doctorSchema.index({ specialization: 1, createdAt: -1, _id: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1, _id: -1 });
doctorSchema.index({ name: 1 });

export type DoctorDoc = InferSchemaType<typeof doctorSchema>;
export const Doctor = model('Doctor', doctorSchema);

/** Public projection: never leak internal fields. */
export const DOCTOR_PUBLIC = '-searchTokens';
