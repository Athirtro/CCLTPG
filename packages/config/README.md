# packages/config

Configuración compartida del monorepo: TypeScript, ESLint (flat config), Prettier y criterios de pruebas.

## Contenido

| Ruta                  | Uso                                                             |
| --------------------- | --------------------------------------------------------------- |
| `tsconfig/base.json`  | Opciones estrictas comunes                                      |
| `tsconfig/node.json`  | Backend NestJS (CommonJS, decoradores, `emitDecoratorMetadata`) |
| `tsconfig/react.json` | Frontend React + Vite (bundler, JSX, `noEmit`)                  |
| `eslint/index.mjs`    | Fábrica de configuración ESLint 9 con lint tipado               |
| `prettier/index.mjs`  | Formato común (2 espacios, comillas simples, 100 columnas, LF)  |

## Uso

```jsonc
// apps/api/tsconfig.json
{ "extends": "@ccltpg/config/tsconfig/node.json" }
```

```js
// apps/api/eslint.config.mjs
import { createConfig } from '@ccltpg/config/eslint';
export default createConfig({ tsconfigRootDir: import.meta.dirname });
```

## Decisiones asociadas

- **D39:** Node.js 22 + pnpm 9. El paquete fija TypeScript **5.9.3** porque `typescript-eslint` aún no admite TypeScript 7; ESLint y Prettier son los del stack congelado (diseño cap. 5).
- El formato se aplica con Prettier; ESLint no duplica reglas de estilo (`eslint-config-prettier` al final).
