import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../../shared/errors/app-error.js';

export const NOTIFICATION_ERRORS = {
  notFound: 'NOTIFICATION_NOT_FOUND',
  criticalNotSilenceable: 'NOTIFICATION_CRITICAL_NOT_SILENCEABLE',
  preferenceInvalid: 'NOTIFICATION_PREFERENCE_INVALID',
  deliveryFailed: 'NOTIFICATION_DELIVERY_FAILED',
} as const;

export type NotificationErrorCode = (typeof NOTIFICATION_ERRORS)[keyof typeof NOTIFICATION_ERRORS];

export class NotificationError extends AppError {
  constructor(code: NotificationErrorCode, status: HttpStatus, detail: string) {
    super(code, status, detail);
  }

  static notFound(): NotificationError {
    return new NotificationError(
      NOTIFICATION_ERRORS.notFound,
      HttpStatus.NOT_FOUND,
      'Notificación inexistente.',
    );
  }

  static criticalNotSilenceable(evento: string): NotificationError {
    return new NotificationError(
      NOTIFICATION_ERRORS.criticalNotSilenceable,
      HttpStatus.UNPROCESSABLE_ENTITY,
      `El evento "${evento}" es crítico y no se puede silenciar.`,
    );
  }

  static preferenceInvalid(detail: string): NotificationError {
    return new NotificationError(
      NOTIFICATION_ERRORS.preferenceInvalid,
      HttpStatus.BAD_REQUEST,
      detail,
    );
  }
}
