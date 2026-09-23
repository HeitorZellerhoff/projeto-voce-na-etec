import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  // Using 12 rounds for bcryptjs as it provides a good balance between security and performance
  return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
