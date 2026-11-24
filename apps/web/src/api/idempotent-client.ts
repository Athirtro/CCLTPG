import { apiClient } from '../api/client';

/** Respuesta cruda de una llamada al cliente API. */
export type ApiRawResult = {
  data: unknown;
  error: unknown;
  response: { status?: number } | null;
};

/**
 * Ejecuta un POST con cabecera opcional `Idempotency-Key`.
 *
 * openapi-fetch no declara cabeceras personalizadas en los tipos generados. Se
 * hace un type assertion controlado sobre el cliente (vía `unknown`, nunca `any`)
 * para poder pasar `path` como `string` y la cabecera `Idempotency-Key` sin que el
 * lint se queje de `any`.
 */
export async function postWithIdempotency(
  path: string,
  options: { body: unknown; idempotencyKey?: string },
): Promise<ApiRawResult> {
  const headers: Record<string, string> = {};
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const result = await (
    apiClient as unknown as {
      POST: (
        p: string,
        opts: { body: unknown; headers?: Record<string, string> },
      ) => Promise<{ data: unknown; error: unknown; response: { status: number } }>;
    }
  ).POST(path, { body: options.body, headers });

  return {
    data: result.data,
    error: result.error ?? null,
    response: result.response ? { status: result.response.status } : null,
  };
}
