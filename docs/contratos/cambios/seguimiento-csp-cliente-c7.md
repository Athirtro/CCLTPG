# Seguimiento C7 — CSP del cliente web (MUI/emotion)

- **Fecha:** 25 de noviembre de 2026
- **Estado:** decisión registrada; **cabecera desplegada y nonces/hashes pendientes**.
- **Relación:** continuación de `docs/contratos/cambios/cambio-csp-c7.md` (enmienda ratificada, no modificada).
- **Responsables:** Rol C (cliente y decisiones de estilos) y Rol B/entorno (publicación de la cabecera).

## 1. Problema

La enmienda C7 fija la CSP de la **API** (`style-src 'self' 'unsafe-inline'`, sin `unsafe-eval`). Esa cabecera protege las respuestas JSON y el Swagger local. El frontend es un documento HTML servido por Vite en desarrollo y por el servidor web/CDN en producción: necesita su **propia** cabecera CSP, sea cual sea el origen que lo sirve. Hoy el repositorio no contiene esa configuración de despliegue, por lo que no puede afirmarse que el cliente cumpla C-36 en entorno.

## 2. Decisión registrada

Mientras MUI/emotion inyecte estilos en tiempo de ejecución (`<style data-emotion>`), la CSP del documento HTML del cliente debe incluir:

| Directiva | Valor mínimo del cliente |
| --- | --- |
| `default-src` | `'self'` |
| `script-src` | `'self'` |
| `script-src-attr` | `'none'` |
| `style-src` | `'self' 'unsafe-inline'` |
| `img-src` | `'self' data: blob:` |
| `font-src` | `'self'` |
| `connect-src` | `'self'` (o el origen explícito de la API si el despliegue es multi-origen) |
| `object-src` | `'none'` |
| `base-uri` | `'none'` |
| `frame-ancestors` | `'none'` |
| `form-action` | `'self'` |

**Prohibido en el cliente:** `unsafe-eval`, orígenes externos en `script-src` y `data:` en `script-src`. El valor `unsafe-inline` en `style-src` se acepta explícitamente como mínimo compatible con emotion; **no** se propaga a `script-src`.

## 3. Condición para retirar `unsafe-inline`

La directiva podrá endurecerse solo cuando el cliente deje de inyectar estilos dinámicos:

1. Configurar la generación de estilos de MUI/emotion con `nonce` o extraer el CSS en tiempo de compilación, y
2. Publicar la CSP con `style-src 'self' 'nonce-<valor>'` (o sin `unsafe-inline`), y
3. Verificar la cabecera en el despliegue real con una prueba que compruebe el valor carácter por carácter.

Hasta entonces, cualquier intento de eliminar `unsafe-inline` rompería el renderizado de las pantallas. No se modifica por este motivo `packages/contracts/openapi.json` ni los documentos congelados (`auth-v1.md`, `controles-seguridad-v1.md`).

## 4. Evidencia y estado

| Elemento | Estado |
| --- | --- |
| Enmienda de la API ratificada y verificada por prueba | ✅ `cambio-csp-c7.md`, `security-headers.spec.ts` |
| Decisión del cliente registrada | ✅ Este documento |
| Configuración de la cabecera CSP en el servidor web/CDN del SPA | ⏳ **Pendiente**: requiere despliegue real |
| Migración a nonces/hashes y retirada de `unsafe-inline` | ⏳ **Pendiente**: decisión de diseño posterior |

Una fila ⏳ **no** cuenta como cumplida para firmar C7/C8.

## Fuentes

- `docs/contratos/cambios/cambio-csp-c7.md` (PA-010, decisión D91).
- `docs/reviews/c7/rol-b.md` §2 y §4 (separación API/cliente).
- `docs/reviews/c7/rol-c.md` §7 (estado del paquete de Rol C).
