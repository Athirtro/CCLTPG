import type { AuditPort } from '../../../../shared/audit/audit.port.js';
import type { OutboxPort } from '../../../../shared/events/outbox.port.js';
import type { EnrollmentRepository } from './enrollment.repository.js';
import type { GroupRepository } from './group.repository.js';
import type { ProgramRepository } from './program.repository.js';
import type { StudentRepository } from './student.repository.js';

/**
 * Contexto transaccional académico: agregados, auditoría y outbox comparten
 * ejecutor. Si la transacción se revierte, no queda evento ni notificación.
 */
export interface AcademicTransactionContext {
  programs: ProgramRepository;
  groups: GroupRepository;
  students: StudentRepository;
  enrollments: EnrollmentRepository;
  audit: AuditPort;
  outbox: OutboxPort;
}

export abstract class AcademicUnitOfWork {
  abstract run<T>(callback: (tx: AcademicTransactionContext) => Promise<T>): Promise<T>;
}
