import { describe, expect, it } from 'vitest';

import {
  diaSemana,
  esAperturaAnioValida,
  esFechaValida,
  esHoraValida,
  esVentanaInforme,
  haySolape,
  plazoVeintiunDias,
  verificarContraRejilla,
} from './emisora-rules.js';

/** RF-01.1/01.3, RF-03.1/03.5 y §4.4 (fechas de calendario sin zona). */
describe('reglas de calendario de la emisora', () => {
  it('valida fechas y horas en formato canónico', () => {
    expect(esFechaValida('2026-01-15')).toBe(true);
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('15-01-2026')).toBe(false);
    expect(esHoraValida('06:05')).toBe(true);
    expect(esHoraValida('24:00')).toBe(false);
  });

  it('fija la convocatoria en enero con plazo inclusivo de 21 días', () => {
    expect(esAperturaAnioValida('2026-01-15', 2026)).toBe(true);
    expect(esAperturaAnioValida('2026-02-05', 2026)).toBe(false);
    expect(esAperturaAnioValida('2025-01-15', 2026)).toBe(false);
    expect(plazoVeintiunDias('2026-01-15', '2026-02-05')).toBe(true);
    expect(plazoVeintiunDias('2026-01-15', '2026-02-04')).toBe(false);
  });

  it('mapea lunes=1 y domingo=7 y restringe informes a oct/nov', () => {
    expect(diaSemana('2026-01-19')).toBe(1);
    expect(diaSemana('2026-01-25')).toBe(7);
    expect(esVentanaInforme('2026-10-01')).toBe(true);
    expect(esVentanaInforme('2026-11-30')).toBe(true);
    expect(esVentanaInforme('2026-09-30')).toBe(false);
    expect(esVentanaInforme('2026-12-01')).toBe(false);
  });

  it('detecta solapes en la misma fecha y tolera franjas contiguas', () => {
    const base = { fecha: '2026-01-19' };
    expect(
      haySolape([
        { ...base, horaInicio: '06:00', horaFin: '07:00' },
        { ...base, horaInicio: '06:30', horaFin: '07:30' },
      ]),
    ).toBe(true);
    expect(
      haySolape([
        { ...base, horaInicio: '06:00', horaFin: '07:00' },
        { ...base, horaInicio: '07:00', horaFin: '08:00' },
      ]),
    ).toBe(false);
    expect(
      haySolape([
        { ...base, horaInicio: '06:00', horaFin: '07:00' },
        { fecha: '2026-01-20', horaInicio: '06:30', horaFin: '07:30' },
      ]),
    ).toBe(false);
  });

  it('verifica la programación contra la rejilla y lista desviaciones', () => {
    const franjas = [
      {
        fecha: null,
        diaSemana: 1,
        horaInicio: '06:00',
        horaFin: '07:00',
        tipo: 'programa' as const,
        programaId: null,
        nombre: 'Franja de ejemplo',
      },
    ];
    const items = [
      {
        fecha: '2026-01-19',
        horaInicio: '06:00',
        horaFin: '07:00',
        tipo: 'programa' as const,
        programaId: null,
        titulo: 'Programa del lunes',
      },
    ];
    expect(verificarContraRejilla(items, franjas)).toEqual({
      concuerda: true,
      desviaciones: [],
    });

    const desviado = verificarContraRejilla(
      [{ ...items[0], horaInicio: '08:00', horaFin: '09:00' }],
      franjas,
    );
    expect(desviado.concuerda).toBe(false);
    expect(desviado.desviaciones).toHaveLength(1);
  });
});
