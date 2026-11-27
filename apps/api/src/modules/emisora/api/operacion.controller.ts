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

import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { EmisoraOperacionService } from '../application/operacion.service.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';
import {
  CreateOrdenEmisionDto,
  CreatePatrocinioDto,
  CreatePrestamoMifiDto,
  CreatePromoDto,
  CreatePublicacionDto,
  CreateReporteDesplazamientoDto,
  CreateResolucionDto,
  CreateSalidaEquipoDto,
  CreateTransmisionDto,
  CreateViaticoDto,
  OrdenEmisionTransitionDto,
  PatrocinioTransitionDto,
  PrestamoMifiTransitionDto,
  PromoTransitionDto,
  PublicacionTransitionDto,
  TransmisionTransitionDto,
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

const ERRORES_RESOLUCION = [
  ...ERRORES,
  'EMISORA_RESOLUCION_YA_EXISTENTE',
  'EMISORA_INCENTIVO_NO_RESUELTO',
];

const ERRORES_PATROCINIO = [...ERRORES, 'EMISORA_PATROCINIO_SIN_CONTRATO'];
const ERRORES_PROMO = [...ERRORES, 'EMISORA_PROMO_SIN_AUDIO'];
const ERRORES_TRANSMISION = [...ERRORES, 'EMISORA_TRANSMISION_SIN_SOPORTES'];
const ERRORES_MIFI = [...ERRORES, 'EMISORA_MIFI_ANTELACION_INSUFICIENTE'];
const ERRORES_VIATICO = [...ERRORES, 'EMISORA_VIATICO_NO_FUERA_CIUDAD'];

/** RF-03.7: la resolución PDF se descarga por la puerta de Archivos existente. */
@ApiTags('emisora — resoluciones')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/resoluciones')
export class ResolucionesController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreateResolucionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:resolucion:create')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createEmisoraResolucion',
    summary: 'Generar el PDF de la resolución de incentivos',
    description: 'RF-03.7: usa la plantilla existente de Exportaciones; no llama a SIIF.',
  })
  @ApiCreatedResponse({ description: 'Resolución generada y archivada.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:resolucion:create'],
    scope: 'global',
    // `resolucion.generada` ya se publicó en E2; aquí solo se audita la acción.
    auditEvent: 'resolucion.generada',
    errorCodes: ERRORES_RESOLUCION,
  })
  create(
    @Body() body: CreateResolucionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createResolucion(
      { incentivoId: body.incentivoId, periodo: body.periodo },
      actorOf(request),
      clave ?? null,
    );
  }

  @Get(':id/pdf')
  @RequirePermissions('emisora:resolucion:read')
  @ApiOperation({
    operationId: 'getEmisoraResolucionPdf',
    summary: 'Consultar el PDF de una resolución',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Resolución con URL de descarga de Archivos.' })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:resolucion:read'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Consulta de solo lectura sobre el archivo generado.',
    errorCodes: ['PERMISSION_DENIED', 'RESOURCE_NOT_FOUND'],
  })
  getPdf(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getResolucionPdf(id);
  }
}

/** RF-04: el acta de aprobación exige contrato PDF limpio. */
@ApiTags('emisora — patrocinios')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/patrocinios')
export class PatrociniosController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreatePatrocinioDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:patrocinio:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraPatrocinio', summary: 'Proponer un patrocinio' })
  @ApiCreatedResponse({ description: 'Patrocinio propuesto.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:patrocinio:create'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Registro propuesto: se audita internamente sin evento de notificación.',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreatePatrocinioDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createPatrocinio(
      {
        nombre: body.nombre,
        entidad: body.entidad,
        fechaInicio: body.fechaInicio ?? null,
        fechaFin: body.fechaFin ?? null,
        contratoArchivoId: body.contratoArchivoId ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @ApiBody({ type: PatrocinioTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:patrocinio:update')
  @ApiOperation({
    operationId: 'transitionEmisoraPatrocinio',
    summary: 'Aprobar o rechazar un patrocinio',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Estado actualizado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:patrocinio:update'],
    scope: 'global',
    auditEvent: 'patrocinio.aprobado',
    errorCodes: ERRORES_PATROCINIO,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PatrocinioTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionPatrocinio(
      id,
      { to: body.to, contratoArchivoId: body.contratoArchivoId ?? null },
      actorOf(request),
    );
  }
}

/** RF-05: la promo producida exige audio limpio y la orden exige promo producida. */
@ApiTags('emisora — promos')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/promos')
export class PromosController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreatePromoDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:promo:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraPromo', summary: 'Registrar una promo' })
  @ApiCreatedResponse({ description: 'Promo registrada en borrador.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:promo:create'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Registro en borrador: se audita internamente sin evento de notificación.',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreatePromoDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createPromo(
      {
        patrocinioId: body.patrocinioId,
        nombre: body.nombre,
        guion: body.guion ?? null,
        duracionSegundos: body.duracionSegundos,
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @ApiBody({ type: PromoTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:promo:update')
  @ApiOperation({ operationId: 'transitionEmisoraPromo', summary: 'Producir una promo' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Promo producida con audio verificado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:promo:update'],
    scope: 'global',
    auditEvent: 'promo.producida',
    errorCodes: ERRORES_PROMO,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PromoTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionPromo(
      id,
      { to: body.to, audioArchivoId: body.audioArchivoId ?? null },
      actorOf(request),
    );
  }
}

@ApiTags('emisora — órdenes de emisión')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/ordenes-emision')
export class OrdenesEmisionController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreateOrdenEmisionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:patrocinio:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraOrdenEmision', summary: 'Crear una orden de emisión' })
  @ApiCreatedResponse({ description: 'Orden creada en borrador.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:patrocinio:create'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Registro en borrador: se audita internamente sin evento de notificación.',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateOrdenEmisionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createOrden(
      {
        promoId: body.promoId,
        programacionItemId: body.programacionItemId ?? null,
        fechaEmision: body.fechaEmision ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @ApiBody({ type: OrdenEmisionTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:patrocinio:update')
  @ApiOperation({
    operationId: 'transitionEmisoraOrdenEmision',
    summary: 'Programar o emitir la orden',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Estado de la orden actualizado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:patrocinio:update'],
    scope: 'global',
    auditEvent: 'orden.emitida',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: OrdenEmisionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionOrden(id, { to: body.to }, actorOf(request));
  }
}

@ApiTags('emisora — publicaciones')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/publicaciones')
export class PublicacionesController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreatePublicacionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:publicacion:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraPublicacion', summary: 'Programar una publicación' })
  @ApiCreatedResponse({ description: 'Publicación Programada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:publicacion:create'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Registro programado: se audita internamente sin evento de notificación.',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreatePublicacionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createPublicacion(
      {
        promoId: body.promoId ?? null,
        canal: body.canal,
        fechaPublicacion: body.fechaPublicacion,
        archivoId: body.archivoId ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @ApiBody({ type: PublicacionTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:publicacion:update')
  @ApiOperation({
    operationId: 'transitionEmisoraPublicacion',
    summary: 'Marcar una publicación como realizada',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Publicación realizada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:publicacion:update'],
    scope: 'global',
    auditEvent: 'publicacion.realizada',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PublicacionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionPublicacion(
      id,
      { to: body.to, archivoId: body.archivoId ?? null },
      actorOf(request),
    );
  }
}

/** RF-06: autorizar exige salida de equipo y reporte de desplazamiento. */
@ApiTags('emisora — transmisiones')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/transmisiones')
export class TransmisionesController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreateTransmisionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:transmision:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ operationId: 'createEmisoraTransmision', summary: 'Programar una transmisión' })
  @ApiCreatedResponse({ description: 'Transmisión programada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:transmision:create'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Registro programado: se audita internamente sin evento de notificación.',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateTransmisionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createTransmision(
      {
        programacionItemId: body.programacionItemId ?? null,
        fechaTransmision: body.fechaTransmision,
        esFueraCiudad: body.esFueraCiudad,
        destino: body.destino ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @ApiBody({ type: TransmisionTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:transmision:update')
  @ApiOperation({
    operationId: 'transitionEmisoraTransmision',
    summary: 'Autorizar una transmisión',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Transmisión autorizada con soportes verificados.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:transmision:update'],
    scope: 'global',
    auditEvent: 'transmision.autorizada',
    errorCodes: ERRORES_TRANSMISION,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: TransmisionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionTransmision(id, { to: body.to }, actorOf(request));
  }
}

@ApiTags('emisora — salidas de equipo')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/salidas-equipo')
export class SalidasEquipoController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreateSalidaEquipoDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:transmision:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraSalidaEquipo',
    summary: 'Registrar la salida de equipo',
  })
  @ApiCreatedResponse({ description: 'Salida de equipo registrada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:transmision:create'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Registro de soporte: se audita internamente sin evento de notificación.',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateSalidaEquipoDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createSalidaEquipo(
      {
        transmisionId: body.transmisionId,
        equipoId: body.equipoId,
        responsableId: body.responsableId,
        fechaSalida: body.fechaSalida ?? null,
        observaciones: body.observaciones ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }
}

@ApiTags('emisora — desplazamientos')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/reportes-desplazamiento')
export class ReportesDesplazamientoController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreateReporteDesplazamientoDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:transmision:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraReporteDesplazamiento',
    summary: 'Registrar el reporte de desplazamiento',
  })
  @ApiCreatedResponse({ description: 'Reporte de desplazamiento registrado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:transmision:create'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Registro de soporte: se audita internamente sin evento de notificación.',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateReporteDesplazamientoDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createReporteDesplazamiento(
      {
        transmisionId: body.transmisionId,
        conductorId: body.conductorId ?? null,
        vehiculo: body.vehiculo,
        horaSalida: body.horaSalida ?? null,
        horaLlegada: body.horaLlegada ?? null,
        novedades: body.novedades ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }
}

@ApiTags('emisora — préstamos de mifi')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/prestamos-mifi')
export class PrestamosMifiController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreatePrestamoMifiDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:prestamo:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraPrestamoMifi',
    summary: 'Solicitar un préstamo de mifi con dos días de antelación',
  })
  @ApiCreatedResponse({ description: 'Préstamo solicitado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:prestamo:create'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Solicitud registrada: se audita internamente sin evento de notificación.',
    errorCodes: ERRORES_MIFI,
  })
  create(
    @Body() body: CreatePrestamoMifiDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createPrestamoMifi(
      {
        transmisionId: body.transmisionId,
        usuarioId: body.usuarioId,
        observaciones: body.observaciones ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @ApiBody({ type: PrestamoMifiTransitionDto })
  @Patch(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:prestamo:update')
  @ApiOperation({
    operationId: 'transitionEmisoraPrestamoMifi',
    summary: 'Autorizar un préstamo de mifi',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Estado del préstamo actualizado.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:prestamo:update'],
    scope: 'global',
    auditEvent: 'prestamo.autorizado',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PrestamoMifiTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transitionPrestamoMifi(id, { to: body.to }, actorOf(request));
  }
}

@ApiTags('emisora — viáticos')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/viaticos')
export class ViaticosController {
  constructor(@Inject(EmisoraOperacionService) private readonly service: EmisoraOperacionService) {}

  @ApiBody({ type: CreateViaticoDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:viatico:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    operationId: 'createEmisoraViatico',
    summary: 'Solicitar viático solo para transmisiones fuera de la ciudad',
  })
  @ApiCreatedResponse({ description: 'Viático solicitado (sin importes).' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:viatico:create'],
    scope: 'global',
    auditEvent: 'viatico.solicitado',
    errorCodes: ERRORES_VIATICO,
  })
  create(
    @Body() body: CreateViaticoDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createViatico(
      {
        transmisionId: body.transmisionId,
        usuarioId: body.usuarioId,
        soporteArchivoId: body.soporteArchivoId ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }
}
