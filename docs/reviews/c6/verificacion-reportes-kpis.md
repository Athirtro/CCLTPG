# Acta de verificación — C6: tres reportes y tres KPIs contra datos crudos

- **Fecha:** 22 de noviembre de 2026
- **Rol:** B — Seguridad, identidad y operación
- **Tarea:** RB1-59 (D86)
- **Entorno:** PostgreSQL 16 embebido, clúster efímero en `localhost:55432`, roles creados desde `infra/compose/postgres/init/00-roles.sql`.
- **Ejecución:** `node C:/Users/davin/AppData/Local/Temp/opencode/pgtest/run.mjs`, que levanta el clúster, aplica las migraciones con `ccltpg_migrador` y ejecuta `pnpm --filter @ccltpg/api test:integration` de forma serial.
- **Código de la comparación:** `apps/api/test/integration/analytics-c6-flow.spec.ts`.
- **Tolerancia:** cero para conteos; dos decimales para porcentajes. No se aceptaron diferencias.

## 1. Datos sembrados para la comparación

El caso de prueba crea un programa, un grupo, siete estudiantes y sus matrículas en el periodo `2026-1`, una sesión en estado `realizada`, siete registros de asistencia (cinco `presente`, un `tarde`, un `ausente`) y siete evaluaciones (cuatro `excelente`, dos `bueno`, un `regular`). Después se transiciona una matrícula de Palmira a `retirada`. La comparación se hace contra el mismo estado de la base, sin mocks ni adaptadores en memoria.

## 2. Reportes

| Reporte | Consulta directa (resumen) | Resultado del proveedor | Resultado SQL directo | Diferencia |
| --- | --- | --- | --- | --- |
| `asistencia` | `academic.asistencia ⋈ sesion_clase ⋈ matricula ⋈ grupo`, con `s.estado = 'realizada'` y `g.periodo = '2026-1'` | 7 filas, mismos `grupo`, `sesion`, `estudiante` y `estado` | 7 filas idénticas | 0 |
| `matricula` | `academic.matricula ⋈ grupo ⋈ programa_formativo`, agrupado por programa, grupo y estado | 2 filas: `activa = 6`, `retirada = 1` | 2 filas idénticas | 0 |
| `desercion` | `count(*) filter (where estado = 'retirada') / count(*)` sobre `activa + finalizada + retirada` | `retiradas = 1`, `base = 7`, `porcentaje = 14.29` | idéntico | 0 |

Las tres consultas del proveedor (`KyselyReportDataProvider.rowsFor`) y las SQL directas están escritas literalmente en `analytics-c6-flow.spec.ts`, caso «RB1-59: los reportes coinciden con SQL directo». La prueba usa `expect(...).toEqual(...)` sobre todas las columnas y filas, no solo sobre totales.

## 3. KPIs

| KPI | Fórmula D82 | Resultado del servicio | SQL directo | Diferencia |
| --- | --- | --- | --- | --- |
| `asistencia` | `(presente + tarde) / total` sobre sesiones `realizada` | 85.71 (`5 + 1` sobre `7`) | 85.71 | 0 |
| `matricula_activa` | `preinscrita + confirmada + activa` del periodo | 6 | 6 | 0 |
| `evaluacion` | `(excelente + bueno) / total` del periodo | 85.71 (`4 + 2` sobre `7`) | 85.71 | 0 |

La misma prueba verifica, además, la regla D84 de supresión de celdas pequeñas: `distribucion_geografica` devuelve solamente `{ clave: 'Cali', total: 6 }`; la celda de Palmira (`total = 1`) queda suprimida por el umbral de 5. No aparece documento, teléfono, dirección ni identificador individual en ninguna respuesta de KPI.

## 4. Resultado de la ejecución

```text
Test Files  6 passed (6)
     Tests  49 passed (49)
  Duration  18.34s
Listo.
```

Incluye los cinco casos del flujo C6: coincidencia de reportes, coincidencia de KPIs y supresión, reutilización e invalidación de caché, ámbito de educador ajeno → `RESOURCE_NOT_FOUND` sin exportar filas, y publicación/entrega de los dos eventos de D85 con sus cuatro plantillas y registros de auditoría.

## 5. Conclusión

Los tres reportes y los tres KPIs exigidos por la compuerta C6 coinciden exactamente con las consultas directas sobre PostgreSQL. El acta cubre la verificación funcional de D86; **no** sustituye la evidencia externa pendiente (CI de GitHub, TLS/preproducción, Docker/MinIO, k6 y simulacro de respaldo/restauración) ni la firma formal de C6.
