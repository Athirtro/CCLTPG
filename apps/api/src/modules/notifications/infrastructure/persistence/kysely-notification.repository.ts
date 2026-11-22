import type { Kysely } from 'kysely';
import { v7 as uuidv7 } from 'uuid';

import type { Database } from '../../../../database/schema.js';
import type {
  NewNotification,
  NotificationFilter,
  NotificationPage,
  NotificationRecord,
  NotificationTemplateRecord,
  PreferenceRecord,
  UserContact,
} from '../../application/notification.types.js';
import type { NotificationRepository } from '../../application/ports/notification.repository.js';
import type { NotificationChannel } from '../../domain/notification.types.js';

type Executor = Kysely<Database>;

export class KyselyNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Executor) {}

  async listByUser(userId: string, filter: NotificationFilter): Promise<NotificationPage> {
    const base = this.db.selectFrom('notificacion').where('usuario_id', '=', userId);

    const [rows, count] = await Promise.all([
      base
        .leftJoin('plantilla_notificacion as p', 'p.id', 'notificacion.plantilla_id')
        .select([
          'notificacion.id',
          'notificacion.usuario_id',
          'notificacion.evento',
          'notificacion.evento_id',
          'notificacion.canal',
          'notificacion.plantilla_id',
          'notificacion.payload',
          'notificacion.estado',
          'notificacion.leida_en',
          'notificacion.enviada_en',
          'notificacion.creado_en',
          'p.asunto as plantilla_asunto',
          'p.cuerpo as plantilla_cuerpo',
        ])
        .$if(filter.soloNoLeidas, (query) => query.where('notificacion.leida_en', 'is', null))
        .orderBy('notificacion.creado_en', 'desc')
        .limit(filter.limit)
        .offset(filter.offset)
        .execute(),
      base
        .select((expression) => expression.fn.countAll<string>().as('total'))
        .$if(filter.soloNoLeidas, (query) => query.where('leida_en', 'is', null))
        .executeTakeFirst(),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        usuarioId: row.usuario_id,
        evento: row.evento,
        eventoId: row.evento_id,
        canal: row.canal,
        plantillaId: row.plantilla_id,
        asunto: row.plantilla_asunto,
        cuerpo: row.plantilla_cuerpo,
        payload: row.payload,
        estado: row.estado,
        leidaEn: row.leida_en,
        enviadaEn: row.enviada_en,
        creadoEn: row.creado_en,
      })),
      total: Number(count?.total ?? 0),
    };
  }

  async findById(id: string): Promise<NotificationRecord | null> {
    const row = await this.db
      .selectFrom('notificacion')
      .leftJoin('plantilla_notificacion as p', 'p.id', 'notificacion.plantilla_id')
      .select([
        'notificacion.id',
        'notificacion.usuario_id',
        'notificacion.evento',
        'notificacion.evento_id',
        'notificacion.canal',
        'notificacion.plantilla_id',
        'notificacion.payload',
        'notificacion.estado',
        'notificacion.leida_en',
        'notificacion.enviada_en',
        'notificacion.creado_en',
        'p.asunto as plantilla_asunto',
        'p.cuerpo as plantilla_cuerpo',
      ])
      .where('notificacion.id', '=', id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      usuarioId: row.usuario_id,
      evento: row.evento,
      eventoId: row.evento_id,
      canal: row.canal,
      plantillaId: row.plantilla_id,
      asunto: row.plantilla_asunto,
      cuerpo: row.plantilla_cuerpo,
      payload: row.payload,
      estado: row.estado,
      leidaEn: row.leida_en,
      enviadaEn: row.enviada_en,
      creadoEn: row.creado_en,
    };
  }

  async setRead(id: string, leidaEn: Date | null): Promise<void> {
    await this.db
      .updateTable('notificacion')
      .set({ leida_en: leidaEn, estado: leidaEn ? 'leida' : 'enviada' })
      .where('id', '=', id)
      .execute();
  }

  async listPreferences(userId: string): Promise<PreferenceRecord[]> {
    const rows = await this.db
      .selectFrom('preferencia_notificacion')
      .select(['evento', 'canal', 'habilitado'])
      .where('usuario_id', '=', userId)
      .orderBy('evento')
      .orderBy('canal')
      .execute();

    return rows.map((row) => ({
      evento: row.evento,
      canal: row.canal,
      habilitado: row.habilitado,
    }));
  }

  async upsertPreferences(userId: string, preferences: PreferenceRecord[]): Promise<void> {
    for (const preference of preferences) {
      await this.db
        .insertInto('preferencia_notificacion')
        .values({
          id: uuidv7(),
          usuario_id: userId,
          evento: preference.evento,
          canal: preference.canal,
          habilitado: preference.habilitado,
        })
        .onConflict((conflict) =>
          conflict.columns(['usuario_id', 'evento', 'canal']).doUpdateSet({
            habilitado: preference.habilitado,
            actualizado_en: new Date(),
          }),
        )
        .execute();
    }
  }

  async findTemplate(
    evento: string,
    canal: NotificationChannel,
  ): Promise<NotificationTemplateRecord | null> {
    const specific = await this.db
      .selectFrom('plantilla_notificacion')
      .selectAll()
      .where('codigo', '=', evento)
      .where('canal', '=', canal)
      .executeTakeFirst();

    if (specific) {
      return mapTemplate(specific);
    }

    const generic = await this.db
      .selectFrom('plantilla_notificacion')
      .selectAll()
      .where('codigo', '=', 'notificacion.generica')
      .where('canal', '=', canal)
      .executeTakeFirst();

    return generic ? mapTemplate(generic) : null;
  }

  async createNotification(input: NewNotification): Promise<NotificationRecord | null> {
    const row = await this.db
      .insertInto('notificacion')
      .values({
        id: input.id,
        usuario_id: input.usuarioId,
        evento: input.evento,
        evento_id: input.eventoId,
        canal: input.canal,
        plantilla_id: input.plantillaId,
        payload: input.payload as never,
        estado: 'pendiente',
        leida_en: null,
        enviada_en: null,
      })
      .onConflict((conflict) => conflict.columns(['evento_id', 'usuario_id', 'canal']).doNothing())
      .returningAll()
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      usuarioId: row.usuario_id,
      evento: row.evento,
      eventoId: row.evento_id,
      canal: row.canal,
      plantillaId: row.plantilla_id,
      asunto: null,
      cuerpo: null,
      payload: row.payload,
      estado: row.estado,
      leidaEn: row.leida_en,
      enviadaEn: row.enviada_en,
      creadoEn: row.creado_en,
    };
  }

  async markDelivered(id: string, estado: 'enviada' | 'leida', enviadaEn: Date): Promise<void> {
    await this.db
      .updateTable('notificacion')
      .set({ estado, enviada_en: enviadaEn })
      .where('id', '=', id)
      .execute();
  }

  async markFailed(id: string): Promise<void> {
    await this.db
      .updateTable('notificacion')
      .set({ estado: 'fallida' })
      .where('id', '=', id)
      .execute();
  }

  async findUserContact(userId: string): Promise<UserContact | null> {
    const row = await this.db
      .selectFrom('usuario')
      .select(['email', 'nombre'])
      .where('id', '=', userId)
      .executeTakeFirst();
    return row ?? null;
  }

  async isChannelEnabled(
    userId: string,
    evento: string,
    canal: NotificationChannel,
  ): Promise<boolean> {
    const row = await this.db
      .selectFrom('preferencia_notificacion')
      .select('habilitado')
      .where('usuario_id', '=', userId)
      .where('evento', '=', evento)
      .where('canal', '=', canal)
      .executeTakeFirst();
    return row?.habilitado ?? true;
  }
}

function mapTemplate(row: {
  id: string;
  codigo: string;
  canal: NotificationChannel;
  asunto: string;
  cuerpo: string;
}): NotificationTemplateRecord {
  return {
    id: row.id,
    codigo: row.codigo,
    canal: row.canal,
    asunto: row.asunto,
    cuerpo: row.cuerpo,
  };
}
