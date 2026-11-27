import { createRequire } from 'node:module';
import { resolve } from 'node:path';

/**
 * Limpia los contadores de tasa compartidos por la API para que cada inicio de
 * sesión de la suite parte de un estado independiente. No desactiva los límites:
 * solo reinicia las claves antes de la acción que se quiere comprobar.
 */
export async function clearRateLimits(): Promise<void> {
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const Ioredis = require(`${resolve(process.cwd(), 'apps/api/node_modules')}/ioredis`);
  const redis = new Ioredis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    const keys = await redis.keys('ccltpg:rate:*');
    if (keys.length > 0) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}
