import { defineConfig, mergeConfig } from 'vitest/config';

import base from './vitest.config.js';

/**
 * Configuración exclusiva de la suite de integración: prepara URLs aisladas
 * antes de importar los specs, que de otro modo apuntarían a la base de desarrollo.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      setupFiles: ['./test/integration/setup-env.ts'],
    },
  }),
);
