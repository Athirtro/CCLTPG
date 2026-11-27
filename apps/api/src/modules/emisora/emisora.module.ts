import { Module } from '@nestjs/common';

/**
 * Contexto delimitado Emisora R.A.C. (plan §2.1).
 *
 * El esqueleto no registra aún controladores ni casos de uso: las rutas y la
 * navegación ya existen, pero la funcionalidad de negocio llega en E2…E4. Los
 * puertos compartidos (`IdentityDirectory`, `FormacionDirectory`) se publican
 * desde sus contextos dueños y se consumirán aquí sin importarlos.
 */
@Module({})
export class EmisoraModule {}
