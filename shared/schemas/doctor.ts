import { z } from 'zod';
import { SPECIALIZATIONS } from '../enums';
import { email, isoDate, objectId, paginationQuery, personName, phone, searchTerm } from './common';

export const doctorCreateSchema = z.object({
  name: personName('Name'),
  specialization: z.enum(SPECIALIZATIONS, { error: 'Choose a specialization.' }),
  hospital: z.string({ error: 'Enter a hospital.' }).trim().min(2, 'Enter a hospital.').max(120),
  phone,
  email,
});
export type DoctorCreateInput = z.infer<typeof doctorCreateSchema>;

export const doctorUpdateSchema = doctorCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update.');
export type DoctorUpdateInput = z.infer<typeof doctorUpdateSchema>;

export const DOCTOR_SORTS = ['newest', 'oldest', 'name', '-name'] as const;

export const doctorListQuerySchema = z.object({
  ...paginationQuery,
  search: searchTerm,
  specialization: z.enum(SPECIALIZATIONS).optional(),
  hospital: z.string().trim().max(120).optional(),
  joinedFrom: isoDate.optional(),
  joinedTo: isoDate.optional(),
  sort: z.enum(DOCTOR_SORTS).default('newest'),
});
export type DoctorListQuery = z.infer<typeof doctorListQuerySchema>;

export const doctorPatientParams = z.object({ id: objectId, patientId: objectId });
