/**
 * Resets the configured database and fills it with realistic demo data:
 * ~48 doctors, ~1,400 patients admitted over the last 14 months, an admin and a read-only staff user.
 *
 *   npm run seed            (refuses to run when NODE_ENV=production unless --force is passed)
 */
import { Types } from 'mongoose';
import { SPECIALIZATIONS, type Condition, type Gender, type Specialization } from '@dt/shared';
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { hashPassword } from '../modules/auth/auth.service';
import { Doctor } from '../modules/doctors/doctor.model';
import { Patient } from '../modules/patients/patient.model';
import { User } from '../modules/users/user.model';
import { buildSearchTokens } from '../utils/search';

const DAY = 24 * 60 * 60 * 1000;

// Deterministic PRNG so every seed produces the same demo data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261119);
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;
function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) {
    if ((r -= w) <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

const FEMALE = [
  'Ayesha',
  'Nusrat',
  'Sharmin',
  'Fatema',
  'Rokeya',
  'Tahmina',
  'Sabrina',
  'Nadia',
  'Farhana',
  'Shirin',
  'Rumana',
  'Taslima',
  'Jannat',
  'Mim',
  'Sadia',
  'Lamia',
  'Afroza',
  'Nasrin',
  'Dilruba',
  'Rehana',
  'Sumaiya',
  'Tania',
  'Maliha',
  'Anika',
  'Israt',
];
const MALE = [
  'Tanvir',
  'Mehedi',
  'Rafiq',
  'Jamal',
  'Mahbub',
  'Sajid',
  'Habib',
  'Imran',
  'Arif',
  'Kamal',
  'Rezaul',
  'Shakil',
  'Fahim',
  'Nayeem',
  'Rakib',
  'Sohel',
  'Tariq',
  'Asif',
  'Zubair',
  'Rashed',
  'Mizanur',
  'Anisur',
  'Kawsar',
  'Shafiq',
  'Rubel',
];
const LAST = [
  'Karim',
  'Hasan',
  'Rahman',
  'Sultana',
  'Ahmed',
  'Hossain',
  'Khatun',
  'Nahar',
  'Alam',
  'Begum',
  'Ullah',
  'Islam',
  'Chowdhury',
  'Akter',
  'Uddin',
  'Sarker',
  'Mia',
  'Talukder',
  'Bhuiyan',
  'Siddique',
  'Kabir',
  'Haque',
  'Sheikh',
  'Mollah',
  'Parvin',
];
const HOSPITALS = [
  { name: 'Square Hospital', domain: 'squarehospital.com' },
  { name: 'Evercare Hospital', domain: 'evercarebd.com' },
  { name: 'United Hospital', domain: 'uhlbd.com' },
  { name: 'Labaid Specialized', domain: 'labaidgroup.com' },
  { name: 'Ibn Sina Hospital', domain: 'ibnsinatrust.com' },
  { name: 'Popular Medical College', domain: 'populardiagnostic.com' },
];

/** The doctors shown in the design, so the demo matches the mock-ups. */
const FEATURED: { name: string; spec: Specialization; hospital: number; weight: number }[] = [
  { name: 'Dr. Farhana Rahman', spec: 'Cardiology', hospital: 0, weight: 2.6 },
  { name: 'Dr. Imran Chowdhury', spec: 'Neurology', hospital: 1, weight: 2.4 },
  { name: 'Dr. Nadia Islam', spec: 'Pediatrics', hospital: 2, weight: 2.1 },
  { name: 'Dr. Arif Hossain', spec: 'Orthopedics', hospital: 3, weight: 1.9 },
  { name: 'Dr. Sabrina Akter', spec: 'Cardiology', hospital: 0, weight: 1.7 },
  { name: 'Dr. Kamal Uddin', spec: 'Orthopedics', hospital: 1, weight: 1.6 },
  { name: 'Dr. Tahmina Begum', spec: 'Neurology', hospital: 2, weight: 1.35 },
  { name: 'Dr. Rezaul Karim', spec: 'Pediatrics', hospital: 3, weight: 1.15 },
];
const DOCTOR_COUNT = 48;

function phone(): string {
  const prefix = pick([
    '1711',
    '1712',
    '1715',
    '1716',
    '1817',
    '1819',
    '1911',
    '1913',
    '1611',
    '1556',
  ]);
  return `+880 ${prefix}-${String(int(0, 999_999)).padStart(6, '0')}`;
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/^dr\.\s*/, '')
    .replace(/[^a-z]+/g, '.');
}

async function main() {
  if (env.isProd && !process.argv.includes('--force')) {
    console.error('Refusing to reset a production database. Pass --force if you really mean it.');
    process.exit(1);
  }
  const conn = await connectDB();
  console.log(`Seeding database "${conn.connection.name}"…`);

  await Promise.all([User.deleteMany({}), Doctor.deleteMany({}), Patient.deleteMany({})]);
  await Promise.all([User.syncIndexes(), Doctor.syncIndexes(), Patient.syncIndexes()]);

  const now = new Date();

  // ── Users ────────────────────────────────────────────────────────────────────────────
  const users = [
    {
      name: process.env.SEED_ADMIN_NAME ?? 'Shahana Alam',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@doctortracker.app',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
      role: 'admin' as const,
    },
    {
      name: 'Rafsan Kabir',
      email: process.env.SEED_STAFF_EMAIL ?? 'staff@doctortracker.app',
      password: process.env.SEED_STAFF_PASSWORD ?? 'Staff@12345',
      role: 'staff' as const,
    },
  ];
  await User.insertMany(
    await Promise.all(
      users.map(async (u) => ({
        name: u.name,
        email: u.email.toLowerCase(),
        role: u.role,
        passwordHash: await hashPassword(u.password),
      })),
    ),
  );

  // ── Doctors ──────────────────────────────────────────────────────────────────────────
  const usedEmails = new Set<string>();
  const doctors = Array.from({ length: DOCTOR_COUNT }, (_, i) => {
    const featured = FEATURED[i];
    const gender = rand() < 0.5 ? 'f' : 'm';
    const name = featured?.name ?? `Dr. ${pick(gender === 'f' ? FEMALE : MALE)} ${pick(LAST)}`;
    const hospital = HOSPITALS[featured?.hospital ?? int(0, HOSPITALS.length - 1)]!;
    let email = `${slug(name)}@${hospital.domain}`;
    for (let n = 2; usedEmails.has(email); n++) email = `${slug(name)}${n}@${hospital.domain}`;
    usedEmails.add(email);
    // Featured doctors joined early in the year; the rest spread across the last ~11 months.
    const createdAt = new Date(
      now.getTime() - (featured ? 410 - i * 25 : int(5, 400)) * DAY - int(0, DAY / 2),
    );
    const doc = {
      _id: new Types.ObjectId(),
      name,
      specialization:
        featured?.spec ??
        weighted<Specialization>(
          SPECIALIZATIONS.map((s) => [s, s === 'Pediatrics' || s === 'Orthopedics' ? 1.4 : 1]),
        ),
      hospital: hospital.name,
      phone: phone(),
      email,
      createdAt,
      updatedAt: createdAt,
    };
    return {
      ...doc,
      searchTokens: buildSearchTokens(doc),
      weight: featured?.weight ?? 0.25 + rand() * 1.1,
    };
  });
  await Doctor.insertMany(doctors.map(({ weight: _w, ...d }) => d));

  // ── Patients ─────────────────────────────────────────────────────────────────────────
  const patients: Record<string, unknown>[] = [];
  const monthStart = (offset: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));

  for (let m = -13; m <= 0; m++) {
    const start = monthStart(m);
    const end = m === 0 ? now : monthStart(m + 1);
    // Steady growth over the year, with noise; the current month is pro-rated.
    const fullMonth = Math.round(70 + (m + 13) * 6 + int(-8, 8));
    const fraction =
      (end.getTime() - start.getTime()) / (monthStart(m + 1).getTime() - start.getTime());
    const count = Math.round(fullMonth * fraction);

    for (let k = 0; k < count; k++) {
      const admittedAt = new Date(start.getTime() + rand() * (end.getTime() - start.getTime()));
      admittedAt.setUTCHours(0, 0, 0, 0);
      const ageDays = (now.getTime() - admittedAt.getTime()) / DAY;

      const condition = weighted<Condition>(
        ageDays > 45
          ? [
              ['Discharged', 62],
              ['Stable', 28],
              ['Recovering', 8],
              ['Critical', 1.2],
            ]
          : ageDays > 14
            ? [
                ['Discharged', 30],
                ['Stable', 38],
                ['Recovering', 27],
                ['Critical', 4],
              ]
            : [
                ['Discharged', 8],
                ['Stable', 40],
                ['Recovering', 38],
                ['Critical', 9],
              ],
      );

      // Assign to a doctor who had already joined; ~4% stay unassigned.
      const eligible = doctors.filter((d) => d.createdAt <= admittedAt);
      const doctor =
        rand() < 0.04 || eligible.length === 0
          ? null
          : weighted(eligible.map((d) => [d, d.weight] as [typeof d, number]));

      const gender: Gender = rand() < 0.02 ? 'Other' : rand() < 0.5 ? 'Female' : 'Male';
      const first = pick(
        gender === 'Female' ? FEMALE : gender === 'Male' ? MALE : [...FEMALE, ...MALE],
      );
      const name = `${first} ${pick(LAST)}`;
      const email = rand() < 0.75 ? `${slug(name)}${int(1, 99)}@mail.com` : undefined;
      const age = doctor?.specialization === 'Pediatrics' ? int(1, 16) : int(18, 88);
      const dischargedAt =
        condition === 'Discharged'
          ? new Date(Math.min(now.getTime(), admittedAt.getTime() + int(2, 30) * DAY))
          : null;
      const fields = { name, email, phone: phone() };

      patients.push({
        ...fields,
        age,
        gender,
        condition,
        doctor: doctor?._id ?? null,
        admittedAt,
        dischargedAt,
        searchTokens: buildSearchTokens(fields),
        createdAt: admittedAt,
        updatedAt: dischargedAt ?? admittedAt,
      });
    }
  }
  await Patient.insertMany(patients, { ordered: false });

  console.log(`✔ ${users.length} users, ${doctors.length} doctors, ${patients.length} patients`);
  for (const u of users) console.log(`  ${u.role.padEnd(5)}  ${u.email}  /  ${u.password}`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
