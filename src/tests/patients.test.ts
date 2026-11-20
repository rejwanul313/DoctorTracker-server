import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDb, doctorInput, loginAs, patientInput, startDb, stopDb } from './helpers';

let admin: TestAgent;
let doctorId: string;

beforeAll(() => startDb('patients'));
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  admin = await loginAs('admin');
  doctorId = (await admin.post('/api/v1/doctors').send(doctorInput()).expect(201)).body.data._id;
});

const create = (overrides: Record<string, unknown> = {}) =>
  admin.post('/api/v1/patients').send(patientInput(overrides));

describe('patients', () => {
  it('creates a patient (unassigned by default) and validates input', async () => {
    const res = await create().expect(201);
    expect(res.body.data).toMatchObject({ name: 'Ayesha Karim', doctor: null, dischargedAt: null });

    const bad = await create({
      age: 300,
      gender: 'X',
      admittedAt: '18/11/2026',
      doctor: 'nope',
    }).expect(400);
    expect(Object.keys(bad.body.error.details).sort()).toEqual([
      'admittedAt',
      'age',
      'doctor',
      'gender',
    ]);
  });

  it('rejects assignment to a doctor that does not exist', async () => {
    const res = await create({ doctor: '64b7f0000000000000000000' }).expect(400);
    expect(res.body.error.details).toHaveProperty('doctor');
  });

  it('filters by condition, doctor, unassigned and admitted date; facets count every condition', async () => {
    await create({ doctor: doctorId, condition: 'Critical', admittedAt: '2026-10-01' });
    await create({
      name: 'Tanvir Hasan',
      doctor: doctorId,
      condition: 'Stable',
      admittedAt: '2026-11-10',
    });
    await create({ name: 'Nusrat Sultana', condition: 'Stable', admittedAt: '2026-11-16' });

    const total = (q: Record<string, string>) =>
      admin
        .get('/api/v1/patients')
        .query(q)
        .expect(200)
        .then((r) => r.body.meta.total as number);

    expect(await total({ condition: 'Stable' })).toBe(2);
    expect(await total({ doctor: doctorId })).toBe(2);
    expect(await total({ doctor: 'unassigned' })).toBe(1);
    expect(await total({ admittedFrom: '2026-11-01', admittedTo: '2026-11-16' })).toBe(2);
    expect(await total({ search: 'nusr' })).toBe(1);

    const res = await admin.get('/api/v1/patients').query({ condition: 'Critical' }).expect(200);
    expect(res.body.meta.facets.condition).toEqual({ all: 3, Critical: 1, Stable: 2 });
    expect(res.body.data[0].doctor).toMatchObject({ _id: doctorId, name: 'Dr. Farhana Rahman' });
  });

  it('sorts newest admitted first by default', async () => {
    await create({ name: 'Old Patient', admittedAt: '2026-01-01' });
    await create({ name: 'New Patient', admittedAt: '2026-11-01' });
    const res = await admin.get('/api/v1/patients').expect(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual([
      'New Patient',
      'Old Patient',
    ]);
  });

  it('keeps dischargedAt in sync with the condition and reassigns doctors on update', async () => {
    const { _id } = (await create().expect(201)).body.data;

    const discharged = await admin
      .patch(`/api/v1/patients/${_id}`)
      .send({ condition: 'Discharged' })
      .expect(200);
    expect(discharged.body.data.dischargedAt).not.toBeNull();

    const back = await admin
      .patch(`/api/v1/patients/${_id}`)
      .send({ condition: 'Recovering', doctor: doctorId })
      .expect(200);
    expect(back.body.data.dischargedAt).toBeNull();
    expect(back.body.data.doctor).toMatchObject({ _id: doctorId });

    // Omitting `doctor` in a PATCH must not unassign the patient.
    const renamed = await admin
      .patch(`/api/v1/patients/${_id}`)
      .send({ name: 'Ayesha K' })
      .expect(200);
    expect(renamed.body.data.doctor).toMatchObject({ _id: doctorId });

    await admin.patch(`/api/v1/patients/${_id}`).send({}).expect(400);
  });

  it('deletes a patient', async () => {
    const { _id } = (await create().expect(201)).body.data;
    await admin.delete(`/api/v1/patients/${_id}`).expect(204);
    await admin.get(`/api/v1/patients/${_id}`).expect(404);
    await admin.delete(`/api/v1/patients/${_id}`).expect(404);
  });
});

describe('stats', () => {
  it('returns overview totals and a 12-month timeline', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await create({ doctor: doctorId, condition: 'Critical', admittedAt: today });
    await create({ name: 'Tanvir Hasan', condition: 'Discharged', admittedAt: today });

    const overview = (await admin.get('/api/v1/stats/overview').expect(200)).body.data;
    expect(overview.totals).toEqual({ doctors: 1, patients: 2, critical: 1, unassigned: 1 });
    expect(overview.byCondition).toEqual({ Stable: 0, Recovering: 0, Critical: 1, Discharged: 1 });
    expect(overview.topDoctors[0]).toMatchObject({ name: 'Dr. Farhana Rahman', patients: 1 });
    expect(overview.recentPatients).toHaveLength(2);
    expect(overview.deltas.newThisMonth.value).toBe(2);
    expect(overview.criticalNewThisMonth).toBe(1);

    const timeline = (await admin.get('/api/v1/stats/timeline').expect(200)).body.data;
    expect(timeline).toHaveLength(12);
    expect(timeline.at(-1)).toMatchObject({ admitted: 2, discharged: 1 });

    await admin.get('/api/v1/stats/timeline').query({ months: 99 }).expect(400);
  });
});
