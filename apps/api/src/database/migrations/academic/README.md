# Migraciones — esquema `academic`

Tablas del contexto académico (programas, grupos, estudiantes, matrícula,
sesiones, asistencia, indicadores y evaluación).

- `0007_create_academic_core.ts` y `0008_academic_indexes.ts`: Académico A (C4).
- `0009_create_academic_b.ts` y `0010_academic_b_indexes.ts`: Académico B (C5).
  `0010` siembra además el catálogo global de indicadores (D73).

Las migraciones las aplica exclusivamente `ccltpg_migrador`; la API no ejecuta
DDL. La prueba `test/integration/migrator.spec.ts` verifica `up → down → up`.
