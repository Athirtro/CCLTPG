// Propósito: configuración ESLint del backend (placeholder Iteración 1).
// TODO(Iteración 1): configurar reglas para TypeScript estricto, NestJS y cero advertencias nuevas.

module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { project: null, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: [],
  ignorePatterns: ["dist", "node_modules"],
  rules: {},
};
