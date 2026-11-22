import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';

import { env } from '../../../shared/config/env.js';
import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import { RequirePermissions } from '../../../shared/auth/auth-metadata.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { buildRequestContext } from '../../../shared/http/request-context.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { FileService } from '../application/file.service.js';
import { FileError, FILE_ERRORS } from '../application/file-error.js';
import { FileResponseDto } from './dto/file.dto.js';

const MULTIPART_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: env.MAX_FILE_BYTES, files: 1, fields: 4 },
};

@ApiTags('archivos')
@ApiBearerAuth('bearerAuth')
@Controller('files')
export class FilesController {
  constructor(@Inject(FileService) private readonly files: FileService) {}

  @Post()
  @RequirePermissions('files:document:create')
  @UseInterceptors(FileInterceptor('file', MULTIPART_OPTIONS))
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única por usuario y operación; TTL 24 h.',
  })
  @ApiOperation({
    operationId: 'uploadFile',
    summary: 'Carga segura de un archivo',
    description:
      '10 MB máximo, lista blanca de MIME, verificación por bytes mágicos, escaneo y cuarentena. `Idempotency-Key` obligatoria.',
  })
  @ApiCreatedResponse({ type: FileResponseDto })
  @ApiPayloadTooLargeResponse({ type: ProblemDetailsDto })
  @ApiUnsupportedMediaTypeResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['files:document:create'],
    scope: 'global',
    auditEvent: 'archivo.subido',
    errorCodes: [
      'IDEMPOTENCY_KEY_REQUIRED',
      'IDEMPOTENCY_KEY_REUSED',
      'IDEMPOTENCY_IN_PROGRESS',
      'FILE_EMPTY',
      'FILE_TOO_LARGE',
      'FILE_MIME_NOT_ALLOWED',
      'FILE_MIME_MISMATCH',
      'FILE_STORAGE_UNAVAILABLE',
      'PERMISSION_DENIED',
      'VALIDATION_FAILED',
    ],
  })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request & { auth?: AuthPrincipal },
  ): Promise<FileResponseDto> {
    const actor = request.auth!;

    if (!file) {
      throw new FileError(
        FILE_ERRORS.empty,
        400,
        'No se recibió ningún archivo en el campo "file".',
      );
    }

    return this.files.upload({
      buffer: file.buffer,
      nombreOriginal: file.originalname,
      mime: (file.mimetype || '').toLowerCase(),
      idempotencyKey: idempotencyKey ?? null,
      actor: {
        userId: actor.userId,
        actorProfile: actor.actorProfile,
        permissions: actor.permissions,
      },
      context: buildRequestContext(request),
    });
  }

  @Get(':id/download')
  @RequirePermissions('files:document:read', 'files:document:read_own')
  @ApiOperation({
    operationId: 'downloadFile',
    summary: 'Descarga autorizada de un archivo',
    description:
      'Permiso global o propio. Un archivo ajeno, cuarentenado o inexistente responde 404. La descarga se audita antes de enviar el contenido.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Contenido binario del archivo.' })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'permission',
    permission: ['files:document:read', 'files:document:read_own'],
    scope: 'mixed',
    auditEvent: 'archivo.descargado',
    errorCodes: ['RESOURCE_NOT_FOUND', 'PERMISSION_DENIED', 'FILE_STORAGE_UNAVAILABLE'],
  })
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request & { auth?: AuthPrincipal },
    @Res() response: Response,
  ): Promise<void> {
    const actor = request.auth!;
    const result = await this.files.download({
      id,
      actor: {
        userId: actor.userId,
        actorProfile: actor.actorProfile,
        permissions: actor.permissions,
      },
      context: buildRequestContext(request),
    });

    response.setHeader('Content-Type', result.record.mime);
    response.setHeader('Content-Length', String(result.body.length));
    response.setHeader('Content-Disposition', contentDisposition(result.record.nombreOriginal));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.end(result.body);
  }
}

function contentDisposition(nombre: string): string {
  const fallback = nombre.replace(/[^\x20-\x7e]/gu, '_').replace(/["\\]/gu, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}
