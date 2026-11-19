import type { ArgumentsHost } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ProblemDetailsFilter } from './problem-details.filter.js';
import type { ProblemDetails } from './problem-details.js';
import { AuditWriteError } from '../audit/audit-write.error.js';

interface MockedResponse {
  status: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
}

function createResponse(): MockedResponse {
  return {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
}

function createHost(request: Partial<Request>, response: MockedResponse): ArgumentsHost {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response as unknown as Response,
    }),
  } as unknown as ArgumentsHost;
}

function capturedBody(response: MockedResponse): ProblemDetails {
  return response.json.mock.calls[0]?.[0] as ProblemDetails;
}

describe('ProblemDetailsFilter', () => {
  const filter = new ProblemDetailsFilter();

  it('traduce 404 al contrato con code, instance y requestId', () => {
    const response = createResponse();
    const request = { method: 'GET', originalUrl: '/api/v1/nope', id: 'req-1' };

    filter.catch(new NotFoundException('No existe'), createHost(request, response));

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');

    const body = capturedBody(response);
    expect(body).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No existe',
      instance: '/api/v1/nope',
      code: 'RESOURCE_NOT_FOUND',
      requestId: 'req-1',
    });
  });

  it('conserva code y errors de una validación', () => {
    const response = createResponse();
    const request = { method: 'POST', originalUrl: '/api/v1/x', id: 'req-2' };

    filter.catch(
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        detail: 'La solicitud contiene campos inválidos.',
        errors: [{ field: 'email', code: 'isEmail', detail: 'email must be an email' }],
      }),
      createHost(request, response),
    );

    const body = capturedBody(response);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors).toEqual([
      { field: 'email', code: 'isEmail', detail: 'email must be an email' },
    ]);
  });

  it('no expone el mensaje interno de un error 500', () => {
    const response = createResponse();
    const request = { method: 'GET', originalUrl: '/api/v1/x', id: 'req-3' };

    filter.catch(new Error('SELECT * FROM usuarios; password=abc'), createHost(request, response));

    const body = capturedBody(response);
    expect(body.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.detail).not.toContain('SELECT');
    expect(body.detail).not.toContain('password');
  });

  it('respeta un code explícito en errores 503', () => {
    const response = createResponse();
    const request = { method: 'GET', originalUrl: '/api/v1/health/ready', id: 'req-4' };

    filter.catch(
      new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        detail: 'Dependencias no disponibles: redis.',
      }),
      createHost(request, response),
    );

    const body = capturedBody(response);
    expect(body.status).toBe(503);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.detail).toContain('redis');
  });

  it('traduce el fallo de escritura de auditoría a 503 (AC-AUD-10)', () => {
    const response = createResponse();
    const request = { method: 'PATCH', originalUrl: '/api/v1/identity/users/x', id: 'req-aud' };

    filter.catch(new AuditWriteError(new Error('insert falló')), createHost(request, response));

    expect(response.status).toHaveBeenCalledWith(503);
    const body = capturedBody(response);
    expect(body.status).toBe(503);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.detail).not.toContain('insert');
  });

  it('usa PERMISSION_DENIED para 403 y un requestId desconocido si falta', () => {
    const response = createResponse();
    const request = { method: 'GET', originalUrl: '/api/v1/x' };

    filter.catch(new ForbiddenException(), createHost(request, response));

    const body = capturedBody(response);
    expect(body.code).toBe('PERMISSION_DENIED');
    expect(body.requestId).toBe('unknown');
  });

  it('emite Retry-After cuando el error de dominio informa el plazo', () => {
    const response = createResponse();
    const request = { method: 'POST', originalUrl: '/api/v1/auth/login', id: 'req-5' };
    const error = new HttpException(
      { code: 'AUTH_RATE_LIMITED', detail: 'Demasiadas solicitudes.' },
      429,
    );
    Object.assign(error, { retryAfterSeconds: 42 });

    filter.catch(error, createHost(request, response));

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });
});
