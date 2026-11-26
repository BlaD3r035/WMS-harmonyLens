import bcrypt from 'bcryptjs';

const COST = 12;

// Compared against when the email is unknown, so response time does not reveal
// which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);

export const hashPassword = (password: string) => bcrypt.hash(password, COST);

export async function verifyPassword(
  password: string,
  hash: string | undefined,
): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash !== undefined && ok;
}
