/** Builds (and drops stale) indexes declared in the schemas. Run on deploy: `npm run db:indexes`. */
import { connectDB, disconnectDB } from '../config/db';
import { Doctor } from '../modules/doctors/doctor.model';
import { Patient } from '../modules/patients/patient.model';
import { User } from '../modules/users/user.model';

async function main() {
  await connectDB();
  for (const model of [User, Doctor, Patient]) {
    const dropped = await model.syncIndexes();
    const indexes = await model.listIndexes();
    console.log(
      `${model.modelName}: ${indexes.map((i) => i.name).join(', ')}` +
        (dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''),
    );
  }
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
