export const SPECIALIZATIONS = [
  'Cardiology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Dermatology',
  'Oncology',
  'General medicine',
] as const;
export type Specialization = (typeof SPECIALIZATIONS)[number];

export const CONDITIONS = ['Stable', 'Recovering', 'Critical', 'Discharged'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const GENDERS = ['Male', 'Female', 'Other'] as const;
export type Gender = (typeof GENDERS)[number];

export const ROLES = ['admin', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const PAGE_SIZES = [5, 10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** Sentinel used in the `doctor` filter to select patients without a doctor. */
export const UNASSIGNED = 'unassigned';
