import { Module } from '@nestjs/common';
import type { Kysely } from 'kysely';

import { DATABASE } from '../../database/database.module.js';
import type { Database } from '../../database/schema.js';
import { EmisoraIntegrationModule } from '../../integration/emisora-integration.module.js';
import { EMISORA_OWNERSHIP_POLICY } from '../../shared/integration/ownership.port.js';
import { ConvocatoriaService } from './application/convocatoria.service.js';
import { EmisoraGestionService } from './application/gestion.service.js';
import { GrabacionService } from './application/grabacion.service.js';
import { ProgramacionService } from './application/programacion.service.js';
import { EmisoraOperacionService } from './application/operacion.service.js';
import { EMISORA_REPOSITORY } from './application/ports/emisora.repository.js';
import { EmisoraUnitOfWork } from './application/ports/unit-of-work.js';
import { AudiosController, GrabacionesController } from './api/grabaciones.controller.js';
import {
  ComitesController,
  ConvocatoriasController,
  InformesController,
  IncentivosController,
  ProyectosController,
  RealizadoresController,
  RejillaController,
} from './api/convocatorias.controller.js';
import {
  ActividadesController,
  ActualizacionesController,
  ArchivosEmisoraController,
  AsignacionesEquipoController,
  BitacorasController,
  EquiposController,
  InversionesController,
  LecturasController,
  ObrasController,
  PagosDerechosController,
  PermisosSalidaController,
  PlanillasController,
  ProyeccionesController,
  ReportesObrasController,
  TramitesController,
  TurnosController,
  VersionesSoftwareController,
} from './api/gestion.controller.js';
import { ProgramacionController } from './api/programacion.controller.js';
import {
  OrdenesEmisionController,
  PatrociniosController,
  PrestamosMifiController,
  PromosController,
  PublicacionesController,
  ReportesDesplazamientoController,
  ResolucionesController,
  SalidasEquipoController,
  TransmisionesController,
  ViaticosController,
} from './api/operacion.controller.js';
import { EmisoraPii } from './application/emisora-pii.js';
import { IdentityOwnershipPolicy } from './infrastructure/identity-ownership-policy.js';
import { KyselyEmisoraRepository } from './infrastructure/persistence/kysely-emisora.repository.js';
import { KyselyEmisoraUnitOfWork } from './infrastructure/persistence/kysely-unit-of-work.js';

/**
 * Contexto delimitado Emisora R.A.C. (plan §2.1, E2/E3).
 *
 * El puente de `src/integration/` inyecta los directorios de los contextos
 * dueños sin importarlos desde aquí (ADR-0005). Los casos de uso E2 comparten
 * la tienda de idempotencia, la auditoría y la outbox existentes; emisora no
 * introduce mecanismos paralelos ni esquemas nuevos fuera de `emisora`.
 */
@Module({
  imports: [EmisoraIntegrationModule],
  controllers: [
    ConvocatoriasController,
    ProyectosController,
    RealizadoresController,
    ComitesController,
    RejillaController,
    InformesController,
    IncentivosController,
    ProgramacionController,
    GrabacionesController,
    AudiosController,
    ResolucionesController,
    PatrociniosController,
    PromosController,
    OrdenesEmisionController,
    PublicacionesController,
    TransmisionesController,
    SalidasEquipoController,
    ReportesDesplazamientoController,
    PrestamosMifiController,
    ViaticosController,
    TurnosController,
    LecturasController,
    BitacorasController,
    ObrasController,
    ReportesObrasController,
    PagosDerechosController,
    EquiposController,
    ActualizacionesController,
    ProyeccionesController,
    InversionesController,
    VersionesSoftwareController,
    AsignacionesEquipoController,
    ActividadesController,
    PermisosSalidaController,
    ArchivosEmisoraController,
    PlanillasController,
    TramitesController,
  ],
  providers: [
    {
      provide: EMISORA_REPOSITORY,
      useFactory: (db: Kysely<Database>) => new KyselyEmisoraRepository(db),
      inject: [DATABASE],
    },
    { provide: EmisoraUnitOfWork, useClass: KyselyEmisoraUnitOfWork },
    { provide: EMISORA_OWNERSHIP_POLICY, useClass: IdentityOwnershipPolicy },
    EmisoraPii,
    ConvocatoriaService,
    ProgramacionService,
    GrabacionService,
    EmisoraOperacionService,
    EmisoraGestionService,
  ],
  exports: [EMISORA_OWNERSHIP_POLICY],
})
export class EmisoraModule {}
