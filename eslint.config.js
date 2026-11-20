// ESLint flat config.
//
// ESLint (instead of e.g. Biome/JSHint) is used because it is the
// canonical linter for plain JS, supports flat config natively,
// and can model the Apps Script global model (sourceType: "script"
// plus explicit globals) without a bundler or module system.
//
// Apps Script files are not modules: they share one global scope
// and are concatenated by the runtime. `sourceType: "script"` plus
// the explicit `globals` below encode that, so `no-undef` can still
// catch typos in the shared cross-file names and in the Apps Script
// services (SpreadsheetApp, UrlFetchApp, ...).
const js = require("@eslint/js");

/** Globals provided by the Apps Script V8 runtime. */
const appsScriptGlobals = {
  DriveApp: "readonly",
  Logger: "readonly",
  PropertiesService: "readonly",
  SpreadsheetApp: "readonly",
  UrlFetchApp: "readonly",
};

/**
 * Top-level names defined in one src/*.js file and referenced from
 * another. They are declared as read-only globals so `no-undef`
 * still guards against typos in a shared-scope codebase.
 */
const sharedGlobals = {
  Config: "readonly",
  addOneSecond: "readonly",
  buildRecordedKeys: "readonly",
  byCreatedAt: "readonly",
  checkForMissingTransactions: "readonly",
  dateKey: "readonly",
  getLastTransactionDate: "readonly",
  getMaxDate: "readonly",
  getScriptProperty: "readonly",
  getSheet: "readonly",
  getSpreadsheet: "readonly",
  getTransactions: "readonly",
  insertTransaction: "readonly",
  insertTransactions: "readonly",
  isTransfer: "readonly",
  logTransaction: "readonly",
  makeApiRequest: "readonly",
  onOpen: "readonly",
  retrieveAndUpdateTransactions: "readonly",
  runCheck: "readonly",
  sortByCreatedAt: "readonly",
  testAPI: "readonly",
  toRowValues: "readonly",
  transactionKey: "readonly",
  updateLogs: "readonly",
  updateLogsFromMenu: "readonly",
};

/** Node.js globals used by the node:test tests and this config file. */
const nodeGlobals = {
  __dirname: "readonly",
  Buffer: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  exports: "writable",
  global: "writable",
  module: "writable",
  process: "readonly",
  require: "readonly",
  setImmediate: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
};

module.exports = [
  js.configs.recommended,
  {
    ignores: ["node_modules/**", "package-lock.json", ".clasp.json"],
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      // Apps Script V8 supports modern ES (same as Node 20+ here).
      ecmaVersion: 2024,
      sourceType: "script",
      globals: {
        ...appsScriptGlobals,
        ...sharedGlobals,
      },
    },
    rules: {
      // The globals above ARE the top-level declarations, so a file
      // defining `isTransfer` would otherwise look like it redeclares
      // a global. That is the shared-scope model, not a bug.
      "no-redeclare": "off",
      // Top-level functions in Apps Script are only ever invoked by
      // other files, the Apps Script runtime (onOpen), or a menu
      // (runCheck/testAPI) — never within the file that defines them.
      // Keep unused-var checks for locals/args only, so typos in
      // locals are still caught without flagging every shared helper
      // as "unused" in its defining file.
      "no-unused-vars": [
        "error",
        { vars: "local", args: "after-used" },
      ],
    },
  },
  {
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: {
        ...nodeGlobals,
      },
    },
  },
];
