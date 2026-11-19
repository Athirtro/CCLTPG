import type { AuditFilter, AuditPage, AuditRow } from '../audit.types.js';

export abstract class AuditRepository {
  abstract list(filter: AuditFilter): Promise<AuditPage>;
  abstract findById(id: string): Promise<AuditRow | null>;
}
