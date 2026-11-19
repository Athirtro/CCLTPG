export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  /** Número de eventos contabilizados en la ventana actual. */
  count: number;
}

export abstract class RateLimiter {
  /** Incrementa el contador y devuelve si la solicitud está permitida. */
  abstract hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  /** Reinicia el contador (p. ej. tras un login correcto). */
  abstract reset(key: string): Promise<void>;
}
