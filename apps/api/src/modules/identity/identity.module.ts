import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { AuthController } from './api/auth.controller.js';
import { CsrfService } from './api/csrf.service.js';
import { AuthorizationGuard } from './api/guards/authorization.guard.js';
import { IdentityController } from './api/identity.controller.js';
import { MeController } from './api/me.controller.js';
import { AuthStateService } from './application/auth-state.service.js';
import { IdentityAdminService } from './application/identity-admin.service.js';
import { LoginService } from './application/login.service.js';
import { MeService } from './application/me.service.js';
import { MfaService } from './application/mfa.service.js';
import { PasswordService } from './application/password.service.js';
import { Clock } from './application/ports/clock.js';
import { FieldEncryption } from './application/ports/field-encryption.js';
import { IdentityRepository } from './application/ports/identity.repository.js';
import { PasswordHasher } from './application/ports/password-hasher.js';
import { RateLimiter } from './application/ports/rate-limiter.js';
import { SessionCache } from './application/ports/session-cache.js';
import { SessionRepository } from './application/ports/session.repository.js';
import { TokenService } from './application/ports/token.service.js';
import { TotpService } from './application/ports/totp.service.js';
import { UnitOfWork } from './application/ports/unit-of-work.js';
import { SessionService } from './application/session.service.js';
import { KyselyIdentityRepository } from './infrastructure/persistence/kysely-identity.repository.js';
import { KyselySessionRepository } from './infrastructure/persistence/kysely-session.repository.js';
import { KyselyUnitOfWork } from './infrastructure/persistence/kysely-unit-of-work.js';
import { RedisRateLimiter } from './infrastructure/redis/redis-rate-limiter.js';
import { RedisSessionCache } from './infrastructure/redis/redis-session-cache.js';
import { AesFieldEncryption } from './infrastructure/security/aes-field-encryption.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { JoseTokenService } from './infrastructure/security/jose-token.service.js';
import { RfcTotpService } from './infrastructure/security/rfc-totp.service.js';
import { SystemClock } from './infrastructure/system-clock.js';

@Module({
  controllers: [AuthController, MeController, IdentityController],
  providers: [
    {
      provide: IdentityRepository,
      useFactory: (db: Kysely<Database>) => new KyselyIdentityRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SessionRepository,
      useFactory: (db: Kysely<Database>) => new KyselySessionRepository(db),
      inject: [DATABASE],
    },
    { provide: UnitOfWork, useClass: KyselyUnitOfWork },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: TokenService, useClass: JoseTokenService },
    { provide: TotpService, useClass: RfcTotpService },
    { provide: FieldEncryption, useClass: AesFieldEncryption },
    { provide: Clock, useClass: SystemClock },
    { provide: SessionCache, useClass: RedisSessionCache },
    { provide: RateLimiter, useClass: RedisRateLimiter },
    CsrfService,
    SessionService,
    AuthStateService,
    LoginService,
    MfaService,
    PasswordService,
    MeService,
    IdentityAdminService,
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
  exports: [SessionService],
})
export class IdentityModule {}
