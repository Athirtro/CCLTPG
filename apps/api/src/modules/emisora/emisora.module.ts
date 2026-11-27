import { Module } from '@nestjs/common';

import { EmisoraIntegrationModule } from '../../integration/emisora-integration.module.js';
import { EMISORA_OWNERSHIP_POLICY } from '../../shared/integration/ownership.port.js';
import { IdentityOwnershipPolicy } from './infrastructure/identity-ownership-policy.js';

/**
 * Contexto delimitado Emisora R.A.C. (plan §2.1).
 *
 * El puente de `src/integration/` inyecta los directorios de los contextos
 * dueños sin importarlos desde aquí (ADR-0005). El esqueleto no registra aún
 * controladores ni casos de uso: las rutas y la navegación ya existen, pero la
 * funcionalidad de negocio llega en E2…E4.
 */
@Module({
  imports: [EmisoraIntegrationModule],
  providers: [{ provide: EMISORA_OWNERSHIP_POLICY, useClass: IdentityOwnershipPolicy }],
  exports: [EMISORA_OWNERSHIP_POLICY],
})
export class EmisoraModule {}
