import { Router } from 'express';
import {
  doctorCreateSchema,
  doctorListQuerySchema,
  doctorPatientCreateSchema,
  doctorPatientParams,
  doctorPatientsQuerySchema,
  doctorUpdateSchema,
  idParams,
} from '@dt/shared';
import { requireRole } from '../../middleware/auth';
import { handler } from '../../utils/handler';
import { createPatient, listDoctorPatients, unassignPatient } from '../patients/patient.service';
import * as doctors from './doctor.service';

const adminOnly = requireRole('admin');

export const doctorRouter = Router();

doctorRouter.get(
  '/',
  handler({ query: doctorListQuerySchema }, ({ query }) => doctors.listDoctors(query)),
);

doctorRouter.get(
  '/options',
  handler({}, ({ res }) => {
    res.set('Cache-Control', 'private, max-age=60');
    return doctors.doctorOptions();
  }),
);

doctorRouter.get(
  '/hospitals',
  handler({}, ({ res }) => {
    res.set('Cache-Control', 'private, max-age=60');
    return doctors.hospitals();
  }),
);

doctorRouter.post(
  '/',
  adminOnly,
  handler({ body: doctorCreateSchema }, ({ body, res }) => {
    res.status(201);
    return doctors.createDoctor(body);
  }),
);

doctorRouter.get(
  '/:id',
  handler({ params: idParams }, ({ params }) => doctors.getDoctor(params.id)),
);

doctorRouter.patch(
  '/:id',
  adminOnly,
  handler({ params: idParams, body: doctorUpdateSchema }, ({ params, body }) =>
    doctors.updateDoctor(params.id, body),
  ),
);

doctorRouter.delete(
  '/:id',
  adminOnly,
  handler({ params: idParams }, async ({ params }) => {
    await doctors.deleteDoctor(params.id);
  }),
);

// ── A doctor's patients ────────────────────────────────────────────────────────────────

doctorRouter.get(
  '/:id/patients',
  handler({ params: idParams, query: doctorPatientsQuerySchema }, async ({ params, query }) => {
    await doctors.ensureDoctorExists(params.id);
    return listDoctorPatients(params.id, query);
  }),
);

doctorRouter.post(
  '/:id/patients',
  adminOnly,
  handler({ params: idParams, body: doctorPatientCreateSchema }, async ({ params, body, res }) => {
    await doctors.ensureDoctorExists(params.id);
    res.status(201);
    return createPatient({ ...body, doctor: params.id });
  }),
);

doctorRouter.delete(
  '/:id/patients/:patientId',
  adminOnly,
  handler({ params: doctorPatientParams }, async ({ params }) => {
    await unassignPatient(params.id, params.patientId);
  }),
);
