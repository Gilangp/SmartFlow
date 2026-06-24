import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePasswords(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export function generateKtmToken(nim: string, name: string): string {
  return jwt.sign(
    { nim, name, validKtm: true },
    JWT_SECRET,
    { expiresIn: '1h' } // Valid for 1 hour
  );
}

export function verifyKtmToken(token: string): { nim: string; name: string; validKtm: boolean } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { nim: string; name: string; validKtm: boolean };
  } catch {
    return null;
  }
}
