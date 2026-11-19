export interface AuditFilter {
  from?: Date;
  to?: Date;
  actorId?: string;
  recurso?: string;
  recursoId?: string;
  accion?: string;
  limit: number;
  offset: number;
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  actorPerfil: string | null;
  ip: string | null;
  dispositivo: string | null;
  recurso: string;
  recursoId: string | null;
  accion: string;
  datosAntes: unknown;
  datosDespues: unknown;
  ocurridoEn: Date;
  requestId: string | null;
}

export interface AuditPage {
  items: AuditRow[];
  total: number;
}
