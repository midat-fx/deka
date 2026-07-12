import { createHash } from 'node:crypto';

/**
 * Необратимый хэш telegram-id (sha256 + соль, первые 16 hex-символов).
 * Одинаковый у телеметрии и трекера — чтобы данные пользователя связывались
 * между собой, но никогда не раскрывали настоящий id.
 */
export function hashUser(salt: string, telegramId: number): string {
  return createHash('sha256').update(`${salt}:${telegramId}`).digest('hex').slice(0, 16);
}
