import { ApiExcludeController } from '@nestjs/swagger';
import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../shared/auth/public.decorator.js';
import { metricsRegistry } from '../shared/observability/metrics.js';

/**
 * Endpoint operativo Prometheus. Se sirve fuera de `/api/v1` (excluido del
 * prefijo global) y no forma parte del contrato público. En producción debe
 * restringirse por red o mTLS (ver runbook de operación).
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  async metrics(@Res() response: Response): Promise<void> {
    response.type(metricsRegistry.contentType).send(await metricsRegistry.metrics());
  }
}
