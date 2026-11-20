import { Types } from 'mongoose';
import {
  CONDITIONS,
  type Condition,
  type DoctorCreateInput,
  type DoctorFacets,
  type DoctorListQuery,
  type DoctorUpdateInput,
  type Specialization,
} from '@dt/shared';
import { ApiError } from '../../utils/ApiError';
import { dateRange } from '../../utils/dates';
import { facetCounts, pageMeta, skipFor } from '../../utils/pagination';
import { buildSearchTokens, searchTokensFilter } from '../../utils/search';
import { Patient } from '../patients/patient.model';
import { Doctor, DOCTOR_PUBLIC } from './doctor.model';

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name: { name: 1, _id: 1 },
  '-name': { name: -1, _id: -1 },
} as const;

/**
 * Patient counts for a page of doctors in ONE aggregation (no N+1).
 * `$match` on `doctor` uses the `{ doctor: 1, admittedAt: -1 }` index.
 */
async function patientCountsFor(ids: Types.ObjectId[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await Patient.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { doctor: { $in: ids } } },
    { $group: { _id: '$doctor', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listDoctors(q: DoctorListQuery) {
  // Filters shared by the table AND the specialization tab counts.
  const base: Record<string, unknown> = {};
  const tokens = q.search ? searchTokensFilter(q.search) : undefined;
  if (tokens) base.searchTokens = tokens;
  if (q.hospital) base.hospital = q.hospital;
  const joined = dateRange(q.joinedFrom, q.joinedTo);
  if (joined) base.createdAt = joined;

  const filter = q.specialization ? { ...base, specialization: q.specialization } : base;

  const [items, total, facetRows] = await Promise.all([
    Doctor.find(filter)
      .select(DOCTOR_PUBLIC)
      .sort(SORTS[q.sort])
      .skip(skipFor(q.page, q.limit))
      .limit(q.limit)
      .lean(),
    Doctor.countDocuments(filter),
    Doctor.aggregate<{ _id: Specialization; n: number }>([
      { $match: base },
      { $group: { _id: '$specialization', n: { $sum: 1 } } },
    ]),
  ]);

  const counts = await patientCountsFor(items.map((d) => d._id));
  const facets: DoctorFacets = { specialization: facetCounts(facetRows) };

  return {
    data: items.map((d) => ({ ...d, patientCount: counts.get(String(d._id)) ?? 0 })),
    meta: pageMeta(q.page, q.limit, total, facets),
  };
}

export async function doctorOptions() {
  const data = await Doctor.find({}, { name: 1 }).sort({ name: 1 }).lean();
  return { data };
}

export async function hospitals() {
  const data = (await Doctor.distinct('hospital')).sort((a, b) => a.localeCompare(b));
  return { data };
}

export async function getDoctor(id: string) {
  const _id = new Types.ObjectId(id);
  const [doctor, rows] = await Promise.all([
    Doctor.findById(_id).select(DOCTOR_PUBLIC).lean(),
    Patient.aggregate<{ _id: Condition; n: number }>([
      { $match: { doctor: _id } },
      { $group: { _id: '$condition', n: { $sum: 1 } } },
    ]),
  ]);
  if (!doctor) throw ApiError.notFound('Doctor');

  const byCondition = Object.fromEntries(CONDITIONS.map((c) => [c, 0])) as Record<
    Condition,
    number
  >;
  let total = 0;
  for (const row of rows) {
    byCondition[row._id] = row.n;
    total += row.n;
  }
  return { data: { ...doctor, stats: { total, byCondition } } };
}

export async function ensureDoctorExists(id: string): Promise<void> {
  const exists = await Doctor.exists({ _id: id });
  if (!exists) throw ApiError.notFound('Doctor');
}

export async function createDoctor(input: DoctorCreateInput) {
  const doc = await Doctor.create({ ...input, searchTokens: buildSearchTokens(input) });
  const { searchTokens: _omit, ...data } = doc.toObject();
  return { data };
}

export async function updateDoctor(id: string, input: DoctorUpdateInput) {
  const doc = await Doctor.findById(id).select('+searchTokens');
  if (!doc) throw ApiError.notFound('Doctor');
  doc.set(input);
  if (input.name || input.email || input.phone) {
    doc.searchTokens = buildSearchTokens({ name: doc.name, email: doc.email, phone: doc.phone });
  }
  await doc.save();
  const { searchTokens: _omit, ...data } = doc.toObject();
  return { data };
}

/** Deleting a doctor never deletes patients — they become unassigned. */
export async function deleteDoctor(id: string) {
  const _id = new Types.ObjectId(id);
  const doctor = await Doctor.findById(_id, { _id: 1 }).lean();
  if (!doctor) throw ApiError.notFound('Doctor');
  await Patient.updateMany({ doctor: _id }, { $set: { doctor: null } });
  await Doctor.deleteOne({ _id });
}
