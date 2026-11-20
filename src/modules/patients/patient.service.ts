import { Types } from 'mongoose';
import {
  UNASSIGNED,
  type Condition,
  type DoctorPatientsQuery,
  type PatientCreateData,
  type PatientFacets,
  type PatientListQuery,
  type PatientUpdateData,
} from '@dt/shared';
import { ApiError } from '../../utils/ApiError';
import { dateRange, parseIsoDate } from '../../utils/dates';
import { facetCounts, pageMeta, skipFor } from '../../utils/pagination';
import { buildSearchTokens, searchTokensFilter } from '../../utils/search';
import { Doctor } from '../doctors/doctor.model';
import { Patient, PATIENT_PUBLIC } from './patient.model';

const SORTS = {
  newest: { admittedAt: -1, _id: -1 },
  oldest: { admittedAt: 1, _id: 1 },
  name: { name: 1, _id: 1 },
  '-name': { name: -1, _id: -1 },
} as const;

type ListArgs = Omit<PatientListQuery, 'doctor'> & { doctor?: string };

/**
 * Shared by the Patients page and a doctor's patient list.
 * Filters are plain values (ObjectIds/Dates already cast) so the same object works in
 * `find()` and in the `$match` of the condition-count aggregation.
 */
async function queryPatients(q: ListArgs) {
  const base: Record<string, unknown> = {};
  const tokens = q.search ? searchTokensFilter(q.search) : undefined;
  if (tokens) base.searchTokens = tokens;
  if (q.doctor === UNASSIGNED) base.doctor = null;
  else if (q.doctor) base.doctor = new Types.ObjectId(q.doctor);
  if (q.gender) base.gender = q.gender;
  const admitted = dateRange(q.admittedFrom, q.admittedTo);
  if (admitted) base.admittedAt = admitted;

  const filter = q.condition ? { ...base, condition: q.condition } : base;

  const [items, total, facetRows] = await Promise.all([
    Patient.find(filter)
      .select(PATIENT_PUBLIC)
      .sort(SORTS[q.sort])
      .skip(skipFor(q.page, q.limit))
      .limit(q.limit)
      .populate('doctor', 'name')
      .lean(),
    Patient.countDocuments(filter),
    Patient.aggregate<{ _id: Condition; n: number }>([
      { $match: base },
      { $group: { _id: '$condition', n: { $sum: 1 } } },
    ]),
  ]);

  const facets: PatientFacets = { condition: facetCounts(facetRows) };
  return { data: items, meta: pageMeta(q.page, q.limit, total, facets) };
}

export function listPatients(q: PatientListQuery) {
  return queryPatients(q);
}

export function listDoctorPatients(doctorId: string, q: DoctorPatientsQuery) {
  return queryPatients({ ...q, doctor: doctorId, sort: 'newest' });
}

async function assertDoctor(id: string | null | undefined) {
  if (!id) return;
  const exists = await Doctor.exists({ _id: id });
  if (!exists)
    throw ApiError.badRequest('Doctor not found.', { doctor: 'Choose an existing doctor.' });
}

async function findPublic(id: Types.ObjectId | string) {
  const data = await Patient.findById(id).select(PATIENT_PUBLIC).populate('doctor', 'name').lean();
  if (!data) throw ApiError.notFound('Patient');
  return { data };
}

export function getPatient(id: string) {
  return findPublic(id);
}

export async function createPatient(input: PatientCreateData) {
  await assertDoctor(input.doctor);
  const doc = await Patient.create({
    ...input,
    doctor: input.doctor ? new Types.ObjectId(input.doctor) : null,
    admittedAt: parseIsoDate(input.admittedAt),
    dischargedAt: input.condition === 'Discharged' ? new Date() : null,
    searchTokens: buildSearchTokens(input),
  });
  return findPublic(doc._id);
}

export async function updatePatient(id: string, input: PatientUpdateData) {
  const doc = await Patient.findById(id).select('+searchTokens');
  if (!doc) throw ApiError.notFound('Patient');
  if (input.doctor !== undefined) await assertDoctor(input.doctor);

  const { admittedAt, doctor, ...rest } = input;
  doc.set(rest);
  if (admittedAt) doc.admittedAt = parseIsoDate(admittedAt);
  if (doctor !== undefined) doc.doctor = doctor ? new Types.ObjectId(doctor) : null;

  // Keep dischargedAt consistent with the condition (drives the "discharged per month" chart).
  if (input.condition === 'Discharged' && !doc.dischargedAt) doc.dischargedAt = new Date();
  if (input.condition && input.condition !== 'Discharged') doc.dischargedAt = null;

  if (input.name || input.email !== undefined || input.phone) {
    doc.searchTokens = buildSearchTokens({
      name: doc.name,
      email: doc.email ?? undefined,
      phone: doc.phone,
    });
  }
  await doc.save();
  return findPublic(doc._id);
}

export async function deletePatient(id: string) {
  const res = await Patient.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw ApiError.notFound('Patient');
}

/** "Remove from doctor's list" = unassign. The patient stays on the Patients page. */
export async function unassignPatient(doctorId: string, patientId: string) {
  const res = await Patient.updateOne(
    { _id: patientId, doctor: new Types.ObjectId(doctorId) },
    { $set: { doctor: null } },
  );
  if (res.matchedCount === 0) throw ApiError.notFound("Patient in this doctor's list");
}
