import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Configuración ESLint compartida (flat config, ESLint 9).
 *
 * Reglas comunes del monorepo: TypeScript estricto con lint tipado,
 * imports de tipo consistentes y Prettier al final para no pelear con el formato.
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir Directorio raíz del paquete que consume la config.
 * @param {boolean} [options.browser] Usa globals de navegador en lugar de Node.
 * @param {string[]} [options.ignores] Patrones adicionales a ignorar.
 * @returns {import('eslint').Linter.Config[]}
 */
export function createConfig({ tsconfigRootDir, browser = false, ignores = [] }) {
  return tseslint.config(
    {
      ignores: [
        '**/dist/**',
        '**/coverage/**',
        '**/node_modules/**',
        '**/*.tsbuildinfo',
        ...ignores,
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: {
            allowDefaultProject: ['*.config.{js,mjs,cjs}', '.*rc.{js,mjs,cjs}'],
          },
          tsconfigRootDir,
        },
        globals: browser ? { ...globals.browser } : { ...globals.node },
      },
      rules: {
        eqeqeq: ['error', 'smart'],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-misused-promises': [
          'error',
          { checksVoidReturn: { attributes: false } },
        ],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    prettier,
  );
}

export default createConfig;
