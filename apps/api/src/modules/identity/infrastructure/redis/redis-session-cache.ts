import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS } from '../../../../database/database.module.js';
import type { PartialScope } from '../../../../shared/auth/auth-metadata.js';
import { AuthError } from '../../application/auth-error.js';
import { SessionCache, type PartialTokenRecord } from '../../application/ports/session-cache.js';

const PREFIX = 'ccltpg:auth';

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class RedisSessionCache implements SessionCache {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async issuePartial(usuarioId: string, scope: PartialScope, ttlSeconds: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const key = this.partialKey(token, scope);

    try {
      await this.redis
        .multi()
        .hset(key, 'usuario_id', usuarioId, 'attempts', '0')
        .expire(key, ttlSeconds)
        .exec();
    } catch {
      throw AuthError.serviceUnavailable();
    }

    return token;
  }

  async getPartial(token: string, scope: PartialScope): Promise<PartialTokenRecord | null> {
    try {
      const values = await this.redis.hgetall(this.partialKey(token, scope));
      if (!values || !values.usuario_id) {
        return null;
      }
      return {
        usuarioId: values.usuario_id,
        attempts: Number(values.attempts ?? 0),
      };
    } catch {
      throw AuthError.serviceUnavailable();
    }
  }

  async incrementPartialAttempts(token: string, scope: PartialScope): Promise<number> {
    const key = this.partialKey(token, scope);
    try {
      const attempts = await this.redis.hincrby(key, 'attempts', 1);
      if ((await this.redis.ttl(key)) < 0) {
        // La clave existía sin TTL por una carrera; se acota igualmente.
        await this.redis.expire(key, 300);
      }
      return attempts;
    } catch {
      throw AuthError.serviceUnavailable();
    }
  }

  async invalidatePartial(token: string, scope: PartialScope): Promise<void> {
    try {
      await this.redis.del(this.partialKey(token, scope));
    } catch {
      throw AuthError.serviceUnavailable();
    }
  }

  async denySid(sid: string, expiresAt: Date): Promise<void> {
    await this.setExpiring(`${PREFIX}:deny:sid:${sid}`, expiresAt);
  }

  async isSidDenied(sid: string): Promise<boolean> {
    return this.exists(`${PREFIX}:deny:sid:${sid}`);
  }

  async denyJti(jti: string, expiresAt: Date): Promise<void> {
    await this.setExpiring(`${PREFIX}:deny:jti:${jti}`, expiresAt);
  }

  async isJtiDenied(jti: string): Promise<boolean> {
    return this.exists(`${PREFIX}:deny:jti:${jti}`);
  }

  async setSessionAmr(sid: string, amr: readonly string[], expiresAt: Date): Promise<void> {
    const ttl = Math.max(Math.ceil((expiresAt.getTime() - Date.now()) / 1000), 1);
    try {
      await this.redis.set(`${PREFIX}:amr:${sid}`, JSON.stringify(amr), 'EX', ttl);
    } catch {
      throw AuthError.serviceUnavailable();
    }
  }

  async getSessionAmr(sid: string): Promise<string[] | null> {
    try {
      const value = await this.redis.get(`${PREFIX}:amr:${sid}`);
      if (!value) {
        return null;
      }
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
        ? parsed
        : null;
    } catch {
      throw AuthError.serviceUnavailable();
    }
  }

  private partialKey(token: string, scope: PartialScope): string {
    return `${PREFIX}:partial:${scope}:${hashToken(token)}`;
  }

  private async setExpiring(key: string, expiresAt: Date): Promise<void> {
    const ttl = Math.max(Math.ceil((expiresAt.getTime() - Date.now()) / 1000), 1);
    try {
      await this.redis.set(key, '1', 'EX', ttl);
    } catch {
      throw AuthError.serviceUnavailable();
    }
  }

  private async exists(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1;
    } catch {
      throw AuthError.serviceUnavailable();
    }
  }
}
