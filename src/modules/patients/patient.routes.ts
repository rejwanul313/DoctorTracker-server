import { Router } from 'express';
import {
  idParams,
  patientCreateSchema,
  patientListQuerySchema,
  patientUpdateSchema,
} from '@dt/shared';
import { requireRole } from '../../middleware/auth';
import { handler } from '../../utils/handler';
import * as patients from './patient.service';

const adminOnly = requireRole('admin');

export const patientRouter = Router();

patientRouter.get(
  '/',
  handler({ query: patientListQuerySchema }, ({ query }) => patients.listPatients(query)),
);

patientRouter.post(
  '/',
  adminOnly,
  handler({ body: patientCreateSchema }, ({ body, res }) => {
    res.status(201);
    return patients.createPatient(body);
  }),
);

patientRouter.get(
  '/:id',
  handler({ params: idParams }, ({ params }) => patients.getPatient(params.id)),
);

patientRouter.patch(
  '/:id',
  adminOnly,
  handler({ params: idParams, body: patientUpdateSchema }, ({ params, body }) =>
    patients.updatePatient(params.id, body),
  ),
);

patientRouter.delete(
  '/:id',
  adminOnly,
  handler({ params: idParams }, async ({ params }) => {
    await patients.deletePatient(params.id);
  }),
);
