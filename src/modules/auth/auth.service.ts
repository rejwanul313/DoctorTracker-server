import bcrypt from 'bcryptjs';
import type { LoginInput, UserDTO } from '@dt/shared';
import { ApiError } from '../../utils/ApiError';
import { User } from '../users/user.model';

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyCredentials({ email, password }: LoginInput): Promise<UserDTO> {
  const user = await User.findOne({ email }).select('+passwordHash').lean();
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  return { _id: String(user._id), name: user.name, email: user.email, role: user.role };
}

export async function getUser(id: string): Promise<UserDTO> {
  const user = await User.findById(id).select('name email role').lean();
  if (!user) throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.');
  return { _id: String(user._id), name: user.name, email: user.email, role: user.role };
}
