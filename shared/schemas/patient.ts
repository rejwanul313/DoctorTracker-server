import { z } from 'zod';
import { CONDITIONS, GENDERS, UNASSIGNED } from '../enums';
import { email, isoDate, objectId, paginationQuery, personName, phone, searchTerm } from './common';

const patientBase = z.object({
  name: personName('Name'),
  email: email.optional().or(z.literal('').transform(() => undefined)),
  phone,
  age: z
    .number({ error: 'Enter an age.' })
    .int('Age must be a whole number.')
    .min(0, 'Age must be 0 or more.')
    .max(120, 'Age must be 120 or less.'),
  gender: z.enum(GENDERS, { error: 'Choose a gender.' }),
  condition: z.enum(CONDITIONS, { error: 'Choose a condition.' }),
  doctor: objectId.nullable(),
  admittedAt: isoDate,
  notes: z.string().trim().max(1000).optional(),
});

export const patientCreateSchema = patientBase.extend({
  doctor: objectId.nullable().default(null),
});
export type PatientCreateInput = z.input<typeof patientCreateSchema>;
export type PatientCreateData = z.output<typeof patientCreateSchema>;

/** Same fields when adding a patient from a doctor's page — the doctor comes from the URL. */
export const doctorPatientCreateSchema = patientBase.omit({ doctor: true });
export type DoctorPatientCreateInput = z.input<typeof doctorPatientCreateSchema>;

/** PATCH: built from the base (no defaults), so omitted fields stay untouched. */
export const patientUpdateSchema = patientBase
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update.');
export type PatientUpdateInput = z.input<typeof patientUpdateSchema>;
export type PatientUpdateData = z.output<typeof patientUpdateSchema>;
export type DoctorPatientCreateData = z.output<typeof doctorPatientCreateSchema>;

export const PATIENT_SORTS = ['newest', 'oldest', 'name', '-name'] as const;

export const patientListQuerySchema = z.object({
  ...paginationQuery,
  search: searchTerm,
  condition: z.enum(CONDITIONS).optional(),
  doctor: z.union([objectId, z.literal(UNASSIGNED)]).optional(),
  gender: z.enum(GENDERS).optional(),
  admittedFrom: isoDate.optional(),
  admittedTo: isoDate.optional(),
  sort: z.enum(PATIENT_SORTS).default('newest'),
});
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;

export const doctorPatientsQuerySchema = z.object({
  ...paginationQuery,
  limit: paginationQuery.limit.default(5),
  search: searchTerm,
  condition: z.enum(CONDITIONS).optional(),
});
export type DoctorPatientsQuery = z.infer<typeof doctorPatientsQuerySchema>;
