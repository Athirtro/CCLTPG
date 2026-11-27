/**
 * RNF-06 — compuerta manual de carga de la Emisora R.A.C.
 *
 * Mide la consulta de programación diaria con 200 usuarios concurrentes.
 * No entra en el CI estándar: se ejecuta a mano según docs/runbook/emisora.md.
 *
 * Contrato probado: GET {K6_BASE_URL}{K6_API_PREFIX}/emisora/programacion-diaria
 * (operationId `getEmisoraProgramacion`, permiso `emisora:programacion:read`).
 *
 * El login se hace una sola vez en `setup()` y el `accessToken` se comparte con
 * todos los VUs. Así no se consumen los límites de `login:email` (5/15 min) ni
 * los de `login:ip` (10/15 min) antes de medir. Para que el límite `api:user`
 * (300/min por usuario) no transforme la medición en una avalancha de 429, el
 * entorno de carga debe iniciar la API con `AUTH_RATE_LIMIT_ENABLED=false`; ver
 * el runbook. La compuerta mide latencia y errores 5xx del camino de lectura,
 * no el correcto funcionamiento del limitador (ese se prueba en C2).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = (__ENV.K6_BASE_URL || 'http://localhost:3000').replace(/\/$/u, '');
const API_PREFIX = (__ENV.K6_API_PREFIX || '/api/v1').replace(/\/$/u, '');
const API_URL = `${BASE_URL}${API_PREFIX.startsWith('/') ? '' : '/'}${API_PREFIX}`;
const EMAIL = __ENV.K6_EMAIL || 'e2e-jefe-emisora@ccltpg.org';
const FECHA = __ENV.K6_FECHA || '2026-01-19';
const VUS = Number(__ENV.K6_VUS || 200);

const errores5xx = new Counter('errores_5xx');

export const options = {
  scenarios: {
    programacion_diaria: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS },
        { duration: '1m', target: VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // RNF-06: p95 < 4 s, menos del 1 % de peticiones fallidas y cero 5xx.
    'http_req_duration{name:programacion-diaria}': ['p(95)<4000'],
    http_req_failed: ['rate<0.01'],
    errores_5xx: ['count<1'],
  },
};

/**
 * Obtiene un token válido antes de iniciar la carga. La contraseña nunca vive
 * en el repositorio: se lee exclusivamente de `K6_PASSWORD`.
 */
export function setup() {
  if (!__ENV.K6_PASSWORD) {
    throw new Error('Defina K6_PASSWORD en el entorno; el script no incluye credenciales.');
  }
  if (!Number.isInteger(VUS) || VUS < 1) {
    throw new Error('K6_VUS debe ser un entero positivo.');
  }

  const respuesta = http.post(
    `${API_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: __ENV.K6_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login-setup' } },
  );

  let cuerpo;
  try {
    cuerpo = JSON.parse(respuesta.body);
  } catch {
    throw new Error(`Login de setup devolvió una respuesta no JSON (${respuesta.status}).`);
  }

  const valido = check(respuesta, {
    'login de setup responde 200': (r) => r.status === 200,
    'login de setup queda autenticado': () => cuerpo.status === 'authenticated',
    'login de setup entrega accessToken': () => typeof cuerpo.accessToken === 'string',
  });
  if (!valido || typeof cuerpo.accessToken !== 'string') {
    throw new Error(
      `No se pudo iniciar sesión como ${EMAIL}. Revise K6_PASSWORD, MFA y el estado de la cuenta.`,
    );
  }

  return { accessToken: cuerpo.accessToken, tokenType: cuerpo.tokenType || 'Bearer', fecha: FECHA };
}

export default function (datos) {
  const respuesta = http.get(
    `${API_URL}/emisora/programacion-diaria?fecha=${encodeURIComponent(datos.fecha)}`,
    {
      headers: { Authorization: `${datos.tokenType} ${datos.accessToken}` },
      tags: { name: 'programacion-diaria' },
    },
  );

  if (respuesta.status >= 500) {
    errores5xx.add(1);
  }

  check(respuesta, {
    'programación diaria responde 200': (r) => r.status === 200,
    'sin errores 5xx': (r) => r.status < 500,
    'responde una programación': (r) => {
      try {
        return typeof JSON.parse(r.body) === 'object';
      } catch {
        return false;
      }
    },
  });

  // Pensamiento de 1 s entre consultas: simula una persona, no un bombardeo.
  sleep(1);
}
