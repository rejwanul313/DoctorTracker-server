import type TestAgent from 'supertest/lib/agent';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDb, doctorInput, loginAs, patientInput, startDb, stopDb } from './helpers';

let admin: TestAgent;

beforeAll(() => startDb('doctors'));
afterAll(() => stopDb());
beforeEach(async () => {
  await clearDb();
  admin = await loginAs('admin');
});

async function createDoctor(overrides: Record<string, unknown> = {}) {
  const res = await admin.post('/api/v1/doctors').send(doctorInput(overrides)).expect(201);
  return res.body.data as { _id: string; name: string };
}

describe('doctors', () => {
  it('creates a doctor and hides internal fields', async () => {
    const doctor = await createDoctor();
    expect(doctor).toMatchObject({ name: 'Dr. Farhana Rahman', specialization: 'Cardiology' });
    expect(doctor).not.toHaveProperty('searchTokens');
  });

  it('returns per-field validation errors', async () => {
    const res = await admin
      .post('/api/v1/doctors')
      .send({ name: 'D', specialization: 'Magic', email: 'tahmina.b@', phone: '1' })
      .expect(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(
      ['email', 'hospital', 'name', 'phone', 'specialization'].sort(),
    );
  });

  it('rejects a duplicate email with 409 on the email field', async () => {
    await createDoctor();
    const res = await admin
      .post('/api/v1/doctors')
      .send(doctorInput({ name: 'Dr. Other' }))
      .expect(409);
    expect(res.body.error.details).toHaveProperty('email');
  });

  it('returns 400 for a malformed id and 404 for a missing doctor', async () => {
    await admin.get('/api/v1/doctors/not-an-id').expect(400);
    await admin.get('/api/v1/doctors/64b7f0000000000000000000').expect(404);
  });

  it('searches by name prefix, multiple words, email and local phone format', async () => {
    await createDoctor();
    await createDoctor({
      name: 'Dr. Imran Chowdhury',
      email: 'imran.c@evercarebd.com',
      phone: '+880 1819-337402',
      specialization: 'Neurology',
    });

    const names = async (search: string) =>
      (await admin.get('/api/v1/doctors').query({ search }).expect(200)).body.data.map(
        (d: { name: string }) => d.name,
      );

    expect(await names('farh')).toEqual(['Dr. Farhana Rahman']);
    expect(await names('farhana rah')).toEqual(['Dr. Farhana Rahman']);
    expect(await names('imran.c@ever')).toEqual(['Dr. Imran Chowdhury']);
    expect(await names('01819')).toEqual(['Dr. Imran Chowdhury']);
    expect(await names('rahman imran')).toEqual([]);
    expect(await names('.*')).toHaveLength(2); // punctuation only = no search, never a regex
    expect(await names('farhana.r@')).toEqual([]); // `.` is escaped, not "any character"
  });

  it('paginates, filters, and returns specialization facets + patient counts', async () => {
    const cardio = await createDoctor();
    for (let i = 0; i < 3; i++) {
      await createDoctor({
        name: `Dr. Neuro ${i}`,
        email: `n${i}@x.com`,
        specialization: 'Neurology',
      });
    }
    await admin.post(`/api/v1/doctors/${cardio._id}/patients`).send(patientInput()).expect(201);
    await admin
      .post(`/api/v1/doctors/${cardio._id}/patients`)
      .send(patientInput({ name: 'Jamal Hossain' }))
      .expect(201);

    const page = await admin.get('/api/v1/doctors').query({ limit: 2, page: 2 }).expect(200);
    expect(page.body.meta).toMatchObject({ page: 2, limit: 2, total: 4, totalPages: 2 });

    const filtered = await admin
      .get('/api/v1/doctors')
      .query({ specialization: 'Cardiology' })
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].patientCount).toBe(2);
    // Facets ignore the active specialization so every tab keeps its count.
    expect(filtered.body.meta.facets.specialization).toEqual({
      all: 4,
      Cardiology: 1,
      Neurology: 3,
    });
  });

  it('filters by joined date range (inclusive)', async () => {
    await createDoctor();
    const today = new Date().toISOString().slice(0, 10);
    const hit = await admin
      .get('/api/v1/doctors')
      .query({ joinedFrom: today, joinedTo: today })
      .expect(200);
    expect(hit.body.meta.total).toBe(1);
    const miss = await admin.get('/api/v1/doctors').query({ joinedTo: '2000-01-01' }).expect(200);
    expect(miss.body.meta.total).toBe(0);
  });

  it('returns detail stats, updates search tokens on edit, and unassigns patients on delete', async () => {
    const doctor = await createDoctor();
    const p = await admin
      .post(`/api/v1/doctors/${doctor._id}/patients`)
      .send(patientInput({ condition: 'Critical' }))
      .expect(201);

    const detail = await admin.get(`/api/v1/doctors/${doctor._id}`).expect(200);
    expect(detail.body.data.stats).toMatchObject({
      total: 1,
      byCondition: { Critical: 1, Stable: 0 },
    });

    await admin.patch(`/api/v1/doctors/${doctor._id}`).send({ name: 'Dr. Zara Noor' }).expect(200);
    const found = await admin.get('/api/v1/doctors').query({ search: 'zara' }).expect(200);
    expect(found.body.meta.total).toBe(1);

    await admin.delete(`/api/v1/doctors/${doctor._id}`).expect(204);
    const patient = await admin.get(`/api/v1/patients/${p.body.data._id}`).expect(200);
    expect(patient.body.data.doctor).toBeNull();
  });

  it("removes (unassigns) a patient from a doctor's list", async () => {
    const doctor = await createDoctor();
    const p = await admin
      .post(`/api/v1/doctors/${doctor._id}/patients`)
      .send(patientInput())
      .expect(201);
    expect(p.body.data.doctor).toMatchObject({ _id: doctor._id, name: doctor.name });

    await admin.delete(`/api/v1/doctors/${doctor._id}/patients/${p.body.data._id}`).expect(204);
    const list = await admin.get(`/api/v1/doctors/${doctor._id}/patients`).expect(200);
    expect(list.body.meta.total).toBe(0);
    // Still exists on the Patients page.
    await admin.get(`/api/v1/patients/${p.body.data._id}`).expect(200);
    // Removing again is a 404.
    await admin.delete(`/api/v1/doctors/${doctor._id}/patients/${p.body.data._id}`).expect(404);
  });
});
