import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiQueryParams } from '../../../openapi/api-query-params.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { ConvocatoriaService } from '../application/convocatoria.service.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';
import {
  CreateComiteDto,
  CreateConvocatoriaDto,
  CreateInformeDto,
  CreateProyectoDto,
  NotifyRealizadorDto,
  RejillaQueryDto,
  RejillaTransitionDto,
  UpdateIncentivoDto,
} from './dto/emisora.dto.js';

const ERRORES = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
  'CONVOCATORIA_DUPLICADA',
  'CONVOCATORIA_CERRADA',
  'REJILLA_SIN_ACTA',
  'EMISORA_FUERA_VENTANA_INFORME',
];

const CABECERA_IDEMPOTENCIA = ApiHeader({
  name: 'Idempotency-Key',
  required: true,
  description: 'Clave única por usuario y operación; TTL 24 h.',
});

@ApiTags('emisora — convocatorias')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/convocatorias')
export class ConvocatoriasController {
  constructor(@Inject(ConvocatoriaService) private readonly service: ConvocatoriaService) {}

  @ApiBody({ type: CreateConvocatoriaDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:convocatoria:create')
  @CABECERA_IDEMPOTENCIA
  @ApiOperation({
    operationId: 'createEmisoraConvocatoria',
    summary: 'Abrir la convocatoria anual',
    description: 'RF-03.1: apertura en enero y cierre derivado 21 días después.',
  })
  @ApiCreatedResponse({ description: 'Convocatoria abierta.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:convocatoria:create'],
    scope: 'global',
    auditEvent: 'convocatoria.abierta',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateConvocatoriaDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createConvocatoria(
      {
        anio: Number(body.anio),
        fechaApertura: body.fechaApertura,
        basesArchivoId: body.basesArchivoId ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @Get()
  @RequirePermissions('emisora:convocatoria:read')
  @ApiOperation({
    operationId: 'listEmisoraConvocatorias',
    summary: 'Listar convocatorias de la emisora',
  })
  @ApiOkResponse({ description: 'Convocatorias ordenadas por año descendente.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:convocatoria:read'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura sobre datos no sensibles.',
    errorCodes: ['PERMISSION_DENIED'],
  })
  list() {
    return this.service.listConvocatorias();
  }
}

@ApiTags('emisora — proyectos')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/proyectos')
export class ProyectosController {
  constructor(@Inject(ConvocatoriaService) private readonly service: ConvocatoriaService) {}

  @ApiBody({ type: CreateProyectoDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:proyecto:create')
  @CABECERA_IDEMPOTENCIA
  @ApiOperation({
    operationId: 'createEmisoraProyecto',
    summary: 'Recibir un proyecto en convocatoria abierta',
    description: 'RF-03.2: PII del realizador cifrada y formato oficial adjunto.',
  })
  @ApiCreatedResponse({ description: 'Proyecto recibido.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:proyecto:create'],
    scope: 'global',
    auditEvent: 'proyecto.recibido',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateProyectoDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createProyecto(
      {
        convocatoriaId: body.convocatoriaId,
        titulo: body.titulo,
        archivoId: body.archivoId,
        fechaRecepcion: body.fechaRecepcion,
        observaciones: body.observaciones ?? null,
        programaId: body.programaId ?? null,
        formadorId: body.formadorId ?? null,
        realizador: {
          usuarioId: body.realizador.usuarioId ?? null,
          nombres: body.realizador.nombres,
          apellidos: body.realizador.apellidos,
          tipoDocumento: body.realizador.tipoDocumento,
          numeroDocumento: body.realizador.numeroDocumento,
          contacto: body.realizador.contacto ?? null,
          municipio: body.realizador.municipio ?? null,
          fechaNacimiento: body.realizador.fechaNacimiento ?? null,
          consentimientoAceptado: body.realizador.consentimientoAceptado,
        },
      },
      actorOf(request),
      clave ?? null,
    );
  }
}

@ApiTags('emisora — realizadores')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/realizadores')
export class RealizadoresController {
  constructor(@Inject(ConvocatoriaService) private readonly service: ConvocatoriaService) {}

  @ApiBody({ type: NotifyRealizadorDto })
  @Patch(':id')
  @HttpCode(200)
  @RequirePermissions('emisora:realizador:update_own')
  @ApiOperation({
    operationId: 'notifyEmisoraRealizador',
    summary: 'Notificar al realizador sobre el estado de su proyecto',
    description: 'RF-03.4: ámbito own; un realizador ajeno responde 404.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Datos de contacto actualizados.' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:realizador:update_own'],
    scope: 'own',
    auditEvent: 'realizador.notificado',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'VALIDATION_FAILED'],
  })
  notify(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: NotifyRealizadorDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.notifyRealizador(
      id,
      { contacto: body.contacto ?? null, municipio: body.municipio ?? null },
      actorOf(request),
    );
  }
}

@ApiTags('emisora — comité')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/comites')
export class ComitesController {
  constructor(@Inject(ConvocatoriaService) private readonly service: ConvocatoriaService) {}

  @ApiBody({ type: CreateComiteDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:comite:create')
  @CABECERA_IDEMPOTENCIA
  @ApiOperation({
    operationId: 'createEmisoraComite',
    summary: 'Registrar el acta del comité de programación',
    description: 'RF-03.3: el acta es requisito para aprobar la rejilla.',
  })
  @ApiCreatedResponse({ description: 'Comité registrado.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:comite:create'],
    scope: 'global',
    auditEvent: 'comite.registrado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateComiteDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createComite(
      {
        convocatoriaId: body.convocatoriaId,
        fecha: body.fecha,
        actaArchivoId: body.actaArchivoId,
        integrantes: body.integrantes,
        conclusiones: body.conclusiones ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }
}

@ApiTags('emisora — rejilla anual')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/rejilla-anual')
export class RejillaController {
  constructor(@Inject(ConvocatoriaService) private readonly service: ConvocatoriaService) {}

  @Get()
  @ApiQueryParams(RejillaQueryDto)
  @RequirePermissions('emisora:rejilla:read')
  @ApiOperation({ operationId: 'getEmisoraRejillaAnual', summary: 'Consultar la rejilla anual' })
  @ApiOkResponse({ description: 'Rejilla y sus franjas.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:rejilla:read'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Consulta de solo lectura sobre datos no sensibles.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  get(@Query() query: RejillaQueryDto) {
    return this.service.getRejillaAnio(Number(query.anio));
  }

  @ApiBody({ type: RejillaTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:rejilla:update')
  @ApiOperation({
    operationId: 'transitionEmisoraRejilla',
    summary: 'Aprobar la rejilla anual',
    description: 'RF-03.3: exige acta de comité adjunta.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Rejilla aprobada.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:rejilla:update'],
    scope: 'global',
    auditEvent: 'rejilla.aprobada',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RejillaTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionRejilla(id, body.to, actorOf(request));
  }
}

@ApiTags('emisora — informes')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/informes')
export class InformesController {
  constructor(@Inject(ConvocatoriaService) private readonly service: ConvocatoriaService) {}

  @ApiBody({ type: CreateInformeDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:informe:create')
  @CABECERA_IDEMPOTENCIA
  @ApiOperation({
    operationId: 'createEmisoraInforme',
    summary: 'Recibir el informe del realizador',
    description: 'RF-03.5: solo en octubre o noviembre; crea el incentivo asociado.',
  })
  @ApiCreatedResponse({ description: 'Informe recibido.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:informe:create'],
    scope: 'global',
    auditEvent: 'informe.recibido',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateInformeDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createInforme(
      {
        proyectoId: body.proyectoId,
        fechaInforme: body.fechaInforme,
        archivoId: body.archivoId,
        observaciones: body.observaciones ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }
}

@ApiTags('emisora — incentivos')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/incentivos')
export class IncentivosController {
  constructor(@Inject(ConvocatoriaService) private readonly service: ConvocatoriaService) {}

  @Get()
  @RequirePermissions('emisora:incentivo:read')
  @ApiOperation({ operationId: 'listEmisoraIncentivos', summary: 'Listar incentivos' })
  @ApiOkResponse({ description: 'Incentivos con su estado y calificación.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:incentivo:read'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura sobre datos no sensibles.',
    errorCodes: ['PERMISSION_DENIED'],
  })
  list() {
    return this.service.listIncentivos();
  }

  @ApiBody({ type: UpdateIncentivoDto })
  @Patch(':id')
  @HttpCode(200)
  @RequirePermissions('emisora:incentivo:update')
  @ApiOperation({
    operationId: 'updateEmisoraIncentivo',
    summary: 'Calificar o resolver un incentivo',
    description: 'RF-03.6: calificado → asignado → resuelto | solicitud_cdp.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Incentivo actualizado.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:incentivo:update'],
    scope: 'global',
    auditEvent: 'incentivo.asignado',
    errorCodes: ERRORES,
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateIncentivoDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateIncentivo(
      id,
      {
        to: body.to,
        calificacion: body.calificacion ?? null,
        referenciaCdp: body.referenciaCdp ?? null,
      },
      actorOf(request),
    );
  }
}
