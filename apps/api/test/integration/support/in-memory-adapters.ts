import { randomBytes } from 'node:crypto';

import type { PartialScope } from '../../../src/shared/auth/auth-metadata.js';
import type {
  PartialTokenRecord,
  SessionCache,
} from '../../../src/modules/identity/application/ports/session-cache.js';
import type {
  RateLimiter,
  RateLimitResult,
} from '../../../src/modules/identity/application/ports/rate-limiter.js';

interface Entry {
  value: string;
  expiresAt: number;
}

/** Implementación en memoria del caché de sesión para pruebas de integración. */
export class InMemorySessionCache implements SessionCache {
  private readonly values = new Map<string, Entry>();

  /** Tokens parciales en claro para poder inspeccionarlos desde la prueba. */
  readonly partials = new Map<
    string,
    { usuarioId: string; scope: PartialScope; attempts: number }
  >();

  issuePartial(usuarioId: string, scope: PartialScope, ttlSeconds: number): Promise<string> {
    const token = randomBytes(24).toString('base64url');
    this.partials.set(this.partialKey(token, scope), { usuarioId, scope, attempts: 0 });
    this.set(this.partialKey(token, scope), usuarioId, ttlSeconds);
    return Promise.resolve(token);
  }

  getPartial(token: string, scope: PartialScope): Promise<PartialTokenRecord | null> {
    const entry = this.get(this.partialKey(token, scope));
    if (!entry) {
      return Promise.resolve(null);
    }
    const record = this.partials.get(this.partialKey(token, scope));
    return Promise.resolve({ usuarioId: entry, attempts: record?.attempts ?? 0 });
  }

  incrementPartialAttempts(token: string, scope: PartialScope): Promise<number> {
    const key = this.partialKey(token, scope);
    const record = this.partials.get(key);
    if (!record) {
      return Promise.resolve(0);
    }
    record.attempts += 1;
    return Promise.resolve(record.attempts);
  }

  invalidatePartial(token: string, scope: PartialScope): Promise<void> {
    this.partials.delete(this.partialKey(token, scope));
    this.values.delete(this.partialKey(token, scope));
    return Promise.resolve();
  }

  denySid(sid: string, expiresAt: Date): Promise<void> {
    this.set(`sid:${sid}`, '1', this.ttl(expiresAt));
    return Promise.resolve();
  }

  isSidDenied(sid: string): Promise<boolean> {
    return Promise.resolve(this.get(`sid:${sid}`) !== null);
  }

  denyJti(jti: string, expiresAt: Date): Promise<void> {
    this.set(`jti:${jti}`, '1', this.ttl(expiresAt));
    return Promise.resolve();
  }

  isJtiDenied(jti: string): Promise<boolean> {
    return Promise.resolve(this.get(`jti:${jti}`) !== null);
  }

  setSessionAmr(sid: string, amr: readonly string[], expiresAt: Date): Promise<void> {
    this.set(`amr:${sid}`, JSON.stringify([...amr]), this.ttl(expiresAt));
    return Promise.resolve();
  }

  getSessionAmr(sid: string): Promise<string[] | null> {
    const value = this.get(`amr:${sid}`);
    return Promise.resolve(value ? (JSON.parse(value) as string[]) : null);
  }

  private partialKey(token: string, scope: PartialScope): string {
    return `partial:${scope}:${token}`;
  }

  private ttl(expiresAt: Date): number {
    return Math.max(Math.ceil((expiresAt.getTime() - Date.now()) / 1000), 1);
  }

  private set(key: string, value: string, ttlSeconds: number): void {
    this.values.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  private get(key: string): string | null {
    const entry = this.values.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }
}

/** Limitador determinista: ventana fija en memoria. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  /**
   * `enforceLimits: false` sigue contando (para ejercitar el bloqueo por
   * contraseña) pero nunca deniega por volumen entre pruebas.
   */
  constructor(private readonly enforceLimits = true) {}

  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const current = this.counters.get(key);

    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return Promise.resolve({
        allowed: !this.enforceLimits || 1 <= limit,
        retryAfterSeconds: windowSeconds,
        count: 1,
      });
    }

    current.count += 1;
    return Promise.resolve({
      allowed: !this.enforceLimits || current.count <= limit,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
      count: current.count,
    });
  }

  reset(key: string): Promise<void> {
    this.counters.delete(key);
    return Promise.resolve();
  }
}
