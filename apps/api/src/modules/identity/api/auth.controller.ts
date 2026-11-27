import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiBody,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type { AuthPrincipal } from '../../../shared/auth/auth-principal.js';
import {
  AllowAnonymous,
  AllowPasswordChange,
  AuthenticatedOnly,
  PartialScopes,
} from '../../../shared/auth/auth-metadata.js';
import { Public } from '../../../shared/auth/public.decorator.js';
import { ProblemDetailsDto } from '../../../shared/errors/problem-details.dto.js';
import { buildRequestContext } from '../../../shared/http/request-context.js';
import { ApiContract } from '../../../shared/openapi/contract-metadata.js';
import { AuthError } from '../application/auth-error.js';
import { LoginService } from '../application/login.service.js';
import { MfaService } from '../application/mfa.service.js';
import { PasswordService } from '../application/password.service.js';
import { SessionService } from '../application/session.service.js';
import { CSRF_COOKIE, REFRESH_COOKIE, parseCookie, setSessionCookies } from './auth-cookies.js';
import { NoStore, OkCode, toLoginBody, toTokenBody } from './auth-response.js';
import {
  ChangePasswordDto,
  LoginDto,
  MfaConfirmDto,
  MfaEnrollDto,
  MfaVerifyDto,
  RecoveryCodesDto,
} from './dto/auth.dto.js';
import {
  LoginResponseDto,
  MfaEnrollResponseDto,
  RecoveryCodesResponseDto,
} from './dto/auth-response.dto.js';
import { CsrfService } from './csrf.service.js';

type AuthRequest = Request & {
  auth?: AuthPrincipal;
  authPartial?: { usuarioId: string; token: string };
};

@ApiTags('autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LoginService) private readonly loginService: LoginService,
    @Inject(MfaService) private readonly mfaService: MfaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CsrfService) private readonly csrf: CsrfService,
  ) {}

  @ApiBody({ type: LoginDto })
  @Post('login')
  @Public()
  @OkCode()
  @NoStore()
  @ApiOperation({
    operationId: 'login',
    summary: 'Inicio de sesión',
    description:
      'Credenciales correctas pueden terminar en sesión completa o en un estado parcial (cambio de contraseña, inscripción o verificación MFA).',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'public',
    scope: 'global',
    auditEvent: 'sesion.iniciada',
    errorCodes: ['AUTH_INVALID_CREDENTIALS', 'AUTH_RATE_LIMITED', 'SERVICE_UNAVAILABLE'],
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const result = await this.loginService.login(
      dto.email,
      dto.password,
      buildRequestContext(request),
    );

    if (result.session) {
      setSessionCookies(response, result.session);
    }

    return toLoginBody(result);
  }

  @ApiBody({ type: MfaVerifyDto })
  @Post('mfa/verify')
  @PartialScopes('mfa_verify')
  @OkCode()
  @NoStore()
  @ApiOperation({
    operationId: 'verifyMfa',
    summary: 'Verificación MFA con token parcial',
    description:
      'Acepta TOTP o un código de recuperación. Al quinto intento invalida el token parcial y responde 429 `AUTH_MFA_ATTEMPTS_EXCEEDED`.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'partial',
    partialScope: ['mfa_verify'],
    scope: 'global',
    auditEvent: 'sesion.mfa_verificada',
    errorCodes: [
      'AUTH_MFA_SESSION_INVALID',
      'AUTH_MFA_INVALID_CODE',
      'AUTH_MFA_ATTEMPTS_EXCEEDED',
      'SERVICE_UNAVAILABLE',
    ],
  })
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const partial = request.authPartial!;
    const result = await this.mfaService.verify({
      usuarioId: partial.usuarioId,
      partialToken: partial.token,
      code: dto.code,
      method: dto.method ?? 'totp',
      context: buildRequestContext(request),
    });

    if (result.session) {
      setSessionCookies(response, result.session);
    }

    return toLoginBody(result);
  }

  @ApiBody({ type: MfaEnrollDto })
  @Post('mfa/enroll')
  @PartialScopes('mfa_enroll')
  @AuthenticatedOnly()
  @OkCode()
  @NoStore()
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'enrollMfa',
    summary: 'Inscripción MFA (token parcial o sesión)',
    description:
      'Devuelve el secreto TOTP y el `otpauthUri` una sola vez, con `Cache-Control: no-store`. La inscripción se audita al confirmar.',
  })
  @ApiOkResponse({ type: MfaEnrollResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'partial_or_session',
    partialScope: ['mfa_enroll'],
    scope: 'own',
    auditEvent: '-',
    auditExempt: 'La inscripción solo se audita al confirmar (usuario.mfa_inscrita).',
    errorCodes: ['AUTH_MFA_SESSION_INVALID', 'AUTH_MFA_ALREADY_ENABLED'],
  })
  async enrollMfa(
    @Body() _dto: MfaEnrollDto,
    @Req() request: AuthRequest,
  ): Promise<MfaEnrollResponseDto> {
    const usuarioId = request.auth?.userId ?? request.authPartial!.usuarioId;
    return this.mfaService.enroll(usuarioId);
  }

  @ApiBody({ type: MfaConfirmDto })
  @Post('mfa/enroll/confirm')
  @PartialScopes('mfa_enroll')
  @AuthenticatedOnly()
  @OkCode()
  @NoStore()
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'confirmMfaEnrollment',
    summary: 'Confirmar inscripción MFA',
    description:
      'Valida el primer código TOTP, habilita MFA y entrega los 10 códigos de recuperación una sola vez.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'partial_or_session',
    partialScope: ['mfa_enroll'],
    scope: 'own',
    auditEvent: 'usuario.mfa_inscrita',
    errorCodes: ['AUTH_MFA_INVALID_CODE', 'AUTH_MFA_ALREADY_ENABLED', 'AUTH_MFA_SESSION_INVALID'],
  })
  async confirmMfaEnrollment(
    @Body() dto: MfaConfirmDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const usuarioId = request.auth?.userId ?? request.authPartial!.usuarioId;
    const result = await this.mfaService.confirm({
      usuarioId,
      code: dto.code,
      context: buildRequestContext(request),
    });

    if (result.auth.session) {
      setSessionCookies(response, result.auth.session);
    }

    return {
      ...toLoginBody(result.auth),
      recoveryCodes: result.recoveryCodes,
    };
  }

  @ApiBody({ type: RecoveryCodesDto })
  @Post('mfa/recovery-codes')
  @AuthenticatedOnly()
  @OkCode()
  @NoStore()
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'regenerateRecoveryCodes',
    summary: 'Regenerar códigos de recuperación',
    description:
      'Exige un TOTP válido y reemplaza los 10 códigos anteriores, que dejan de ser aceptados. Responde `Cache-Control: no-store`.',
  })
  @ApiOkResponse({ type: RecoveryCodesResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'authenticated',
    scope: 'own',
    auditEvent: 'usuario.mfa_recovery_regenerada',
    errorCodes: ['AUTH_MFA_INVALID_CODE', 'AUTH_MFA_NOT_ENABLED'],
  })
  async recoveryCodes(
    @Body() dto: RecoveryCodesDto,
    @Req() request: AuthRequest,
  ): Promise<RecoveryCodesResponseDto> {
    return this.mfaService.regenerateRecoveryCodes({
      usuarioId: request.auth!.userId,
      code: dto.code,
      context: buildRequestContext(request),
    });
  }

  @Post('refresh')
  @Public()
  @OkCode()
  @NoStore()
  @ApiOperation({
    operationId: 'refresh',
    summary: 'Rotación del refresh token',
    description:
      'Toma el refresh de la cookie `__Host-ccltpg_rt`, exige CSRF y rota el token. La reutilización de un token rotado revoca la familia completa.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'public',
    scope: 'global',
    auditEvent: '-',
    auditExempt: 'Solo se audita la reutilización (sesion.refresh_reutilizado).',
    errorCodes: [
      'AUTH_TOKEN_INVALID',
      'AUTH_TOKEN_EXPIRED',
      'AUTH_TOKEN_REUSED',
      'AUTH_CSRF_INVALID',
      'SERVICE_UNAVAILABLE',
    ],
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    this.csrf.assert(request);

    const rawToken = parseCookie(request.headers.cookie, REFRESH_COOKIE);
    if (!rawToken) {
      throw AuthError.tokenInvalid();
    }

    const session = await this.sessions.refresh(rawToken, buildRequestContext(request));
    const csrfToken = parseCookie(request.headers.cookie, CSRF_COOKIE);
    if (!csrfToken) {
      throw AuthError.csrfInvalid();
    }
    session.csrfToken = csrfToken;

    const principal = await this.sessions.resolvePrincipal(session.accessToken, null);
    setSessionCookies(response, session);

    return toTokenBody(
      session,
      principal.mustChangePassword,
      principal.profiles.map((profile) => ({
        codigo: profile.codigo,
        validUntil: profile.validUntil,
      })),
    );
  }

  @Post('logout')
  @AllowAnonymous()
  @AllowPasswordChange()
  @HttpCode(204)
  @NoStore()
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'logout',
    summary: 'Cierre de sesión idempotente',
    description:
      'Revoca la familia y borra ambas cookies. Responde 204 aunque falte el token o se repita la llamada.',
  })
  @ApiContract({
    access: 'authenticated',
    scope: 'global',
    auditEvent: 'sesion.cerrada',
    errorCodes: ['AUTH_CSRF_INVALID'],
    allowAnonymous: true,
  })
  async logout(@Req() request: AuthRequest): Promise<void> {
    if (request.auth) {
      this.csrf.assert(request);
    }

    await this.sessions.logout(
      request.auth ?? null,
      parseCookie(request.headers.cookie, REFRESH_COOKIE),
      buildRequestContext(request),
    );
  }

  @ApiBody({ type: ChangePasswordDto })
  @Post('password')
  @PartialScopes('pwd_change')
  @AuthenticatedOnly()
  @AllowPasswordChange()
  @OkCode()
  @NoStore()
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    operationId: 'changePassword',
    summary: 'Cambio de contraseña',
    description:
      'Con sesión completa responde 204 y conserva la familia actual; con token parcial `pwd_change` responde el siguiente estado.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiContract({
    access: 'partial_or_session',
    partialScope: ['pwd_change'],
    scope: 'own',
    auditEvent: 'usuario.password_cambiada',
    errorCodes: [
      'AUTH_CURRENT_PASSWORD_INVALID',
      'AUTH_PASSWORD_POLICY_VIOLATION',
      'AUTH_MFA_SESSION_INVALID',
    ],
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const partial = request.authPartial;
    const usuarioId = request.auth?.userId ?? partial!.usuarioId;

    const result = await this.passwordService.change({
      usuarioId,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      keepFamiliaId: request.auth?.sid ?? null,
      partialToken: partial?.token,
      context: buildRequestContext(request),
    });

    if (!result) {
      response.status(204);
      return null;
    }

    if (result.session) {
      setSessionCookies(response, result.session);
    }

    return toLoginBody(result);
  }
}
