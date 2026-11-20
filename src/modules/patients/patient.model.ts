import { model, Schema, type InferSchemaType } from 'mongoose';
import { CONDITIONS, GENDERS } from '@dt/shared';

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, enum: GENDERS, required: true },
    condition: { type: String, enum: CONDITIONS, required: true },
    /** null = unassigned. Removing a patient from a doctor's list sets this to null. */
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
    admittedAt: { type: Date, required: true },
    dischargedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 1000 },
    searchTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true, versionKey: false },
);

patientSchema.index({ searchTokens: 1 });
patientSchema.index({ admittedAt: -1, _id: -1 });
patientSchema.index({ doctor: 1, admittedAt: -1, _id: -1 });
patientSchema.index({ condition: 1, admittedAt: -1, _id: -1 });
patientSchema.index({ dischargedAt: 1 });
patientSchema.index({ name: 1 });

export type PatientDoc = InferSchemaType<typeof patientSchema>;
export const Patient = model('Patient', patientSchema);

export const PATIENT_PUBLIC = '-searchTokens';
