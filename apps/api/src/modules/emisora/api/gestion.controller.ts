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
import { EmisoraGestionService } from '../application/gestion.service.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';
import {
  ActualizacionTransitionDto,
  CreateActualizacionDto,
  CreateActividadDto,
  CreateArchivoEmisoraDto,
  CreateAsignacionEquipoDto,
  CreateBitacoraDto,
  CreateEquipoDto,
  CreateInversionDto,
  CreateLecturaDto,
  CreateObraDto,
  CreatePagoDerechosDto,
  CreatePermisoSalidaDto,
  CreatePlanillaDto,
  CreateProyeccionDto,
  CreateReporteObraDto,
  CreateSoporteTramiteDto,
  CreateTramiteDto,
  CreateTurnoDto,
  CreateVersionSoftwareDto,
  EquipoEstadoDto,
  InversionTransitionDto,
  LecturaQueryDto,
  ProyeccionTransitionDto,
  TramiteTransitionDto,
  TurnoTransitionDto,
} from './dto/emisora.dto.js';

const ERRORES = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
];
const ERRORES_LECTURA = [...ERRORES, 'EMISORA_LECTURA_DUPLICADA'];
const ERRORES_PLANILLA = [...ERRORES, 'EMISORA_PLANILLA_DUPLICADA'];
const ERRORES_PROYECCION = [...ERRORES, 'EMISORA_PROYECCION_DUPLICADA'];
const ERRORES_EQUIPO = [...ERRORES, 'EMISORA_EQUIPO_DUPLICADO'];
const SOLO_LECTURA = { auditEvent: '-', auditExempt: 'Consulta de solo lectura sobre metadatos.' };

/** RF-07.1: asignación de turnos y confirmación/cierre por el operador. */
@ApiTags('emisora — sede de transmisores')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/turnos')
export class TurnosController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateTurnoDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:turno:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraTurno', summary: 'Asignar un turno de operador' })
  @ApiCreatedResponse({ description: 'Turno asignado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:turno:create'],
    scope: 'global',
    auditEvent: 'turno.asignado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateTurnoDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createTurno(body, actorOf(request), clave ?? null);
  }

  @ApiBody({ type: TurnoTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:turno:update')
  @ApiOperation({ operationId: 'transitionEmisoraTurno', summary: 'Confirmar o cerrar un turno' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Estado del turno actualizado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:turno:update'],
    scope: 'global',
    auditEvent: 'turno.asignado',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: TurnoTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionTurno(id, body, actorOf(request));
  }
}

/** RF-07.2: lectura técnica diaria, única por transmisor y fecha. */
@ApiTags('emisora — sede de transmisores')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/lecturas')
export class LecturasController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateLecturaDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:lectura:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraLectura',
    summary: 'Registrar la lectura técnica del transmisor',
  })
  @ApiCreatedResponse({ description: 'Lectura registrada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:lectura:create'],
    scope: 'global',
    auditEvent: 'lectura.registrada',
    errorCodes: ERRORES_LECTURA,
  })
  create(
    @Body() body: CreateLecturaDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createLectura(body, actorOf(request), clave ?? null);
  }

  @Get()
  @ApiQueryParams(LecturaQueryDto)
  @RequirePermissions('emisora:lectura:read')
  @ApiOperation({ operationId: 'listEmisoraLecturas', summary: 'Listar lecturas técnicas' })
  @ApiOkResponse({ description: 'Lecturas ordenadas por fecha descendente.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:lectura:read'],
    scope: 'global',
    ...SOLO_LECTURA,
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  list(@Query() query: LecturaQueryDto) {
    return this.service.listLecturas(query.transmisorId ?? null);
  }
}

/** RF-07.3: bitácora de sede con actor y request autenticados. */
@ApiTags('emisora — sede de transmisores')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/bitacoras')
export class BitacorasController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateBitacoraDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:bitacora:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraBitacora', summary: 'Registrar un incidente de sede' })
  @ApiCreatedResponse({ description: 'Incidente registrado en la bitácora.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:bitacora:create'],
    scope: 'global',
    auditEvent: 'bitacora.registrada',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateBitacoraDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createBitacora(body, actorOf(request), clave ?? null);
  }
}

/** RF-08.1: catálogo de obras susceptibles de reporte a entidades de derechos. */
@ApiTags('emisora — derechos de autor')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/obras')
export class ObrasController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateObraDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:obra:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraObra', summary: 'Incluir una obra en el catálogo' })
  @ApiCreatedResponse({ description: 'Obra incluida.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:obra:create'],
    scope: 'global',
    auditEvent: 'obra.incluida',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateObraDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createObra(body, actorOf(request), clave ?? null);
  }

  @Get()
  @RequirePermissions('emisora:obra:read')
  @ApiOperation({ operationId: 'listEmisoraObras', summary: 'Listar el catálogo de obras' })
  @ApiOkResponse({ description: 'Obras vigentes del catálogo.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:obra:read'],
    scope: 'global',
    ...SOLO_LECTURA,
    errorCodes: ['PERMISSION_DENIED'],
  })
  list() {
    return this.service.listObras();
  }
}

/** RF-08.2: el PDF se produce en Exportaciones, sin duplicar su evento. */
@ApiTags('emisora — derechos de autor')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/reportes-obras')
export class ReportesObrasController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateReporteObraDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:derecho:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraReporteObra',
    summary: 'Generar el PDF del reporte de obras a SAYCO/ACINPRO',
  })
  @ApiCreatedResponse({ description: 'Reporte generado con URL de descarga autenticada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:derecho:create'],
    scope: 'global',
    auditEvent: 'reporte_obra.generado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateReporteObraDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createReporteObra(body, actorOf(request), clave ?? null);
  }
}

/** RF-08.3: trazabilidad del pago; la emisora no ejecuta pagos ni contabiliza. */
@ApiTags('emisora — derechos de autor')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/pagos-derechos')
export class PagosDerechosController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreatePagoDerechosDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:derecho:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraPagoDerechos',
    summary: 'Registrar el soporte de un pago de derechos',
  })
  @ApiCreatedResponse({ description: 'Pago registrado con soporte PDF verificado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:derecho:create'],
    scope: 'global',
    auditEvent: 'pago.registrado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreatePagoDerechosDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createPago(body, actorOf(request), clave ?? null);
  }
}

/** RF-09.1/09.2: hoja de vida de equipos y cambio de estado. */
@ApiTags('emisora — tecnología e inversión')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/equipos')
export class EquiposController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateEquipoDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:equipo:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraEquipo',
    summary: 'Registrar la hoja de vida de un equipo',
  })
  @ApiCreatedResponse({ description: 'Equipo registrado por número de serie único.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:equipo:create'],
    scope: 'global',
    auditEvent: 'equipo.actualizado',
    errorCodes: ERRORES_EQUIPO,
  })
  create(
    @Body() body: CreateEquipoDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createEquipo(body, actorOf(request), clave ?? null);
  }

  @ApiBody({ type: EquipoEstadoDto })
  @Patch(':id/estado')
  @HttpCode(200)
  @RequirePermissions('emisora:equipo:update')
  @ApiOperation({
    operationId: 'updateEmisoraEquipoEstado',
    summary: 'Cambiar el estado del equipo',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Estado del equipo actualizado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:equipo:update'],
    scope: 'global',
    auditEvent: 'equipo.actualizado',
    errorCodes: ERRORES,
  })
  updateEstado(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EquipoEstadoDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateEquipoEstado(id, body, actorOf(request));
  }
}

/** RF-09.2: solicitud de actualización tecnológica y su decisión. */
@ApiTags('emisora — tecnología e inversión')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/actualizaciones-tecnologicas')
export class ActualizacionesController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateActualizacionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:equipo:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraActualizacion',
    summary: 'Solicitar una actualización tecnológica',
  })
  @ApiCreatedResponse({ description: 'Solicitud registrada en estado solicitada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:equipo:create'],
    scope: 'global',
    auditEvent: 'equipo.actualizado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateActualizacionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createActualizacion(body, actorOf(request), clave ?? null);
  }

  @ApiBody({ type: ActualizacionTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:equipo:update')
  @ApiOperation({
    operationId: 'transitionEmisoraActualizacion',
    summary: 'Aprobar, rechazar o implementar una actualización',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Estado de la actualización actualizado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:equipo:update'],
    scope: 'global',
    auditEvent: 'equipo.actualizado',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ActualizacionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionActualizacion(id, body, actorOf(request));
  }
}

/** RF-09.3: proyección anual única por año. */
@ApiTags('emisora — tecnología e inversión')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/proyecciones')
export class ProyeccionesController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateProyeccionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:proyeccion:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraProyeccion',
    summary: 'Registrar la proyección anual de tecnología',
  })
  @ApiCreatedResponse({ description: 'Proyección registrada en borrador.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:proyeccion:create'],
    scope: 'global',
    auditEvent: 'proyeccion.generada',
    errorCodes: ERRORES_PROYECCION,
  })
  create(
    @Body() body: CreateProyeccionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createProyeccion(body, actorOf(request), clave ?? null);
  }

  @ApiBody({ type: ProyeccionTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:proyeccion:update')
  @ApiOperation({
    operationId: 'transitionEmisoraProyeccion',
    summary: 'Aprobar la proyección anual',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Proyección aprobada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:proyeccion:update'],
    scope: 'global',
    auditEvent: 'proyeccion.generada',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ProyeccionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionProyeccion(id, body, actorOf(request));
  }
}

/** RF-09.3: seguimiento de inversión con referencia de contrato, sin contabilidad. */
@ApiTags('emisora — tecnología e inversión')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/inversiones')
export class InversionesController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateInversionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:inversion:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraInversion',
    summary: 'Registrar el seguimiento de una inversión',
  })
  @ApiCreatedResponse({ description: 'Inversión registrada en estado proyectada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:inversion:create'],
    scope: 'global',
    auditEvent: 'inversion.registrada',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateInversionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createInversion(body, actorOf(request), clave ?? null);
  }

  @ApiBody({ type: InversionTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:inversion:update')
  @ApiOperation({
    operationId: 'transitionEmisoraInversion',
    summary: 'Aprobar, seguir o cerrar una inversión',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Estado de la inversión actualizado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:inversion:update'],
    scope: 'global',
    auditEvent: 'inversion.registrada',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: InversionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionInversion(id, body, actorOf(request));
  }
}

/** RF-09.4: versiones de software y asignaciones como registros de trazabilidad. */
@ApiTags('emisora — tecnología e inversión')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/versiones-software')
export class VersionesSoftwareController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateVersionSoftwareDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:equipo:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraVersionSoftware',
    summary: 'Registrar una versión de software instalada',
  })
  @ApiCreatedResponse({ description: 'Versión registrada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:equipo:create'],
    scope: 'global',
    auditEvent: 'equipo.actualizado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateVersionSoftwareDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createVersionSoftware(body, actorOf(request), clave ?? null);
  }
}

@ApiTags('emisora — tecnología e inversión')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/asignaciones-equipo')
export class AsignacionesEquipoController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateAsignacionEquipoDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:equipo:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraAsignacionEquipo',
    summary: 'Registrar la asignación de un equipo',
  })
  @ApiCreatedResponse({ description: 'Asignación registrada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:equipo:create'],
    scope: 'global',
    auditEvent: 'equipo.actualizado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateAsignacionEquipoDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createAsignacion(body, actorOf(request), clave ?? null);
  }
}

/** RF-10.1: agenda cultural de la emisora. */
@ApiTags('emisora — oferta cultural y trámites')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/actividades')
export class ActividadesController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateActividadDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:actividad:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraActividad',
    summary: 'Registrar una actividad cultural',
  })
  @ApiCreatedResponse({ description: 'Actividad registrada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:actividad:create'],
    scope: 'global',
    auditEvent: 'actividad.registrada',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateActividadDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createActividad(body, actorOf(request), clave ?? null);
  }

  @Get()
  @RequirePermissions('emisora:actividad:read')
  @ApiOperation({ operationId: 'listEmisoraActividades', summary: 'Listar actividades culturales' })
  @ApiOkResponse({ description: 'Actividades ordenadas por fecha descendente.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:actividad:read'],
    scope: 'global',
    ...SOLO_LECTURA,
    errorCodes: ['PERMISSION_DENIED'],
  })
  list() {
    return this.service.listActividades();
  }
}

/** RF-10.2: el oficio de salida se genera con la plantilla existente. */
@ApiTags('emisora — oferta cultural y trámites')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/permisos-salida')
export class PermisosSalidaController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreatePermisoSalidaDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:permiso-salida:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraPermisoSalida',
    summary: 'Emitir el oficio de permiso de salida',
  })
  @ApiCreatedResponse({ description: 'Permiso emitido con oficio PDF.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:permiso-salida:create'],
    scope: 'global',
    auditEvent: 'permiso.emitido',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreatePermisoSalidaDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createPermiso(body, actorOf(request), clave ?? null);
  }
}

/** RF-11.1: el archivo de emisora guarda metadatos verificados contra Archivos. */
@ApiTags('emisora — emisión y archivo')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/archivos-emisora')
export class ArchivosEmisoraController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateArchivoEmisoraDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:archivo-emisora:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraArchivo',
    summary: 'Archivar un audio, acta, formato o imagen de la emisora',
  })
  @ApiCreatedResponse({ description: 'Metadatos del archivo registrados.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:archivo-emisora:create'],
    scope: 'global',
    auditEvent: 'audio.archivado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateArchivoEmisoraDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createArchivo(body, actorOf(request), clave ?? null);
  }
}

/** RF-11.2: planilla única por fecha con PDF generado por Exportaciones. */
@ApiTags('emisora — emisión y archivo')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/planillas-emision')
export class PlanillasController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreatePlanillaDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:planilla:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraPlanilla',
    summary: 'Generar y registrar la planilla de emisión',
  })
  @ApiCreatedResponse({ description: 'Planilla registrada con URL de descarga autenticada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:planilla:create'],
    scope: 'global',
    auditEvent: 'planilla.registrada',
    errorCodes: ERRORES_PLANILLA,
  })
  create(
    @Body() body: CreatePlanillaDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createPlanilla(body, actorOf(request), clave ?? null);
  }
}

/** RF-12.1/12.2: trámites externos con soportes limpios y ciclo de estado. */
@ApiTags('emisora — oferta cultural y trámites')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/tramites')
export class TramitesController {
  constructor(@Inject(EmisoraGestionService) private readonly service: EmisoraGestionService) {}

  @ApiBody({ type: CreateTramiteDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:tramite:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraTramite', summary: 'Radicar un trámite externo' })
  @ApiCreatedResponse({ description: 'Trámite radicado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:tramite:create'],
    scope: 'global',
    auditEvent: 'tramite.radicado',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateTramiteDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createTramite(body, actorOf(request), clave ?? null);
  }

  @Get()
  @RequirePermissions('emisora:tramite:read')
  @ApiOperation({ operationId: 'listEmisoraTramites', summary: 'Listar trámites externos' })
  @ApiOkResponse({ description: 'Trámites ordenados por fecha de radicación.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:tramite:read'],
    scope: 'global',
    ...SOLO_LECTURA,
    errorCodes: ['PERMISSION_DENIED'],
  })
  list() {
    return this.service.listTramites();
  }

  @ApiBody({ type: CreateSoporteTramiteDto })
  @Post(':id/soportes')
  @HttpCode(201)
  @RequirePermissions('emisora:tramite:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraSoporteTramite',
    summary: 'Adjuntar un soporte PDF a un trámite',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiCreatedResponse({ description: 'Soporte adjuntado tras verificar el archivo.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:tramite:create'],
    scope: 'global',
    auditEvent: 'soporte.adjuntado',
    errorCodes: ERRORES,
  })
  createSoporte(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateSoporteTramiteDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createSoporte(id, body, actorOf(request), clave ?? null);
  }

  @ApiBody({ type: TramiteTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:tramite:update')
  @ApiOperation({ operationId: 'transitionEmisoraTramite', summary: 'Avanzar el trámite externo' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Estado del trámite actualizado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:tramite:update'],
    scope: 'global',
    auditEvent: 'tramite.radicado',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: TramiteTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionTramite(id, body, actorOf(request));
  }
}
