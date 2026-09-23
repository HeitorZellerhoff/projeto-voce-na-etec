'use server';

import { db } from '@/lib/db';
import { createSession, destroySession } from '@/lib/jwt';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';

export async function login(email: string, passwordString: string) {
  if (!email || !passwordString) {
    return { error: 'E-mail e senha são obrigatórios' };
  }

  const user = await db.user.findUnique({ where: { email } });
  
  if (!user) {
    return { error: 'Credenciais inválidas' };
  }

  const isValidPassword = await bcrypt.compare(passwordString, user.password);
  
  if (!isValidPassword) {
    return { error: 'Credenciais inválidas' };
  }

  await createSession({
    userId: user.id,
    sectorId: user.sectorId
  });

  return { success: true };
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
