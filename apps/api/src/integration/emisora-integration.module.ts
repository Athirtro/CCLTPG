import { Module } from '@nestjs/common';

import { AcademicModule } from '../modules/academic/academic.module.js';
import { IdentityModule } from '../modules/identity/identity.module.js';
/**
 * Puente de composición del contexto Emisora R.A.C. (ADR-0005, decisión 3).
 *
 * Vive en `src/integration/`, fuera de `src/shared/` y de `src/modules/`: es la
 * única pieza que conoce a los contextos dueños de los puertos y los conecta
 * sin que emisora importe `identity` ni `academic`. Así `arch:check` sigue
 * prohibiendo las importaciones cruzadas entre contextos y `shared` sigue sin
 * depender de ellos. Reexportar los módulos (no los tokens sueltos) es lo que
 * permite a `EmisoraModule` inyectar los proveedores exportados por ellos.
 * No registra controladores ni casos de uso nuevos.
 */
@Module({
  imports: [IdentityModule, AcademicModule],
  exports: [IdentityModule, AcademicModule],
})
export class EmisoraIntegrationModule {}
