import type { Condition, Gender, Role, Specialization } from './enums';

/** Shapes returned by the REST API (dates are ISO strings on the wire). */

export interface UserDTO {
  _id: string;
  name: string;
  email: string;
  role: Role;
}

export interface DoctorDTO {
  _id: string;
  name: string;
  specialization: Specialization;
  hospital: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorListItem extends DoctorDTO {
  patientCount: number;
}

export interface DoctorDetail extends DoctorDTO {
  stats: { total: number; byCondition: Record<Condition, number> };
}

export interface DoctorOption {
  _id: string;
  name: string;
}

export interface PatientDTO {
  _id: string;
  name: string;
  email?: string;
  phone: string;
  age: number;
  gender: Gender;
  condition: Condition;
  doctor: DoctorOption | null;
  admittedAt: string;
  dischargedAt: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta<F = undefined> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  facets?: F;
}

export interface ApiList<T, F = undefined> {
  data: T[];
  meta: PageMeta<F>;
}

export interface ApiItem<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

/** Counts per tab value; `all` is the total across tabs (other filters still applied). */
export type DoctorFacets = {
  specialization: Partial<Record<Specialization, number>> & { all: number };
};
export type PatientFacets = { condition: Partial<Record<Condition, number>> & { all: number } };

export interface Delta {
  value: number;
  /** Percent change vs the previous month; null when the previous month was 0. */
  changePct: number | null;
}

export interface StatsOverview {
  totals: { doctors: number; patients: number; critical: number; unassigned: number };
  deltas: {
    doctors: Delta;
    patients: Delta;
    /** Admissions month-to-date vs the same days of last month. */
    newThisMonth: Delta;
  };
  /** Patients admitted this month who are currently critical. */
  criticalNewThisMonth: number;
  /** Last 7 months of counts for the stat-card sparklines, oldest first. */
  sparklines: {
    doctors: number[];
    patients: number[];
    critical: number[];
  };
  byCondition: Record<Condition, number>;
  topDoctors: { _id: string; name: string; specialization: Specialization; patients: number }[];
  recentPatients: Pick<PatientDTO, '_id' | 'name' | 'condition' | 'admittedAt' | 'doctor'>[];
}

export interface TimelinePoint {
  /** `YYYY-MM` */
  month: string;
  admitted: number;
  discharged: number;
}
