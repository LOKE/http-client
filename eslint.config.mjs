import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";

export default [
  eslint.configs.recommended,
  {
    ignores: ["**/node_modules/**", "**/dist/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/adjacent-overload-signatures": "error",
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/no-restricted-types": "error",
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        { accessibility: "no-public" },
      ],
      "@typescript-eslint/no-empty-interface": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-misused-new": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-this-alias": "error",
      "@typescript-eslint/prefer-for-of": "error",
      "@typescript-eslint/prefer-function-type": "error",
      "@typescript-eslint/prefer-namespace-keyword": "error",
      "@typescript-eslint/unified-signatures": "error",

      // Disable 'no-undef' for TypeScript files
      "no-undef": "off",

      // General rules
      "no-console": "warn",
      "no-debugger": "error",
      "no-alert": "error",
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "prefer-destructuring": ["error", { object: true, array: false }],
      "no-else-return": "error",
      "no-unused-expressions": "error",
      "no-unneeded-ternary": "error",
      "no-duplicate-imports": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-useless-constructor": "error",
      "no-useless-rename": "error",
      "no-param-reassign": "error",
      "no-shadow-restricted-names": "error",
      "no-throw-literal": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "no-with": "error",
      "prefer-arrow-callback": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      yoda: "error",
    },
  },
];
