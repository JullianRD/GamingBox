import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "public/**", "logs/**", "coverage/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      // Les logs passent par pino (src/config/logger.js) ; console reste permis pour les scripts CLI
      "no-console": ["error", { allow: ["error", "log"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    // Dans l'application, console.* est interdit (utiliser le logger)
    files: ["src/**/*.js", "app.js"],
    rules: { "no-console": "error" },
  },
];
