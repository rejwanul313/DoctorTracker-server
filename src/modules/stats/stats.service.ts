import {
  CONDITIONS,
  type Condition,
  type Specialization,
  type StatsOverview,
  type TimelinePoint,
} from '@dt/shared';
import { lastMonths, pctChange, startOfMonthUTC } from '../../utils/dates';
import { Doctor } from '../doctors/doctor.model';
import { Patient } from '../patients/patient.model';

const SPARK_MONTHS = 7;
const monthKey = (field: string) => ({ $dateToString: { format: '%Y-%m', date: field } });

type MonthRow = { _id: string; n: number; critical?: number };

function series(rows: MonthRow[], months: string[], key: 'n' | 'critical' = 'n'): number[] {
  const byMonth = new Map(rows.map((r) => [r._id, r[key] ?? 0]));
  return months.map((m) => byMonth.get(m) ?? 0);
}

/**
 * Dashboard numbers. Every query below is index-backed (COUNT_SCAN / IXSCAN) and they all run
 * in parallel — no `$facet` over the whole collection, which would force a collection scan.
 */
export async function overview(now = new Date()): Promise<StatsOverview> {
  const thisMonth = startOfMonthUTC(now);
  const lastMonth = startOfMonthUTC(now, -1);
  const sparkStart = startOfMonthUTC(now, -(SPARK_MONTHS - 1));
  const months = lastMonths(SPARK_MONTHS, now);

  const [
    doctorsTotal,
    doctorsBefore,
    doctorMonthly,
    patientsTotal,
    patientsBefore,
    admittedSameDaysLastMonth,
    unassigned,
    conditionCounts,
    patientMonthly,
    topDoctors,
    recentPatients,
  ] = await Promise.all([
    Doctor.estimatedDocumentCount(),
    Doctor.countDocuments({ createdAt: { $lt: thisMonth } }),
    Doctor.aggregate<MonthRow>([
      { $match: { createdAt: { $gte: sparkStart } } },
      { $group: { _id: monthKey('$createdAt'), n: { $sum: 1 } } },
    ]),
    Patient.estimatedDocumentCount(),
    Patient.countDocuments({ admittedAt: { $lt: thisMonth } }),
    // Month-to-date comparison: a partial month vs the same number of days last month.
    Patient.countDocuments({
      admittedAt: {
        $gte: lastMonth,
        $lt: new Date(lastMonth.getTime() + (now.getTime() - thisMonth.getTime())),
      },
    }),
    Patient.countDocuments({ doctor: null }),
    Promise.all(CONDITIONS.map((condition) => Patient.countDocuments({ condition }))),
    Patient.aggregate<MonthRow>([
      { $match: { admittedAt: { $gte: sparkStart } } },
      {
        $group: {
          _id: monthKey('$admittedAt'),
          n: { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ['$condition', 'Critical'] }, 1, 0] } },
        },
      },
    ]),
    Patient.aggregate<{
      _id: string;
      patients: number;
      name: string;
      specialization: Specialization;
    }>([
      { $match: { doctor: { $type: 'objectId' } } },
      { $group: { _id: '$doctor', patients: { $sum: 1 } } },
      { $sort: { patients: -1, _id: 1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'doctors',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor',
          pipeline: [{ $project: { name: 1, specialization: 1 } }],
        },
      },
      { $unwind: '$doctor' },
      { $project: { patients: 1, name: '$doctor.name', specialization: '$doctor.specialization' } },
    ]),
    Patient.find({}, { name: 1, condition: 1, admittedAt: 1, doctor: 1 })
      .sort({ admittedAt: -1, _id: -1 })
      .limit(5)
      .populate('doctor', 'name')
      .lean(),
  ]);

  const byCondition = Object.fromEntries(
    CONDITIONS.map((c, i) => [c, conditionCounts[i] ?? 0]),
  ) as Record<Condition, number>;

  const admitted = series(patientMonthly, months);
  const critical = series(patientMonthly, months, 'critical');
  const doctorsNew = series(doctorMonthly, months);
  const cur = admitted.length - 1;

  return {
    totals: {
      doctors: doctorsTotal,
      patients: patientsTotal,
      critical: byCondition.Critical,
      unassigned,
    },
    deltas: {
      doctors: { value: doctorsTotal, changePct: pctChange(doctorsTotal, doctorsBefore) },
      patients: { value: patientsTotal, changePct: pctChange(patientsTotal, patientsBefore) },
      newThisMonth: {
        value: admitted[cur] ?? 0,
        changePct: pctChange(admitted[cur] ?? 0, admittedSameDaysLastMonth),
      },
    },
    criticalNewThisMonth: critical[cur] ?? 0,
    sparklines: { doctors: doctorsNew, patients: admitted, critical },
    byCondition,
    topDoctors: topDoctors.map((d) => ({ ...d, _id: String(d._id) })),
    recentPatients: recentPatients as unknown as StatsOverview['recentPatients'],
  };
}

/** Admissions vs discharges per month; empty months are filled with 0. */
export async function timeline(monthsBack: number, now = new Date()): Promise<TimelinePoint[]> {
  const start = startOfMonthUTC(now, -(monthsBack - 1));
  const months = lastMonths(monthsBack, now);

  const [admittedRows, dischargedRows] = await Promise.all([
    Patient.aggregate<MonthRow>([
      { $match: { admittedAt: { $gte: start } } },
      { $group: { _id: monthKey('$admittedAt'), n: { $sum: 1 } } },
    ]),
    Patient.aggregate<MonthRow>([
      { $match: { dischargedAt: { $gte: start } } },
      { $group: { _id: monthKey('$dischargedAt'), n: { $sum: 1 } } },
    ]),
  ]);

  const admitted = series(admittedRows, months);
  const discharged = series(dischargedRows, months);
  return months.map((month, i) => ({
    month,
    admitted: admitted[i] ?? 0,
    discharged: discharged[i] ?? 0,
  }));
}
