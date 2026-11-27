import type { FranjaTipo } from './emisora-states.js';

/**
 * Reglas de calendario y correspondencia de franjas (plan §4.2 y §4.4).
 *
 * Todas las fechas son `YYYY-MM-DD` en `America/Bogota` y se comparan como
 * cadenas: evitar `Date` elimina los desplazamientos por zona horaria. Un día
 * de la semana usa 1 = lunes … 7 = domingo, igual que la columna `dia_semana`.
 */

const FECHA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const HORA_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;

export function esFechaValida(valor: string): boolean {
  const match = FECHA_PATTERN.exec(valor);
  if (!match) {
    return false;
  }
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

export function esHoraValida(valor: string): boolean {
  return HORA_PATTERN.test(valor);
}

export function diaSemana(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const utc = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return utc === 0 ? 7 : utc;
}

/** RF-03.1: la convocatoria se abre en enero y cierra exactamente 21 días después. */
export function esAperturaAnioValida(fechaApertura: string, anio: number): boolean {
  return (
    esFechaValida(fechaApertura) &&
    fechaApertura.slice(0, 4) === String(anio) &&
    fechaApertura.slice(5, 7) === '01'
  );
}

export function plazoVeintiunDias(fechaApertura: string, fechaCierre: string): boolean {
  if (!esFechaValida(fechaApertura) || !esFechaValida(fechaCierre)) {
    return false;
  }
  const [aA, mA, dA] = fechaApertura.split('-').map(Number);
  const [aC, mC, dC] = fechaCierre.split('-').map(Number);
  const inicio = Date.UTC(aA, mA - 1, dA);
  const fin = Date.UTC(aC, mC - 1, dC);
  return fin - inicio === 21 * 24 * 60 * 60 * 1000;
}

/** RF-03.5: informes de realizador en octubre o noviembre, ambos inclusive. */
export function esVentanaInforme(fecha: string): boolean {
  const mes = Number(fecha.slice(5, 7));
  return esFechaValida(fecha) && mes >= 10 && mes <= 11;
}

export function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

export interface FranjaParaSolape {
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

/** RF-01.1: dos franjas del mismo día se consideran solapadas si comparten minutos. */
export function haySolape(franjas: readonly FranjaParaSolape[]): boolean {
  for (let i = 0; i < franjas.length; i += 1) {
    for (let j = i + 1; j < franjas.length; j += 1) {
      const izquierda = franjas[i];
      const derecha = franjas[j];
      if (
        izquierda.fecha === derecha.fecha &&
        aMinutos(izquierda.horaInicio) < aMinutos(derecha.horaFin) &&
        aMinutos(derecha.horaInicio) < aMinutos(izquierda.horaFin)
      ) {
        return true;
      }
    }
  }
  return false;
}

export interface ItemRejillaParaVerificacion {
  fecha: string | null;
  diaSemana: number | null;
  horaInicio: string;
  horaFin: string;
  tipo: FranjaTipo;
  programaId: string | null;
  nombre: string;
}

export interface ItemProgramacionParaVerificacion {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipo: FranjaTipo;
  programaId: string | null;
  titulo: string;
}

export interface ResultadoVerificacion {
  concuerda: boolean;
  desviaciones: string[];
}

/**
 * RF-01.3: cada franja programada debe corresponderse con una franja de la
 * rejilla aprobada (mismo día, misma hora, mismo tipo y mismo programa). El
 * histórico de desviaciones se conserva en la programación y en auditoría; la
 * rejilla no se versiona.
 */
export function verificarContraRejilla(
  items: readonly ItemProgramacionParaVerificacion[],
  franjas: readonly ItemRejillaParaVerificacion[],
): ResultadoVerificacion {
  const desviaciones: string[] = [];
  for (const item of items) {
    const dia = diaSemana(item.fecha);
    const coincide = franjas.some(
      (franja) =>
        franja.horaInicio === item.horaInicio &&
        franja.horaFin === item.horaFin &&
        franja.tipo === item.tipo &&
        (franja.diaSemana === dia || franja.fecha === item.fecha) &&
        (franja.programaId === item.programaId ||
          franja.programaId === null ||
          item.programaId === null),
    );
    if (!coincide) {
      desviaciones.push(
        `${item.fecha} ${item.horaInicio}-${item.horaFin} (${item.tipo}) «${item.titulo}»`,
      );
    }
  }
  return { concuerda: desviaciones.length === 0, desviaciones };
}
