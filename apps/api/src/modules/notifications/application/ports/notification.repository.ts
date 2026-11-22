import type {
  NewNotification,
  NotificationFilter,
  NotificationPage,
  NotificationRecord,
  NotificationTemplateRecord,
  PreferenceRecord,
  UserContact,
} from '../notification.types.js';
import type { NotificationChannel, NotificationEstado } from '../../domain/notification.types.js';

export abstract class NotificationRepository {
  abstract listByUser(userId: string, filter: NotificationFilter): Promise<NotificationPage>;
  abstract findById(id: string): Promise<NotificationRecord | null>;
  abstract setRead(id: string, leidaEn: Date | null): Promise<void>;
  abstract listPreferences(userId: string): Promise<PreferenceRecord[]>;
  abstract upsertPreferences(userId: string, preferences: PreferenceRecord[]): Promise<void>;
  abstract findTemplate(
    evento: string,
    canal: NotificationChannel,
  ): Promise<NotificationTemplateRecord | null>;
  abstract createNotification(input: NewNotification): Promise<NotificationRecord | null>;
  abstract markDelivered(id: string, estado: NotificationEstado, enviadaEn: Date): Promise<void>;
  abstract markFailed(id: string): Promise<void>;
  abstract findUserContact(userId: string): Promise<UserContact | null>;
  abstract isChannelEnabled(
    userId: string,
    evento: string,
    canal: NotificationChannel,
  ): Promise<boolean>;
}
