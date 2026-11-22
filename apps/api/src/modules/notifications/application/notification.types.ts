import type { NotificationChannel, NotificationEstado } from '../domain/notification.types.js';

export interface NotificationRecord {
  id: string;
  usuarioId: string;
  evento: string;
  eventoId: string | null;
  canal: NotificationChannel;
  plantillaId: string | null;
  asunto: string | null;
  cuerpo: string | null;
  payload: unknown;
  estado: NotificationEstado;
  leidaEn: Date | null;
  enviadaEn: Date | null;
  creadoEn: Date;
}

export interface NotificationPage {
  items: NotificationRecord[];
  total: number;
}

export interface NotificationFilter {
  soloNoLeidas: boolean;
  limit: number;
  offset: number;
}

export interface PreferenceRecord {
  evento: string;
  canal: NotificationChannel;
  habilitado: boolean;
}

export interface NewNotification {
  id: string;
  usuarioId: string;
  evento: string;
  eventoId: string;
  canal: NotificationChannel;
  plantillaId: string | null;
  payload: unknown;
}

export interface NotificationTemplateRecord {
  id: string;
  codigo: string;
  canal: NotificationChannel;
  asunto: string;
  cuerpo: string;
}

export interface UserContact {
  email: string;
  nombre: string;
}
