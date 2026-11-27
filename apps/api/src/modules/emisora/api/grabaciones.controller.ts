import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { ApiQueryParams } from '../../../openapi/api-query-params.js';
import { env } from '../../../shared/config/env.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { EmisoraError } from '../application/emisora-error.js';
import { GrabacionService } from '../application/grabacion.service.js';
import { actorOf, type AuthenticatedRequest } from './actor.js';
import {
  AudioQueryDto,
  CreateGrabacionDto,
  GrabacionTransitionDto,
  RegistrarAsistenciaDto,
  SubirAudioDto,
} from './dto/emisora.dto.js';

const ERRORES = [
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_IN_PROGRESS',
  'SCHEDULE_OVERLAP',
];

const MULTIPART_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: env.EMISORA_MAX_AUDIO_BYTES, files: 1, fields: 4 },
};

@ApiTags('emisora — grabaciones')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/grabaciones')
export class GrabacionesController {
  constructor(@Inject(GrabacionService) private readonly service: GrabacionService) {}

  @ApiBody({ type: CreateGrabacionDto })
  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:grabacion:create')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'createEmisoraGrabacion',
    summary: 'Agendar una sesión de grabación',
    description: 'RF-02.1: puede vincularse a una franja de programación.',
  })
  @ApiCreatedResponse({ description: 'Grabación programada.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:grabacion:create'],
    scope: 'global',
    auditEvent: 'grabacion.programada',
    errorCodes: ERRORES,
  })
  create(
    @Body() body: CreateGrabacionDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(
      {
        programacionItemId: body.programacionItemId ?? null,
        fecha: body.fecha,
        responsableId: body.responsableId ?? null,
      },
      actorOf(request),
      clave ?? null,
    );
  }

  @ApiBody({ type: RegistrarAsistenciaDto })
  @Put(':id/asistencia-cabina')
  @HttpCode(200)
  @RequirePermissions('emisora:asistencia-cabina:create')
  @ApiOperation({
    operationId: 'registrarEmisoraAsistencia',
    summary: 'Registrar la asistencia a cabina de una sesión',
    description: 'RF-02.2: reemplaza la lista anterior en la misma transacción.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Asistencia registrada.' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:asistencia-cabina:create'],
    scope: 'global',
    auditEvent: 'asistencia.registrada',
    errorCodes: ERRORES,
  })
  registrarAsistencia(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RegistrarAsistenciaDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.registrarAsistencia(
      id,
      {
        entries: body.entries.map((entry) => ({
          usuarioId: entry.usuarioId,
          estado: entry.estado,
        })),
      },
      actorOf(request),
    );
  }

  @ApiBody({ type: GrabacionTransitionDto })
  @Post(':id/transitions')
  @HttpCode(200)
  @RequirePermissions('emisora:grabacion:update')
  @ApiOperation({
    operationId: 'transitionEmisoraGrabacion',
    summary: 'Transitionar el estado de la grabación',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Grabación actualizada.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:grabacion:update'],
    scope: 'global',
    auditEvent: 'grabacion.aprobada',
    errorCodes: ERRORES,
  })
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: GrabacionTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.transition(id, body.to, actorOf(request));
  }

  @Get()
  @RequirePermissions('emisora:grabacion:read')
  @ApiOperation({ operationId: 'listEmisoraGrabaciones', summary: 'Listar grabaciones' })
  @ApiOkResponse({ description: 'Sesiones de grabación registradas.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:grabacion:read'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura sobre datos no sensibles.',
    errorCodes: ['PERMISSION_DENIED'],
  })
  list() {
    return this.service.listGrabaciones();
  }
}

@ApiTags('emisora — audios')
@ApiBearerAuth('bearerAuth')
@Controller('emisora/audios')
export class AudiosController {
  constructor(@Inject(GrabacionService) private readonly service: GrabacionService) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('emisora:audio:create')
  @UseInterceptors(FileInterceptor('file', MULTIPART_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sesionGrabacionId', 'tipo', 'duracionSegundos', 'fecha', 'file'],
      properties: {
        sesionGrabacionId: { type: 'string', format: 'uuid' },
        tipo: { type: 'string', enum: ['programa', 'entrevista', 'promo', 'cotidiano'] },
        duracionSegundos: { type: 'integer', minimum: 1 },
        fecha: { type: 'string', format: 'date' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'uploadEmisoraAudio',
    summary: 'Archivar un audio de grabación',
    description:
      'RF-02.4: usa la política opt-in `emisora-audio`; el límite histórico de `/files` no cambia.',
  })
  @ApiCreatedResponse({ description: 'Audio archivado con sus metadatos.' })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiPayloadTooLargeResponse({ type: ProblemDetailsDto })
  @ApiUnsupportedMediaTypeResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:audio:create'],
    scope: 'global',
    auditEvent: 'audio.archivado',
    errorCodes: [
      ...ERRORES,
      'FILE_EMPTY',
      'FILE_TOO_LARGE',
      'FILE_MIME_NOT_ALLOWED',
      'FILE_MIME_MISMATCH',
      'FILE_STORAGE_UNAVAILABLE',
    ],
  })
  upload(
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() body: SubirAudioDto,
    @Headers('idempotency-key') clave: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!archivo) {
      throw EmisoraError.invalidInput('No se recibió ningún archivo en el campo "file".');
    }
    const actor = actorOf(request);
    return this.service.subirAudio(
      {
        sesionGrabacionId: body.sesionGrabacionId,
        tipo: body.tipo,
        duracionSegundos: Number(body.duracionSegundos),
        fecha: body.fecha,
        archivo: {
          buffer: archivo.buffer,
          nombreOriginal: archivo.originalname,
          mime: (archivo.mimetype || '').toLowerCase(),
        },
        request: {
          ip: actor.ip,
          userAgent: actor.userAgent,
          requestId: actor.requestId,
        },
      },
      actor,
      clave ?? null,
    );
  }

  @Get()
  @ApiQueryParams(AudioQueryDto)
  @RequirePermissions('emisora:audio:read')
  @ApiOperation({ operationId: 'listEmisoraAudios', summary: 'Listar audios archivados' })
  @ApiOkResponse({ description: 'Audios con metadatos del archivo.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['emisora:audio:read'],
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Listado de solo lectura sobre metadatos no sensibles.',
    errorCodes: ['PERMISSION_DENIED', 'VALIDATION_FAILED'],
  })
  list(@Query() query: AudioQueryDto) {
    return this.service.listAudio(query.sesionId ?? null);
  }
}
