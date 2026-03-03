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
  // GRP static site files (browser IIFEs)
  {
    files: ["apps/grp/app.js", "apps/grp/cms.js", "apps/grp/news.js", "apps/grp/news-data.js", "apps/grp-v2/app.js", "apps/grp-v2/cms.js", "apps/grp-v2/news.js", "apps/grp-v2/news-data.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        HTMLElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLAnchorElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLIFrameElement: "readonly",
        HTMLTextAreaElement: "readonly",
        FormData: "readonly",
        URLSearchParams: "readonly",
        alert: "readonly",
        console: "readonly",
      }
    },
    rules: {
      "no-console": "off",
      "eqeqeq": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": "warn",
    }
  },
  // GRP test files and helper library
  {
    files: ["apps/grp/tests/**/*.js", "apps/grp/lib/**/*.js", "apps/grp-v2/tests/**/*.js", "apps/grp-v2/lib/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        localStorage: "readonly",
        console: "readonly",
      }
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "warn",
    }
  },
  // Node.js CommonJS files (database, scripts)
  {
    files: ["db/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        console: "readonly",
      }
    },
    rules: {
      "no-console": "off",
    }
  },
  {
    ignores: ["dist/**", "node_modules/**"]
  }
];
