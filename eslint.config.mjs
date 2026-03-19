import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: false,
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off"
    }
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.mjs"],
    rules: {
      ...prettier.rules
    }
  },
  // Node.js server files
  {
    files: ["apps/tennis-server/**/*.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        require: "readonly",
        Buffer: "readonly",
        NodeJS: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
      }
    }
  },
  // Test files
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts"],
    languageOptions: {
      globals: {
        crypto: "readonly",
      }
    }
  },
  {
    ignores: ["dist/**", "node_modules/**"]
  }
];
