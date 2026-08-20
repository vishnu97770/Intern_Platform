import bcrypt from "bcryptjs";

// 12 rounds balances hashing cost against login latency; standard baseline
// for bcrypt in 2025+ production services.
const SALT_ROUNDS = 12;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainTextPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, hash);
}
