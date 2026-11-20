import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Role } from '@dt/shared';
import { createApp } from '../app';
import { hashPassword } from '../modules/auth/auth.service';
import { Doctor } from '../modules/doctors/doctor.model';
import { Patient } from '../modules/patients/patient.model';
import { User } from '../modules/users/user.model';

let memory: MongoMemoryServer | undefined;

/**
 * Uses MONGODB_TEST_URI when set (e.g. a local Docker MongoDB), otherwise an in-memory server.
 * Each test file gets its own database.
 */
export async function startDb(name: string) {
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    memory = await MongoMemoryServer.create();
    uri = memory.getUri();
  }
  await mongoose.connect(uri, { dbName: `dt-test-${name}` });
  await Promise.all([User.syncIndexes(), Doctor.syncIndexes(), Patient.syncIndexes()]);
}

export async function stopDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await memory?.stop();
}

export async function clearDb() {
  await Promise.all([User.deleteMany({}), Doctor.deleteMany({}), Patient.deleteMany({})]);
}

export const app = createApp();

export const PASSWORD = 'Password@123';

export async function createUser(role: Role = 'admin', email = `${role}@test.dev`) {
  return User.create({
    name: `Test ${role}`,
    email,
    role,
    passwordHash: await hashPassword(PASSWORD),
  });
}

/** A supertest agent that keeps the session cookie. */
export async function loginAs(role: Role = 'admin') {
  const email = `${role}@test.dev`;
  if (!(await User.exists({ email }))) await createUser(role, email);
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  return agent;
}

export const doctorInput = (overrides: Record<string, unknown> = {}) => ({
  name: 'Dr. Farhana Rahman',
  specialization: 'Cardiology',
  hospital: 'Square Hospital',
  phone: '+880 1711-204518',
  email: 'farhana.rahman@squarehospital.com',
  ...overrides,
});

export const patientInput = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ayesha Karim',
  email: 'ayesha.karim@mail.com',
  phone: '+880 1712-448190',
  age: 54,
  gender: 'Female',
  condition: 'Stable',
  admittedAt: '2026-11-18',
  ...overrides,
});
