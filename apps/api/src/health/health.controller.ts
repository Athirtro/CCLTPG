import {
  Controller,
  Get,
  Header,
  HttpStatus,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../shared/auth/public.decorator.js';
import { ProblemDetailsDto } from '../shared/errors/problem-details.dto.js';
import { getRequestId } from '../shared/http/request-id.js';
import { ApiContract } from '../shared/openapi/contract-metadata.js';
import { LivenessResponseDto } from './dto/liveness-response.dto.js';
import { ReadinessResponseDto } from './dto/readiness-response.dto.js';
import { HealthService, type ReadinessReport } from './health.service.js';

@ApiTags('salud')
@ApiHeader({
  name: 'X-Request-Id',
  required: false,
  description: 'UUIDv7 de correlación; si falta o es inválido, la API genera uno.',
})
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get('live')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    operationId: 'healthLive',
    summary: 'Liveness del proceso',
    description: 'Confirma que el proceso de la API está vivo. No consulta dependencias.',
  })
  @ApiOkResponse({
    description: 'Proceso vivo.',
    type: LivenessResponseDto,
  })
  @ApiContract({
    access: 'public',
    scope: 'global',
    auditEvent: '-',
    errorCodes: [],
  })
  live(@Req() request: Request): Record<string, unknown> {
    return { ...this.health.liveness(), requestId: getRequestId(request) };
  }

  @Public()
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    operationId: 'healthReady',
    summary: 'Readiness de dependencias',
    description: 'Comprueba PostgreSQL y Redis con un tiempo límite configurable.',
  })
  @ApiOkResponse({
    description: 'Dependencias disponibles.',
    type: ReadinessResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Alguna dependencia no está disponible.',
    type: ProblemDetailsDto,
  })
  @ApiContract({
    access: 'public',
    scope: 'global',
    auditEvent: '-',
    errorCodes: ['SERVICE_UNAVAILABLE'],
  })
  async ready(@Req() request: Request): Promise<ReadinessReport & { requestId: string | null }> {
    const report = await this.health.readiness();

    if (report.status !== 'ok') {
      const down = Object.entries(report.checks)
        .filter(([, check]) => check.status === 'down')
        .map(([name]) => name);

      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        detail: `Dependencias no disponibles: ${down.join(', ')}.`,
      });
    }

    return { ...report, requestId: getRequestId(request) };
  }
}
